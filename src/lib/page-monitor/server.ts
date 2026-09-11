import * as tls from "tls";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Bloqueia os alvos óbvios de SSRF (localhost, IP privado/link-local,
 * metadata endpoint de nuvem) antes de deixar o servidor da WevyFlow fazer
 * fetch numa URL que o próprio usuário digitou. Checagem por string no
 * hostname informado — não resolve DNS pra confirmar o IP real, então não
 * blinda contra DNS rebinding; é uma defesa razoável pra uma ferramenta
 * interna de baixo volume, não proteção de nível enterprise. */
export function assertSafeMonitorUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("URL inválida.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Só URLs http:// ou https:// são aceitas.");
  }
  const host = url.hostname.toLowerCase();
  const isBlockedHost =
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "169.254.169.254" || // metadata endpoint (AWS/GCP/Azure)
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host === "::1";
  if (isBlockedHost) {
    throw new Error("Essa URL aponta pra um endereço interno/privado — não permitido.");
  }
  return url;
}

/* ─── Soft-404 e bloqueio de WAF/CAPTCHA — portado quase 1:1 do
 * page-checker.ts do "Prymo Monitora" (repo de referência do dono),
 * incluindo os padrões PT/EN já validados em produção lá. ─── */

const DEFAULT_SLOW_THRESHOLD_MS = 3000;
const MAX_BODY_SIZE = 50000;

const SOFT_404_PATTERNS = [
  "page not found", "404 error", "404 not found", "error 404",
  "page does not exist", "content not found", "resource not found",
  "the page you requested", "could not be found",
  "no longer available", "page is missing", "page has been removed",
  "pagina nao encontrada", "página não encontrada",
  "erro 404", "pagina nao existe", "página não existe",
  "pagina inexistente", "página inexistente", "conteudo nao encontrado",
  "conteúdo não encontrado", "recurso nao encontrado", "recurso não encontrado",
  "esta pagina nao existe", "esta página não existe", "pagina removida",
  "página removida", "pagina excluida", "página excluída",
  "nao foi possivel encontrar", "não foi possível encontrar",
];

const CHALLENGE_PATTERNS = [
  "cf-browser-verification", "cf_chl_opt", "cf-challenge", "challenge-platform",
  "ddos-guard", "just a moment", "checking your browser", "verificando seu navegador",
  "attention required", "access denied", "security check", "ray id",
];

function isErrorUrlPath(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (path === "/404" || path.endsWith("/404") || path.endsWith("/404/")) return true;
    if (
      path.includes("/not-found") || path.includes("/notfound") ||
      path.includes("/page-not-found") || path.includes("/pagina-nao-encontrada") ||
      path.includes("/erro-404") || path.includes("/error-404") ||
      path === "/error" || path.endsWith("/error") || path.endsWith("/error/")
    ) return true;
    return false;
  } catch {
    return false;
  }
}

function stripScriptsAndTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ");
}

function detectSoft404(html: string, url: string): boolean {
  if (isErrorUrlPath(url)) return true;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    const title = titleMatch[1].toLowerCase();
    if (title.includes("not found") || title.includes("404") || title.includes("não encontrad") || title.includes("nao encontrad")) {
      return true;
    }
  }
  const visibleText = stripScriptsAndTags(html).toLowerCase();
  return SOFT_404_PATTERNS.some((p) => visibleText.includes(p));
}

function detectBlock(status: number, html: string, responseUrl: string, originalUrl: string): { blocked: boolean; reason: string } {
  if (status === 403) {
    return { blocked: true, reason: "HTTP 403 — Acesso negado (possível WAF/firewall)" };
  }
  if (html) {
    const lower = html.toLowerCase();
    if (CHALLENGE_PATTERNS.some((p) => lower.includes(p))) {
      return { blocked: true, reason: "Página de challenge/CAPTCHA detectada (possível Cloudflare/WAF)" };
    }
  }
  try {
    const originalHost = new URL(originalUrl).hostname;
    const finalHost = new URL(responseUrl).hostname;
    if (originalHost !== finalHost) {
      const finalLower = responseUrl.toLowerCase();
      if (["blocked", "captcha", "challenge", "denied"].some((s) => finalLower.includes(s))) {
        return { blocked: true, reason: "Redirecionamento para página de bloqueio" };
      }
    }
  } catch { /* ignore URL parse errors */ }
  return { blocked: false, reason: "" };
}

