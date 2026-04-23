import { SECTIONS } from "../../lib/arsenal/sections";
import { assembleSections } from "../../lib/arsenal/loader";
import { resolveConfig, callOnce, startStream, iterableToReadable, parseApiError, AICallConfig } from "../../lib/ai-client";

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

async function fetchPageScreenshot(url: string): Promise<{ base64: string; name: string } | null> {
  if (!isAllowedUrl(url)) return null;
  try {
    // thum.io: free, no API key, returns full-page JPEG
    const screenshotUrl = `https://image.thum.io/get/fullpage/width/1280/${url}`;
    const res = await fetch(screenshotUrl, {
      signal: AbortSignal.timeout(20000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 5000) return null;
    const b64 = Buffer.from(buffer).toString("base64");
    const mime = res.headers.get("content-type") || "image/jpeg";
    return { base64: `data:${mime};base64,${b64}`, name: "reference-screenshot.jpg" };
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   Browser service — full JS-rendered page + high-quality screenshot
   Uses BROWSER_SERVICE_URL env var. Falls back to fetchReferenceHTML +
   fetchPageScreenshot when not configured.
   ───────────────────────────────────────────────────────────── */
interface BrowserRenderResult {
  html: string;
  screenshot: { base64: string; name: string } | null;
  title: string;
}

async function renderWithBrowser(url: string): Promise<BrowserRenderResult | null> {
  const serviceUrl = process.env.BROWSER_SERVICE_URL;
  if (!serviceUrl || !isAllowedUrl(url)) return null;
  try {
    const res = await fetch(`${serviceUrl}/render`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.BROWSER_SERVICE_SECRET
          ? { "x-service-secret": process.env.BROWSER_SERVICE_SECRET }
          : {}),
      },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      html: data.html ?? "",
      screenshot: data.screenshot
        ? { base64: data.screenshot, name: "reference-screenshot.jpg" }
        : null,
      title: data.title ?? "",
    };
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
   Step 0 — HYDRATION: fast model extracts structured product context
   Runs in parallel with Step 1 (Compose) to add zero extra latency.
   ───────────────────────────────────────────────────────────── */
const HYDRATION_SYSTEM = `Você é um analista de produtos digitais. Extraia informações estruturadas do briefing em JSON.
Responda APENAS com JSON válido, sem texto adicional.`;

interface ProductContext {
  productName: string | null;
  niche: string | null;
  mainBenefit: string | null;
  targetAudience: string | null;
  cta: string | null;
  tone: string | null;
}

async function extractProductContext(cfg: AICallConfig, prompt: string): Promise<ProductContext> {
  const empty: ProductContext = { productName: null, niche: null, mainBenefit: null, targetAudience: null, cta: null, tone: null };
  try {
    const haikuCfg: AICallConfig = {
      provider: "anthropic",
      apiKey: cfg.provider === "anthropic" ? cfg.apiKey : (process.env.ANTHROPIC_API_KEY || ""),
      model: "claude-haiku-4-5-20251001",
    };
    if (!haikuCfg.apiKey) return empty;
    const raw = await callOnce(haikuCfg, HYDRATION_SYSTEM,
      `Briefing: ${prompt}\n\nExtraia:\n{"productName":"nome do produto","niche":"nicho/mercado","mainBenefit":"principal benefício/transformação","targetAudience":"público-alvo","cta":"texto ideal para o botão CTA","tone":"tom: autoritativo|inspirador|técnico|amigável"}`,
      256
    );
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return { ...empty, ...JSON.parse(match[0]) };
  } catch { /* proceed without enriched context */ }
  return empty;
}

/* ─────────────────────────────────────────────────────────────
   REPLICATE mode — used when browser service returns a full render.
   Skips compose + assemble entirely. Claude generates HTML from scratch
   using screenshot as primary reference.
   ───────────────────────────────────────────────────────────── */
const REPLICATE_SYSTEM = `Você é um expert em HTML/CSS que replica páginas web com fidelidade visual máxima.

Você receberá:
1. Um screenshot da página de referência — use como guia visual PRIMÁRIO
2. O HTML renderizado da página — use para entender estrutura e conteúdo

SUA TAREFA: Recriar esta página em HTML/CSS puro, self-contained e limpo.

REGRAS INVIOLÁVEIS:
1. Retorne APENAS o HTML completo. ZERO texto explicativo, markdown ou crases.
2. Replique fielmente: layout, cores exatas, tipografia, espaçamentos, seções, hierarquia visual.
3. Substitua imagens reais por divs/gradientes com as mesmas proporções e posições.
4. Se um briefing de produto foi fornecido, adapte apenas o copy — mantenha toda a estrutura.
5. Use Google Fonts para as fontes identificadas. CSS em <style> no <head>.
6. Não inclua JavaScript externo. Interações simples podem usar CSS puro.
7. Primeiro caractere da resposta = "<"`;

/* ─────────────────────────────────────────────────────────────
   Step 3 — PERSONALIZE: Claude fills copy (streaming)
   ───────────────────────────────────────────────────────────── */
const PERSONALIZE_SYSTEM = `Você é um designer e copywriter especialista em landing pages de alta conversão para o mercado digital brasileiro.

Quando uma imagem de referência for fornecida (screenshot de uma página existente):
- Use a imagem como referência visual PRIMÁRIA — replique fielmente o layout, paleta de cores, tipografia, espaçamentos, seções e hierarquia visual.
- Adapte apenas o conteúdo/copy para o produto do briefing.
- Priorize a fidelidade visual à referência acima de qualquer outra instrução de estilo.

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

const COPY_MODE_SYSTEM = `Você é um especialista em landing pages. O usuário forneceu a copy completa e quer que você distribua esse texto exato nas seções do HTML.

MODO COPY — REGRAS INVIOLÁVEIS:
1. Retorne APENAS o HTML completo. ZERO texto explicativo, markdown ou crases.
2. Preserve 100% da estrutura HTML, classes, IDs, styles, SVGs.
3. Use o texto do DOCUMENTO DE COPY exatamente como está — não reescreva, não resuma, não invente.
4. Distribua o conteúdo do documento nas seções que fazem sentido:
   - Headline principal → elemento .headline ou h1 do hero
   - Subtítulo / descrição → .subheadline ou p do hero
   - Benefícios / tópicos → listas de features ou cards
   - Depoimentos / provas → seção de depoimentos (nome, cargo, texto exato)
   - Preço / oferta → seção de oferta (valor, parcelamento, bônus)
   - FAQ → perguntas e respostas exatas do documento
   - CTA → texto exato dos botões de ação
5. Se o documento não tiver conteúdo para uma seção, mantenha o placeholder ou copy genérica.
6. Corrija apenas erros ortográficos óbvios — sem alterar sentido ou tom.
7. Primeiro caractere da resposta = "<"`;

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
    copyDocument,
    apiKey,
    aiProvider,
    aiModel,
  } = await request.json();

  const aiConfig = resolveConfig(apiKey, aiProvider, aiModel);

  if (!prompt && !copyDocument) {
    return Response.json({ error: "Prompt ou documento de copy é obrigatório" }, { status: 400 });
  }

  // Fetch reference URL — browser service (full JS render) or fallback
  let referenceContext = "";
  let referenceScreenshot: { base64: string; name: string } | null = null;
  let browserResult: BrowserRenderResult | null = null;
  if (referenceUrl) {
    browserResult = await renderWithBrowser(referenceUrl);
    if (browserResult) {
      // Full JS-rendered path
      referenceScreenshot = browserResult.screenshot;
      referenceContext = `\nREFERÊNCIA VISUAL (URL: ${referenceUrl}): screenshot da página completa renderizada anexado — replique FIELMENTE o layout, cores, tipografia, espaçamentos e estrutura visual.\n`;
      if (browserResult.html) {
        // Send a trimmed version of the rendered DOM for structural context
        const trimmedHtml = browserResult.html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<svg[\s\S]*?<\/svg>/gi, "")
          .replace(/<img[^>]*>/gi, "[IMG]")
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/\s{2,}/g, " ")
          .slice(0, 8000);
        referenceContext += `HTML renderizado (pós-JS):\n${trimmedHtml}\n`;
      }
    } else {
      // Fallback: static fetch + thum.io screenshot
      const [refHtml, screenshot] = await Promise.all([
        fetchReferenceHTML(referenceUrl),
        fetchPageScreenshot(referenceUrl),
      ]);
      referenceScreenshot = screenshot;
      if (screenshot) {
        referenceContext = `\nREFERÊNCIA VISUAL (URL: ${referenceUrl}): screenshot anexado como imagem — replique fielmente o layout, cores, tipografia e estrutura vistos na imagem.\n`;
        if (refHtml) referenceContext += `HTML/CSS resumido:\n${refHtml}\n`;
      } else if (refHtml) {
        referenceContext = `\nREFERÊNCIA VISUAL (URL: ${referenceUrl}):\n${refHtml}\n`;
      } else {
        referenceContext = `\nReferência: ${referenceUrl} (inacessível — use como inspiração de estilo).\n`;
      }
    }
  }

  /* ── REPLICATE mode: browser render available → skip arsenal, go straight to Claude ── */
  if (browserResult) {
    const replicateMsg = [
      prompt ? `BRIEFING / PRODUTO: ${prompt}` : "Replique fielmente a página de referência.",
      brandReference ? `MARCA: ${brandReference}` : "",
      expectations ? `SENSAÇÃO DESEJADA: ${expectations}` : "",
      primaryColor ? `COR PRIMÁRIA DO PRODUTO: ${primaryColor}` : "",
      fontChoice ? `FONTE PREFERIDA: ${fontChoice}` : "",
      `\nURL DE REFERÊNCIA: ${referenceUrl}`,
      browserResult.title ? `TÍTULO DA PÁGINA: ${browserResult.title}` : "",
      `\nHTML RENDERIZADO (pós-JS, use para estrutura):\n${browserResult.html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<svg[\s\S]*?<\/svg>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/\s{2,}/g, " ")
        .slice(0, 12000)}`,
    ].filter(Boolean).join("\n");

    const replicateImages = referenceScreenshot ? [referenceScreenshot] : [];

    let replicateGen: AsyncIterable<string>;
    try {
      replicateGen = await startStream(
        aiConfig,
        REPLICATE_SYSTEM,
        replicateMsg,
        32000,
        replicateImages.length > 0 ? replicateImages : undefined
      );
    } catch (e: unknown) {
      console.error("[replicate] API error:", e);
      const { status, message } = parseApiError(e, aiConfig.provider);
      return Response.json({ error: message }, { status });
    }

    return new Response(iterableToReadable(replicateGen), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  /* ── Steps 0 + 1 in parallel: Hydration (context extraction) + Compose (section selection) ── */
  const catalogText = buildCatalogText();
  const hasCopyDoc = typeof copyDocument === "string" && copyDocument.trim().length > 0;
  const composeUserMsg = [
    `CATÁLOGO:\n${catalogText}`,
    `BRIEFING:`,
    `- Descrição: ${prompt || "(sem descrição — usar documento de copy)"}`,
    `- Estilo: ${stylePreset || "dark-premium"}`,
    `- Plataforma: ${platform || "html"}`,
    referenceUrl ? `- Referência visual: ${referenceUrl}` : "",
    brandReference ? `- Marca de referência: ${brandReference}` : "",
    expectations ? `- Expectativas: ${expectations}` : "",
    hasCopyDoc ? `- Documento de copy fornecido: SIM (escolha seções que absorvam o conteúdo completo: hero, benefícios, depoimentos, oferta, FAQ)` : "",
  ].filter(Boolean).join("\n");

  let sectionIds: string[] = [];
  let productContext: ProductContext = { productName: null, niche: null, mainBenefit: null, targetAudience: null, cta: null, tone: null };

  try {
    const [composeRaw, ctx] = await Promise.all([
      callOnce(aiConfig, COMPOSE_SYSTEM, composeUserMsg, 256),
      extractProductContext(aiConfig, prompt),
    ]);
    productContext = ctx;
    // Extract JSON even if there's surrounding text
    const jsonMatch = composeRaw.match(/\{[\s\S]*\}/);
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

  const contextLines = [
    productContext.productName ? `NOME DO PRODUTO: ${productContext.productName}` : "",
    productContext.niche ? `NICHO: ${productContext.niche}` : "",
    productContext.mainBenefit ? `PRINCIPAL BENEFÍCIO: ${productContext.mainBenefit}` : "",
    productContext.targetAudience ? `PÚBLICO-ALVO: ${productContext.targetAudience}` : "",
    productContext.cta ? `CTA IDEAL: ${productContext.cta}` : "",
    productContext.tone ? `TOM: ${productContext.tone}` : "",
  ].filter(Boolean).join("\n");

  const hasCopyDocument = typeof copyDocument === "string" && copyDocument.trim().length > 0;

  const personalizeUserMsg = [
    prompt ? `BRIEFING / ESTILO DESEJADO: ${prompt}` : "",
    hasCopyDocument
      ? `\nDOCUMENTO DE COPY DO CLIENTE (use este texto exatamente nas seções — não invente copy nova):\n---\n${copyDocument.trim()}\n---`
      : contextLines,
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
  // Merge user images + reference screenshot (screenshot first = primary context)
  const allImages: { base64: string; name: string }[] = [
    ...(referenceScreenshot ? [referenceScreenshot] : []),
    ...(images && images.length > 0 ? images : []),
  ];

  let gen: AsyncIterable<string>;
  try {
    gen = await startStream(
      aiConfig,
      hasCopyDocument ? COPY_MODE_SYSTEM : PERSONALIZE_SYSTEM,
      personalizeUserMsg,
      32000,
      allImages.length > 0 ? allImages : undefined
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
