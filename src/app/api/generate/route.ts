import { resolveConfig, callOnce, startStream, iterableToReadable, parseApiError, AICallConfig } from "../../lib/ai-client";
import { checkAndDeductCredit, isCreditError, limitReachedResponse, finalizeGeneration } from "../../lib/credits";
import { requireLaunch, launchErrorResponse, resolveLaunchStyle } from "@/lib/launches/server";
import { CIALDINI_PRINCIPLES_BLOCK } from "../../lib/copy/persuasion-principles";

export const maxDuration = 300;

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
    const bodyHtml = html
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
const REPLICATE_SYSTEM = `Você é um expert em HTML/CSS especializado em replicar páginas web com fidelidade máxima.

Você receberá:
1. Um screenshot da página de referência — seu guia visual ABSOLUTO
2. O HTML renderizado — para entender estrutura e texto

ANTES DE GERAR QUALQUER CÓDIGO, analise mentalmente o screenshot e responda internamente:
- Quantas seções existem? (conte visualmente)
- Qual o layout de cada seção? (split, centrado, grid, etc.)
- Quais as cores exatas dominantes?
- Qual a tipografia usada?
- Onde estão os CTAs, formulários, imagens?

SUA TAREFA: Recriar esta página EXATAMENTE como ela aparece no screenshot. Nem maior, nem menor, nem diferente.

REGRAS INVIOLÁVEIS:
1. Retorne APENAS o HTML completo. ZERO texto explicativo, markdown ou crases.
2. SOMENTE as seções visíveis no screenshot — PROIBIDO inventar, adicionar ou expandir.
3. Mesma quantidade de seções, mesma ordem, mesmos elementos visuais.
4. Cores, tipografia, espaçamentos, proporções — tudo igual ao screenshot.
5. Imagens e fotos → divs placeholder com as mesmas proporções e posição, nunca elementos soltos.
6. Briefing fornecido → adapte APENAS o copy, NUNCA a estrutura.
7. Google Fonts para as fontes identificadas. Todo CSS em <style> no <head>.
8. Zero JavaScript externo.
9. Primeiro caractere = "<"
10. ZERO emojis em qualquer parte do HTML — use apenas SVG icons inline.
11. NUNCA use a fonte Unbounded. Fontes padrão quando não especificado: Montserrat ou Sora.
12. Se a referência usar blur circles decorativos no hero, reproduza com divs posicionados absolutamente.
13. Gradiente animado em CTAs (keyframes brilho) — reproduza se visível na referência.
14. Letter-spacing negativo em headings grandes (-0.02em a -0.04em) — aplique se o texto parecer comprimido na referência.
15. Glow de box-shadow em CTAs e elementos de destaque — reproduza se visível.
16. PERFORMANCE: uma única tag <link> de fontes no <head> com preconnect hints antes dela. Adicione loading="lazy" em imgs fora do hero. Adicione fetchpriority="high" loading="eager" no primeiro img do hero.

REGRA — HERO COM FOTO DE PESSOA (split layout):
- min-height: 700px, width: 100%
- Foto = coluna flex/grid da seção ocupando a altura total do lado direito
- Nunca um div isolado fora da seção

REGRA ABSOLUTA — NÃO EXPANDIR A PÁGINA:
A referência é a lei. Se ela tem 2 seções → gere 2. Se tem 4 → gere 4.
É TERMINANTEMENTE PROIBIDO adicionar FAQ, depoimentos, benefícios, garantia ou qualquer seção que não exista visivelmente no screenshot da referência.`;

/* ─────────────────────────────────────────────────────────────
   Step 3 — PERSONALIZE: Claude fills copy (streaming)
   Padrões visuais variam por stylePreset para garantir que
   light-clean, glassmorphism, neon-tech etc. sejam respeitados.
   ───────────────────────────────────────────────────────────── */