export type PageStatus = "ONLINE" | "LENTO" | "OFFLINE" | "BLOQUEADO" | "TIMEOUT";

function determinePageStatus(success: boolean, status: number | null, responseTime: number, isSoft404: boolean, isBlocked: boolean, timedOut: boolean): PageStatus {
  if (isBlocked) return "BLOQUEADO";
  if (isSoft404) return "OFFLINE";
  if (timedOut) return "TIMEOUT";
  if (!success || (status !== null && status >= 400)) return "OFFLINE";
  if (responseTime > DEFAULT_SLOW_THRESHOLD_MS) return "LENTO";
  return "ONLINE";
}

export interface PageCheckResult {
  pageStatus: PageStatus;
  isUp: boolean;
  httpStatus: number | null;
  responseTimeMs: number | null;
  isSoft404: boolean;
  blocked: boolean;
  blockReason: string | null;
  error: string | null;
}

export async function checkPage(url: string): Promise<PageCheckResult> {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "WevyFlow-PageMonitor/1.0" },
      cache: "no-store",
    });
    clearTimeout(timeoutId);

    const responseTimeMs = Date.now() - started;
    const httpStatus = response.status;
    let bodySnippet = "";
    let isSoft404 = false;
    let blockInfo = { blocked: false, reason: "" };

    try {
      const text = await response.text();
      bodySnippet = text.slice(0, MAX_BODY_SIZE);
    } catch { /* body unreadable — proceed without it */ }

    if (response.ok) {
      isSoft404 = detectSoft404(bodySnippet, url);
    }
    blockInfo = detectBlock(httpStatus, bodySnippet, response.url, url);

    const success = response.ok && !isSoft404 && !blockInfo.blocked;
    const pageStatus = determinePageStatus(success, httpStatus, responseTimeMs, isSoft404, blockInfo.blocked, false);

    return {
      pageStatus,
      isUp: pageStatus === "ONLINE" || pageStatus === "LENTO",
      httpStatus,
      responseTimeMs,
      isSoft404,
      blocked: blockInfo.blocked,
      blockReason: blockInfo.blocked ? blockInfo.reason : null,
      error: success ? null : (blockInfo.blocked ? blockInfo.reason : isSoft404 ? "Soft 404 detectado" : `HTTP ${httpStatus}`),
    };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
    const pageStatus = determinePageStatus(false, null, Date.now() - started, false, false, timedOut);
    return {
      pageStatus,
      isUp: false,
      httpStatus: null,
      responseTimeMs: null,
      isSoft404: false,
      blocked: false,
      blockReason: null,
      error: timedOut ? "Tempo esgotado (10s) sem resposta." : err instanceof Error ? err.message : "Erro de conexão.",
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Se a primeira tentativa falhar, espera 5s e tenta de novo antes de
 * finalizar o status — evita marcar "Offline" por uma instabilidade de
 * rede de meio segundo. Não repete quando já deu ONLINE/LENTO. Mesma
 * lógica do checkPageWithRetry do repo de referência. */
export async function checkPageWithRetry(url: string, maxRetries = 1, retryDelayMs = 5000): Promise<PageCheckResult> {
  let result = await checkPage(url);
  if (result.pageStatus === "ONLINE" || result.pageStatus === "LENTO") return result;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await sleep(retryDelayMs);
    result = await checkPage(url);
    if (result.pageStatus === "ONLINE" || result.pageStatus === "LENTO") break;
  }
  return result;
}

