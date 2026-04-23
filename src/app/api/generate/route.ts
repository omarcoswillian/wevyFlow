import { SECTIONS } from "../../lib/arsenal/sections";
import { assembleSections } from "../../lib/arsenal/loader";
import { resolveConfig, callOnce, startStream, iterableToReadable, parseApiError } from "../../lib/ai-client";

/* ─────────────────────────────────────────────────────────────
   Rate limiter (in-memory, resets on deploy)
   ───────────────────────────────────────────────────────────── */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

/* ─────────────────────────────────────────────────────────────
   SSRF-safe URL fetcher (for reference URL support)
   ───────────────────────────────────────────────────────────── */
function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "0.0.0.0") return false;
    if (host.endsWith(".local") || host.endsWith(".internal")) return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host)) return false;
    if (host.startsWith("metadata.") || host.includes("169.254.169.254")) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchReferenceHTML(url: string): Promise<string | null> {
  if (!isAllowedUrl(url)) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    let extracted = "";
    const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
    if (styleMatches) extracted += "/* CSS */\n" + styleMatches.join("\n").slice(0, 3000) + "\n\n";
    let bodyHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<svg[\s\S]*?<\/svg>/gi, "")
      .replace(/<img[^>]*>/gi, "[IMG]")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\s{2,}/g, " ");
    const bodyMatch = bodyHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    extracted += "/* HTML */\n" + (bodyMatch ? bodyMatch[1] : bodyHtml).slice(0, 5000 - extracted.length);
    return extracted;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   Step 1 — COMPOSE: Claude picks section IDs
   ───────────────────────────────────────────────────────────── */
const COMPOSE_SYSTEM = `Você é um arquiteto de landing pages para infoprodutores brasileiros.
Dado um briefing, escolha 4 a 7 IDs de seções do catálogo para montar a página.

REGRAS OBRIGATÓRIAS:
- Sempre incluir exatamente 1 hero (primeiro da lista)
- Incluir urgencia-countdown APENAS em páginas de vendas com prazo/lançamento
- Ordem lógica: hero → para-quem-e → depoimentos-grid → oferta-preco → faq-accordion
- Combinar o estilo do briefing com o campo "themes" do catálogo
- Responder APENAS com JSON válido: {"sectionIds":["id1","id2",...]}
- Zero texto fora do JSON`;

function buildCatalogText(): string {
  return SECTIONS.map(s =>
    `${s.id} | ${s.kind} | themes:${s.themes.join(",")} | suits:${s.suits.join(",")} | ${s.description}`
  ).join("\n");
}

/* ─────────────────────────────────────────────────────────────
   Step 3 — PERSONALIZE: Claude fills copy (streaming)
   ───────────────────────────────────────────────────────────── */
const PERSONALIZE_SYSTEM = `Você é um copywriter especialista em landing pages de alta conversão para o mercado digital brasileiro.

Receberá um HTML composto de múltiplas seções com dois tipos de copy:
1. Marcadores [INSERIR: algo] — substitua pelo conteúdo real
2. Copy de demonstração hardcoded (ex: "Modo Foco Total", "Marketing Digital Pro") — reescreva para o produto do usuário

REGRAS INVIOLÁVEIS:
1. Retorne APENAS o HTML completo. ZERO texto explicativo, markdown ou crases.
2. Preserve 100% da estrutura HTML, atributos class, id, style, SVGs e tags.
3. Substitua TODOS os [INSERIR: ...] — nunca deixe nenhum marcador.
4. Reescreva copy de demonstração para o produto real do usuário.
5. Copy em Português Brasileiro, direto e persuasivo.
6. ZERO emojis. Use SVG icons quando necessário.
7. Nunca invente nomes reais de pessoas — use nomes ficcionais plausíveis.
8. Primeiro caractere da resposta = "<"`;