function getVisualPatterns(stylePreset: string, primaryColor: string): string {
  switch (stylePreset) {
    case "light-clean":
      return `PADRÕES VISUAIS OBRIGATÓRIOS — ESTILO LIGHT CLEAN:
⚠️ ATENÇÃO: O usuário escolheu modo CLARO. Ignore qualquer cor escura do template base.
- Fundo geral: #ffffff ou #f8fafc (NUNCA preto, NUNCA cinza escuro)
- Seções alternadas: #ffffff e #f1f5f9
- Texto: #111827 (principal), #6b7280 (secundário/muted)
- Headings: #0f172a, letter-spacing: -0.03em
- Cards: background #ffffff, border: 1px solid #e5e7eb, border-radius: 12px
- CTAs: background: ${primaryColor || "#6366f1"}; color: #ffffff; border-radius: 10px
  Hover: filter: brightness(1.08); box-shadow: 0 4px 20px ${primaryColor || "#6366f1"}40
- Sem blur circles escuros — se decorativo, use círculos com cor pastel e opacity: 0.15
- Stats: cor primária ${primaryColor || "#6366f1"} ou #0f172a, fundo claro
- Separadores de seção: border-top: 1px solid #e5e7eb
- REGRA ABSOLUTA: qualquer background escuro do template DEVE ser substituído por branco ou cinza claro`;

    case "glassmorphism":
      return `PADRÕES VISUAIS OBRIGATÓRIOS — ESTILO GLASSMORPHISM:
- Fundo: gradiente escuro ou imagem blur como base (#0f0f1a ou similar)
- Cards/seções internas: background: rgba(255,255,255,0.07); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px
- Texto: branco ou rgba(255,255,255,0.85)
- CTAs: background: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.25); color: #fff
  Hover: background: rgba(255,255,255,0.25)
- Blur circles decorativos: filter:blur(100px); opacity:0.25; border-radius:50%
- Headings: letter-spacing: -0.03em; color: #ffffff`;

    case "neon-tech":
      return `PADRÕES VISUAIS OBRIGATÓRIOS — ESTILO NEON TECH:
- Fundo: #050508 ou #020207 (quase preto)
- Texto: #e2e8f0 (principal), #64748b (muted)
- CTAs: background: transparent; border: 2px solid ${primaryColor || "#00f5ff"}; color: ${primaryColor || "#00f5ff"}
  box-shadow: 0 0 20px ${primaryColor || "#00f5ff"}60, inset 0 0 20px ${primaryColor || "#00f5ff"}10
  Hover: background: ${primaryColor || "#00f5ff"}15; box-shadow: 0 0 40px ${primaryColor || "#00f5ff"}80
- Blur circles decorativos: filter:blur(120px); opacity:0.20; cor: ${primaryColor || "#00f5ff"}
- Headings: letter-spacing: -0.03em; color: #ffffff; text-shadow: 0 0 30px ${primaryColor || "#00f5ff"}40
- Bordas de cards: border: 1px solid ${primaryColor || "#00f5ff"}30; background: rgba(255,255,255,0.03)`;

    case "luxury":
      return `PADRÕES VISUAIS OBRIGATÓRIOS — ESTILO LUXURY:
- Fundo: #0a0804 ou #09080d (preto quente ou frio profundo)
- Acento: ${primaryColor || "#c9a84c"} (dourado ou cor primária)
- Texto: #f5f0e8 (creme) ou #e8e0d0
- CTAs: background: ${primaryColor || "#c9a84c"}; color: #000000; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase
  box-shadow: 0 4px 24px ${primaryColor || "#c9a84c"}50
  Hover: filter: brightness(1.1)
- Sem blur circles — use linhas finas decorativas (border-bottom: 1px solid ${primaryColor || "#c9a84c"}40)
- Headings: font-weight: 300 ou 600; letter-spacing: -0.02em; color: #f5f0e8
- Cards: background: rgba(255,255,255,0.03); border: 1px solid ${primaryColor || "#c9a84c"}20`;

    case "brutalist":
      return `PADRÕES VISUAIS OBRIGATÓRIOS — ESTILO BRUTALIST:
- Fundo: #ffffff (branco puro) ou #f5f500 (amarelo choque — escolha um)
- Texto: #000000 (preto absoluto)
- CTAs: background: #000000; color: #ffffff; border: 3px solid #000000; border-radius: 0; text-transform: uppercase; font-weight: 900; letter-spacing: 0.05em
  Hover: background: ${primaryColor || "#ff0000"}; border-color: ${primaryColor || "#ff0000"}; color: #ffffff
- Sem blur, sem gradiente, sem sombra suave — apenas box-shadow: 4px 4px 0 #000
- Headings: font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; color: #000000
- Cards: border: 3px solid #000000; border-radius: 0; background: #ffffff; box-shadow: 6px 6px 0 #000`;

    default: // dark-premium
      return `PADRÕES VISUAIS OBRIGATÓRIOS — ESTILO DARK PREMIUM:
- CTAs: gradient animado: \`background-image: linear-gradient(45deg, ${primaryColor || "#FF5C00"}, ${primaryColor || "#E04E00"}, ${primaryColor || "#FF5C00"}, ${primaryColor || "#FF7A20"}); background-size: 400% 200%; animation: brilho 3.4s infinite;\` + \`@keyframes brilho { 0%{background-position:0 0} 100%{background-position:100% 0} }\`
- Glow em CTAs: \`box-shadow: 0 4px 32px ${primaryColor || "rgba(255,92,0,0.35)"}80\` default, hover mais intenso
- Hero: blur circles decorativos com \`filter:blur(120px); opacity:0.12; border-radius:50%\`
- Fundo: #0a0a0b ou #0c0c10
- Texto: #ffffff e rgba(255,255,255,0.6)
- Headings: letter-spacing: -0.03em; color: #ffffff
- Stats: números grandes, visualmente impactantes, cor primária ou branco`;
  }
}