export function deriveProbableCause(result: PageCheckResult): string {
  if (result.blocked) return result.blockReason || "Bloqueio por WAF/bot protection";
  if (result.pageStatus === "TIMEOUT") return `Timeout após ${result.responseTimeMs ?? "?"}ms — possível lentidão ou bloqueio de bot`;
  if (result.isSoft404) return "Conteúdo de erro detectado na página (Soft 404)";
  if (result.httpStatus !== null && result.httpStatus >= 500) return `Erro interno do servidor (HTTP ${result.httpStatus})`;
  if (result.httpStatus !== null && result.httpStatus >= 400) return `Página não encontrada ou erro (HTTP ${result.httpStatus})`;
  if (result.pageStatus === "LENTO") return `Resposta lenta (${result.responseTimeMs}ms) — possível sobrecarga do servidor`;
  if (result.httpStatus === null) return "Servidor inacessível — possível queda ou problema de DNS";
  return `Erro desconhecido: ${result.error || "sem detalhes"}`;
}

const INCIDENT_FAILURE_THRESHOLD = 2;

export interface RecordCheckResult {
  incidentCreated: boolean;
  incidentResolved: boolean;
}

/** Ponto único de gravação de um check de uptime+SSL — usado tanto pelo
 * endpoint sob demanda quanto pelo cron diário, pra garantir que os dois
 * caminhos alimentem o mesmo histórico/incidentes de forma consistente
 * (mesmo padrão do checkAndRecord do repo de referência). Não mexe em
 * campos de pagespeed_* — isso fica por conta de quem chamar. */
export async function recordUptimeCheck(
  supabase: SupabaseClient<Database>,
  monitorId: string,
  userId: string,
  page: PageCheckResult,
  ssl: SslCheckResult
): Promise<RecordCheckResult> {
  const { data: current } = await supabase
    .from("page_monitors")
    .select("consecutive_failures")
    .eq("id", monitorId)
    .maybeSingle();

  const isFailure = page.pageStatus !== "ONLINE" && page.pageStatus !== "LENTO";
  const nextConsecutiveFailures = isFailure ? (current?.consecutive_failures ?? 0) + 1 : 0;
  const now = new Date().toISOString();

  await supabase
    .from("page_monitors")
    .update({
      last_checked_at: now,
      http_status: page.httpStatus,
      is_up: page.isUp,
      response_time_ms: page.responseTimeMs,
      check_error: page.error,
      page_status: page.pageStatus,
      is_soft_404: page.isSoft404,
      blocked: page.blocked,
      block_reason: page.blockReason,
      consecutive_failures: nextConsecutiveFailures,
      ssl_status: ssl.status,
      ssl_expires_at: ssl.expiresAt,
      ssl_days_remaining: ssl.daysRemaining,
      ssl_issuer: ssl.issuer,
    })
    .eq("id", monitorId);

  await supabase.from("page_monitor_history").insert({
    page_monitor_id: monitorId,
    user_id: userId,
    page_status: page.pageStatus,
    http_status: page.httpStatus,
    response_time_ms: page.responseTimeMs,
    error: page.error,
  });

  const { data: openIncident } = await supabase
    .from("page_monitor_incidents")
    .select("id")
    .eq("page_monitor_id", monitorId)
    .eq("type", "UPTIME")
    .is("resolved_at", null)
    .maybeSingle();

  let incidentCreated = false;
  let incidentResolved = false;

  if (isFailure && !openIncident) {
    // Só abre incidente depois do limiar de falhas consecutivas — uma
    // instabilidade isolada não vira alarme.
    if (nextConsecutiveFailures >= INCIDENT_FAILURE_THRESHOLD) {
      await supabase.from("page_monitor_incidents").insert({
        page_monitor_id: monitorId,
        user_id: userId,
        type: "UPTIME",
        message: page.blocked ? (page.blockReason || "Bloqueio detectado") : page.isSoft404 ? "Soft 404 detectado" : page.error || `Status: ${page.pageStatus}`,
        probable_cause: deriveProbableCause(page),
        consecutive_failures_at_open: nextConsecutiveFailures,
        final_status: page.pageStatus,
      });
      incidentCreated = true;
    }
  } else if (!isFailure && openIncident) {
    await supabase
      .from("page_monitor_incidents")
      .update({ resolved_at: now, final_status: page.pageStatus })
      .eq("id", openIncident.id);
    incidentResolved = true;
  }

  // Incidente separado pra SSL crítico/expirado — resolve sozinho quando
  // o certificado for renovado (status volta a "valid").
  if (ssl.status === "critical" || ssl.status === "expired") {
    const { data: openSslIncident } = await supabase
      .from("page_monitor_incidents")
      .select("id")
      .eq("page_monitor_id", monitorId)
      .eq("type", "SSL")
      .is("resolved_at", null)
      .maybeSingle();
    if (!openSslIncident) {
      await supabase.from("page_monitor_incidents").insert({
        page_monitor_id: monitorId,
        user_id: userId,
        type: "SSL",
        message: ssl.status === "expired" ? "Certificado SSL expirado" : `Certificado SSL expira em ${ssl.daysRemaining} dia(s)`,
        probable_cause: ssl.status === "expired" ? "Certificado expirou — renovar imediatamente" : "Certificado perto de expirar — renovar",
        final_status: page.pageStatus,
      });
    }
  } else if (ssl.status === "valid") {
    await supabase
      .from("page_monitor_incidents")
      .update({ resolved_at: now, final_status: page.pageStatus })
      .eq("page_monitor_id", monitorId)
      .eq("type", "SSL")
      .is("resolved_at", null);
  }

  return { incidentCreated, incidentResolved };
}