/* ─────────────────────────────────────────────────────────────
   POST handler
   ───────────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  // Rate limit
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  if (!checkRateLimit(ip)) {
    return Response.json({ error: "Muitas requisições. Aguarde um minuto." }, { status: 429 });
  }

  const {
    prompt,
    platform,
    referenceUrl,
    brandReference,
    expectations,
    primaryColor,
    secondaryColor,
    fontChoice,
    stylePreset,
    images,
    apiKey,
    aiProvider,
    aiModel,
  } = await request.json();

  const aiConfig = resolveConfig(apiKey, aiProvider, aiModel);

  if (!prompt || typeof prompt !== "string") {
    return Response.json({ error: "Prompt é obrigatório" }, { status: 400 });
  }

  // Fetch reference URL if provided
  let referenceContext = "";
  if (referenceUrl) {
    const refHtml = await fetchReferenceHTML(referenceUrl);
    referenceContext = refHtml
      ? `\nREFERÊNCIA VISUAL (URL: ${referenceUrl}):\n${refHtml}\n`
      : `\nReferência: ${referenceUrl} (inacessível — use como inspiração de estilo).\n`;
  }

  /* ── Step 1: Compose ── */
  const catalogText = buildCatalogText();
  const composeUserMsg = [
    `CATÁLOGO:\n${catalogText}`,
    `BRIEFING:`,
    `- Descrição: ${prompt}`,
    `- Estilo: ${stylePreset || "dark-premium"}`,
    `- Plataforma: ${platform || "html"}`,
    referenceUrl ? `- Referência visual: ${referenceUrl}` : "",
    brandReference ? `- Marca de referência: ${brandReference}` : "",
    expectations ? `- Expectativas: ${expectations}` : "",
  ].filter(Boolean).join("\n");

  let sectionIds: string[] = [];
  try {
    const raw = await callOnce(aiConfig, COMPOSE_SYSTEM, composeUserMsg, 256);
    // Extract JSON even if there's surrounding text
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.sectionIds) && parsed.sectionIds.length > 0) {
        sectionIds = parsed.sectionIds;
      }
    }
  } catch (e) {
    console.error("[compose] error:", e);
  }

  // Fallback section list
  if (sectionIds.length === 0) {
    const p = prompt.toLowerCase();
    if (p.includes("captura") || p.includes("lead") || p.includes("inscri")) {
      sectionIds = ["hero-captura-conversao", "depoimentos-grid", "faq-accordion"];
    } else {
      sectionIds = ["hero-simples", "para-quem-e", "depoimentos-grid", "oferta-preco", "faq-accordion"];
    }
  }

  /* ── Step 2: Assemble ── */
  let assembledHtml: string;
  try {
    // Filter out any IDs that don't exist in the catalog
    const validIds = SECTIONS.map(s => s.id);
    sectionIds = sectionIds.filter(id => validIds.includes(id));
    if (sectionIds.length === 0) {
      sectionIds = ["hero-simples", "para-quem-e", "depoimentos-grid", "oferta-preco", "faq-accordion"];
    }
    assembledHtml = assembleSections(sectionIds);
  } catch (e) {
    console.error("[assemble] error:", e);
    assembledHtml = assembleSections(["hero-simples", "para-quem-e", "depoimentos-grid", "oferta-preco", "faq-accordion"]);
  }

  /* ── Step 3: Personalize (streaming) ── */
  const imagePart = images && Array.isArray(images) && images.length > 0
    ? `\nIMGS: ${images.length} imagem(ns) enviada(s) — use-as como <img src="DADO_BASE64"> no layout.`
    : "";

  const personalizeUserMsg = [
    `PRODUTO: ${prompt}`,
    `COR PRIMÁRIA: ${primaryColor || "#FF5C00"}`,
    `COR SECUNDÁRIA: ${secondaryColor || "#E04E00"}`,
    `FONTE: ${fontChoice || "montserrat"}`,
    `ESTILO: ${stylePreset || "dark-premium"}`,
    brandReference ? `MARCA DE REFERÊNCIA: ${brandReference}` : "",
    expectations ? `SENSAÇÃO DESEJADA: ${expectations}` : "",
    referenceContext,
    imagePart,
    `\nHTML PARA PERSONALIZAR:\n${assembledHtml}`,
  ].filter(Boolean).join("\n");

  // Start the streaming request BEFORE returning Response — lets us return a
  // proper JSON error if the API is unavailable (credits, auth, etc.)
  let gen: AsyncIterable<string>;
  try {
    gen = await startStream(
      aiConfig,
      PERSONALIZE_SYSTEM,
      personalizeUserMsg,
      32000,
      images && images.length > 0 ? images : undefined
    );
  } catch (e: unknown) {
    console.error("[personalize] API error:", e);
    const { status, message } = parseApiError(e, aiConfig.provider);
    return Response.json({ error: message }, { status });
  }

  return new Response(iterableToReadable(gen), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