function buildPersonalizeSystem(stylePreset: string, primaryColor: string): string {
  return `Você é um diretor de arte sênior especializado em criativos visuais (banners, thumbnails, stories, posts) para o mercado digital brasileiro. Você recebe o briefing de um produto/lançamento e gera UM único ativo visual em HTML/CSS autocontido — não uma página de vendas com múltiplas seções.

Quando uma imagem de referência for fornecida, use-a como guia de estilo (cores, composição, tom visual) — adapte o conteúdo ao produto do briefing.

${getVisualPatterns(stylePreset, primaryColor)}

${CIALDINI_PRINCIPLES_BLOCK}

REGRAS TÉCNICAS INVIOLÁVEIS:
1. Retorne APENAS o HTML completo. ZERO texto explicativo, markdown ou crases.
2. Gere um único elemento raiz com dimensões fixas apropriadas ao formato pedido no briefing (ex.: thumbnail de YouTube ≈ 1280×720, stories ≈ 1080×1920, post quadrado ≈ 1080×1080, banner de checkout ≈ 1200×400) — todo CSS em <style> no <head>, sem depender de viewport.
3. Copy em Português Brasileiro, curta e direta — um criativo tem no máximo uma headline, um subtítulo curto e um CTA. Sem clichês de marketing vazio.
4. ZERO emojis. Use SVG icons quando necessário.
5. Nunca invente nomes reais de pessoas — use nomes ficcionais plausíveis do nicho quando precisar de um depoimento curto.
6. Primeiro caractere da resposta = "<"
7. NUNCA use a fonte Unbounded. Padrão: Montserrat ou Sora.
8. Zero dependências externas além do Google Fonts. Zero JavaScript, a menos que o briefing peça uma animação simples via CSS.
9. O HTML final deve ter no máximo 150 linhas de código — um criativo é denso e visual, não um documento longo.`;
}

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
    projectId,
  } = await request.json();

  // Credit check — all users go through quota system
  if (!prompt && !copyDocument) {
    return Response.json({ error: "Prompt ou documento de copy é obrigatório" }, { status: 400 });
  }

  // projectId agora é opcional (pedido do dono: geração avulsa não deve
  // exigir lançamento) — sem ele, não há "fonte de verdade" de identidade
  // pra proteger, e os fatos canônicos abaixo simplesmente ficam vazios
  // (prompt/copyDocument/ctx extraído passam a ser a única fonte, como
  // era antes da Centralização de Lançamentos).
  let launch: Awaited<ReturnType<typeof requireLaunch>> | null = null;
  if (projectId) {
    try {
      launch = await requireLaunch(projectId);
    } catch (err) {
      const { body, status } = launchErrorResponse(err);
      return Response.json(body, { status });
    }
  }

  const creditResult = await checkAndDeductCredit("landing_page", prompt || "");
  if (isCreditError(creditResult)) {
    return Response.json({ error: creditResult.error }, { status: creditResult.status });
  }
  if (!creditResult.allowed) {
    return limitReachedResponse(creditResult);
  }
  const generationId = creditResult.generationId;

  const aiConfig = resolveConfig(undefined, undefined, undefined, "html");

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

  // Identity facts (who/what/for whom) come from the persisted launch
  // briefing, not from whatever the request happens to say — a launch for
  // product A must not be usable to quietly generate a page for product B
  // (see launches review item 3). Computed unconditionally, before any
  // branch/await that could fail, so every code path below (replicate,
  // copy-document, main compose, and the Promise.all failure fallback) has
  // it available.
  const canonicalFactsLines = [
    launch?.brandInfo.productName ? `PRODUTO (fonte de verdade — não troque por outro nome): ${launch.brandInfo.productName}` : "",
    launch?.brandInfo.niche ? `NICHO (fonte de verdade): ${launch.brandInfo.niche}` : "",
    launch?.brandInfo.targetAudience ? `PÚBLICO-ALVO (fonte de verdade): ${launch.brandInfo.targetAudience}` : "",
    launch?.brandInfo.transformation ? `TRANSFORMAÇÃO/BENEFÍCIO (fonte de verdade): ${launch.brandInfo.transformation}` : "",
  ].filter(Boolean).join("\n");

  // Style facts follow the same rule as the identity facts above: when a
  // launch exists, its resolved style (approved brand identity when
  // present, briefing style otherwise — see resolveLaunchStyle) is the
  // source of truth, not whatever color/font the client request happens to
  // carry. Without a launch (avulsa generation), the request body remains
  // the only source, same as before.
  const launchStyle = launch ? resolveLaunchStyle(launch) : null;
  const canonicalPrimaryColor = launchStyle?.primaryColor || primaryColor || "#FF5C00";
  const canonicalSecondaryColor = launchStyle?.secondaryColor || secondaryColor || "#E04E00";
  const canonicalFontChoice = launchStyle?.fontChoice || fontChoice || "montserrat";
  const canonicalStylePreset = launchStyle?.stylePreset || stylePreset || "dark-premium";

  /* ── REPLICATE mode: browser render available → skip arsenal, go straight to Claude ── */
  if (browserResult) {
    const replicateMsg = [
      prompt ? `BRIEFING / PRODUTO: ${prompt}` : "Replique fielmente a página de referência.",
      canonicalFactsLines,
      brandReference ? `MARCA: ${brandReference}` : "",
      expectations ? `SENSAÇÃO DESEJADA: ${expectations}` : "",
      `COR PRIMÁRIA DO PRODUTO: ${canonicalPrimaryColor}`,
      `FONTE PREFERIDA: ${canonicalFontChoice}`,
      launchStyle?.identityBlock || "",
      `\nURL DE REFERÊNCIA: ${referenceUrl}`,
      browserResult.title ? `TÍTULO DA PÁGINA: ${browserResult.title}` : "",
      (() => {
        const cleanHtml = browserResult.html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<svg[\s\S]*?<\/svg>/gi, "")
          .replace(/<!--[\s\S]*?-->/g, "")
          .replace(/\s{2,}/g, " ");
        const sectionCount = (cleanHtml.match(/<section/gi) || []).length;
        const mainBlocks = (cleanHtml.match(/<(section|main|article|header|footer)[^>]*>/gi) || []).length;
        return `ESTRUTURA DA PÁGINA: ${sectionCount} <section> tags, ${mainBlocks} blocos principais (section/main/article/header/footer) — replique EXATAMENTE essa quantidade, nem mais nem menos.\n\nHTML RENDERIZADO (pós-JS):\n${cleanHtml.slice(0, 60000)}`;
      })(),
    ].filter(Boolean).join("\n");

    const replicateImages = referenceScreenshot ? [referenceScreenshot] : [];

    let replicateGen: AsyncIterable<string>;
    try {
      replicateGen = await startStream(
        aiConfig,
        REPLICATE_SYSTEM,
        replicateMsg,
        20000,
        replicateImages.length > 0 ? replicateImages : undefined
      );
    } catch (e: unknown) {
      console.error("[replicate] API error:", e);
      const { status, message } = parseApiError(e, aiConfig.provider);
      await finalizeGeneration(generationId, false, message);
      return Response.json({ error: message }, { status });
    }

    // Stream started successfully — finalize as success
    void finalizeGeneration(generationId, true);
    return new Response(iterableToReadable(replicateGen), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  /* ── Step 0: Hydration (context extraction) ── */
  // Seeded with the canonical facts up front (not left at all-null) so that
  // if extractProductContext below throws before the merge runs,
  // `contextLines` further down still carries the launch's real product
  // identity instead of silently falling back to nothing (see launches
  // review item 3 — Promise.all failure path).
  let productContext: ProductContext = {
    productName: launch?.brandInfo.productName || null,
    niche: launch?.brandInfo.niche || null,
    mainBenefit: launch?.brandInfo.transformation || null,
    targetAudience: launch?.brandInfo.targetAudience || null,
    cta: null,
    tone: null,
  };

  try {
    const ctx = await extractProductContext(aiConfig, prompt);
    // Identity facts (who/what/for whom) come from the persisted launch
    // briefing, not from whatever the free-text prompt happens to say — a
    // launch for product A must not be usable to quietly generate a page
    // for product B just by typing a different name in the prompt (see
    // launches review item F). Task-specific instructions in `prompt`
    // (layout, tone, sections wanted) still flow through untouched.
    productContext = {
      ...ctx,
      productName: launch?.brandInfo.productName || ctx.productName,
      niche: launch?.brandInfo.niche || ctx.niche,
      targetAudience: launch?.brandInfo.targetAudience || ctx.targetAudience,
      mainBenefit: launch?.brandInfo.transformation || ctx.mainBenefit,
    };
  } catch (e) {
    console.error("[hydration] error:", e);
  }

  /* ── Step 1: Personalize (streaming) — freeform generation, no section catalog ── */
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
    // The copy document replaces AI-written copy, not the canonical product
    // facts — both are needed (see launches review item 3): without
    // `contextLines` here, a copy document that doesn't spell out the
    // product name/niche/audience left the page with none of it.
    contextLines,
    hasCopyDocument
      ? `\nDOCUMENTO DE COPY DO CLIENTE (use este texto exatamente nas seções — não invente copy nova):\n---\n${copyDocument.trim()}\n---`
      : "",
    `COR PRIMÁRIA: ${canonicalPrimaryColor}`,
    `COR SECUNDÁRIA: ${canonicalSecondaryColor}`,
    `FONTE: ${canonicalFontChoice}`,
    `ESTILO: ${canonicalStylePreset}`,
    launchStyle?.identityBlock || "",
    brandReference ? `MARCA DE REFERÊNCIA: ${brandReference}` : "",
    expectations ? `SENSAÇÃO DESEJADA: ${expectations}` : "",
    referenceContext,
    imagePart,
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
      hasCopyDocument ? COPY_MODE_SYSTEM : buildPersonalizeSystem(canonicalStylePreset, canonicalPrimaryColor),
      personalizeUserMsg,
      64000,
      allImages.length > 0 ? allImages : undefined
    );
  } catch (e: unknown) {
    console.error("[personalize] API error:", e);
    const { status, message } = parseApiError(e, aiConfig.provider);
    await finalizeGeneration(generationId, false, message);
    return Response.json({ error: message }, { status });
  }

  // Stream started successfully — finalize as success
  void finalizeGeneration(generationId, true);
  return new Response(iterableToReadable(gen), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