/* ─── SSL — porta quase literal de ssl-checker.ts (mesmo uso do módulo
 * `tls` nativo do Node; roda em runtime Node das API routes, não em Edge). ─── */

export interface SslCheckResult {
  status: "valid" | "expiring_soon" | "critical" | "expired" | "error" | "no_ssl";
  expiresAt: string | null;
  daysRemaining: number | null;
  issuer: string | null;
}

const SSL_WARNING_DAYS = 30;
const SSL_CRITICAL_DAYS = 3;

interface CertInfo { valid_to: string; issuer: string | null }

function firstOf(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function getCertificate(host: string, port: number): Promise<CertInfo | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => { socket.destroy(); resolve(null); }, 10000);
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false }, () => {
      clearTimeout(timeout);
      try {
        const cert = socket.getPeerCertificate();
        resolve(cert?.valid_to ? { valid_to: cert.valid_to, issuer: firstOf(cert.issuer?.O) || firstOf(cert.issuer?.CN) || null } : null);
      } catch {
        resolve(null);
      }
      socket.end();
    });
    socket.on("error", () => { clearTimeout(timeout); resolve(null); });
  });
}

export async function checkSsl(pageUrl: string): Promise<SslCheckResult> {
  const url = new URL(pageUrl);
  if (url.protocol !== "https:") {
    return { status: "no_ssl", expiresAt: null, daysRemaining: null, issuer: null };
  }
  const port = url.port ? parseInt(url.port, 10) : 443;
  const cert = await getCertificate(url.hostname, port);
  if (!cert) {
    return { status: "error", expiresAt: null, daysRemaining: null, issuer: null };
  }
  const expiresAt = new Date(cert.valid_to);
  const daysRemaining = Math.floor((expiresAt.getTime() - Date.now()) / 86400000);
  const status: SslCheckResult["status"] =
    daysRemaining <= 0 ? "expired" : daysRemaining <= SSL_CRITICAL_DAYS ? "critical" : daysRemaining <= SSL_WARNING_DAYS ? "expiring_soon" : "valid";
  return { status, expiresAt: expiresAt.toISOString(), daysRemaining, issuer: cert.issuer };
}

/* ─── PageSpeed — 4 notas de categoria + Web Vitals reais (não só as
 * notas), retry automático em falha transitória do Lighthouse (achado em
 * teste manual 2026-09-10: "Something went wrong" costuma passar na
 * segunda tentativa sem nenhuma mudança). ─── */

export interface PageSpeedResult {
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
  fcp: number | null;
  lcp: number | null;
  tbt: number | null;
  cls: number | null;
  speedIndex: number | null;
  error: string | null;
}

interface PageSpeedApiResponse {
  lighthouseResult?: {
    categories?: Record<string, { score: number | null } | undefined>;
    audits?: Record<string, { numericValue?: number } | undefined>;
  };
  error?: { message?: string };
}

async function runPageSpeedOnce(url: string): Promise<PageSpeedResult> {
  const apiUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  apiUrl.searchParams.set("url", url);
  apiUrl.searchParams.set("strategy", "MOBILE");
  for (const category of ["PERFORMANCE", "SEO", "ACCESSIBILITY", "BEST_PRACTICES"]) {
    apiUrl.searchParams.append("category", category);
  }
  if (process.env.GOOGLE_PAGESPEED_API_KEY) {
    apiUrl.searchParams.set("key", process.env.GOOGLE_PAGESPEED_API_KEY);
  }

  const empty = { performance: null, seo: null, accessibility: null, bestPractices: null, fcp: null, lcp: null, tbt: null, cls: null, speedIndex: null };

  try {
    const res = await fetch(apiUrl, { signal: AbortSignal.timeout(45000) });
    const json = (await res.json().catch(() => ({}))) as PageSpeedApiResponse;
    if (!res.ok) {
      return { ...empty, error: json.error?.message || `PageSpeed respondeu HTTP ${res.status}` };
    }
    const cats = json.lighthouseResult?.categories;
    const audits = json.lighthouseResult?.audits;
    const toScore = (s?: { score: number | null }) => (typeof s?.score === "number" ? Math.round(s.score * 100) : null);
    const numeric = (id: string) => {
      const v = audits?.[id]?.numericValue;
      return typeof v === "number" ? Math.round(v) : null;
    };
    const cls = audits?.["cumulative-layout-shift"]?.numericValue;
    return {
      performance: toScore(cats?.performance),
      seo: toScore(cats?.seo),
      accessibility: toScore(cats?.accessibility),
      bestPractices: toScore(cats?.["best-practices"]),
      fcp: numeric("first-contentful-paint"),
      lcp: numeric("largest-contentful-paint"),
      tbt: numeric("total-blocking-time"),
      cls: typeof cls === "number" ? Math.round(cls * 10000) / 10000 : null,
      speedIndex: numeric("speed-index"),
      error: null,
    };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return { ...empty, error: timedOut ? "PageSpeed demorou demais pra responder (45s)." : err instanceof Error ? err.message : "Erro ao consultar o PageSpeed." };
  }
}

/** GOOGLE_PAGESPEED_API_KEY é obrigatória na prática — testado em
 * 2026-09-10: sem chave a API devolve 429 "Quota exceeded" com
 * quota_limit_value 0 (não é "cota baixa", é zero mesmo).
 *
 * Uma nova tentativa automática: "Lighthouse returned error: Something
 * went wrong" é uma falha conhecida e transitória do motor do Google —
 * confirmado em teste manual (2026-09-10) que a mesma URL funciona na
 * segunda tentativa sem nenhuma mudança. Não repete em erro de cota (não
 * adianta) nem em timeout (já esperou 45s, repetir só dobra a espera). */
export async function checkPageSpeed(url: string): Promise<PageSpeedResult> {
  const first = await runPageSpeedOnce(url);
  if (!first.error) return first;
  if (/quota exceeded|demorou demais/i.test(first.error)) return first;

  await sleep(2000);
  return runPageSpeedOnce(url);
}
