import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { COMPONENT_LIBRARY, getComponentCatalog } from "../../lib/components";

const anthropic = new Anthropic();

const PLATFORM_INSTRUCTIONS: Record<string, string> = {
  html: `FORMATO: HTML + CSS autossuficiente. Tag <style> no início. Google Fonts via @import. CSS custom properties. Funciona copiado em qualquer .html. SEM CDNs, Bootstrap, Tailwind CDN.`,
  elementor: `FORMATO: HTML + CSS para widget "HTML Personalizado" do Elementor. <style> no início. Google Fonts ok. SEM <html>/<head>/<body>. Prefixe classes com "wf-el-". Unidades relativas. SEM CDNs externas.`,
  webflow: `FORMATO: HTML + CSS para "Embed" do Webflow. <style> no início. Google Fonts ok. SEM <html>/<head>/<body>. Prefixe classes com "wf-custom-". Unidades relativas. SEM CDNs externas.`,
};

const FONT_MAP: Record<string, string> = {
  sora: "Sora:wght@300;400;500;600;700;800",
  inter: "Inter:wght@300;400;500;600;700",
  poppins: "Poppins:wght@300;400;500;600;700;800",
  montserrat: "Montserrat:wght@300;400;500;600;700;800",
  "playfair": "Playfair+Display:wght@400;500;600;700;800",
  "space-grotesk": "Space+Grotesk:wght@300;400;500;600;700",
};

const STYLE_INSTRUCTIONS: Record<string, string> = {
  "dark-premium": `ESTILO: Dark Premium.
- Background: #07070a com glows radiais sutis (radial-gradient com a cor primária em 8-15% opacidade, blur 100-150px).
- Texto: rgba(255,255,255,0.93) headlines, rgba(255,255,255,0.55) body.
- Cards/surfaces: rgba(255,255,255,0.03), border rgba(255,255,255,0.06).
- Acento: gradiente usando as cores primária→secundária em CTAs e badges.`,

  "light-clean": `ESTILO: Light Clean.
- Background: #fafafa ou #ffffff.
- Texto: #0f0f0f headlines, #555 body.
- Cards: white com border #e5e5e5, sombra sutil (0 1px 3px rgba(0,0,0,0.04)).
- Acento: cor primária pura em CTAs. Sem gradientes no fundo.`,

  glassmorphism: `ESTILO: Glassmorphism.
- Background: gradiente suave e colorido (usando primária e secundária em baixa opacidade).
- Cards: background rgba(255,255,255,0.08), backdrop-filter: blur(24px), border rgba(255,255,255,0.12).
- Tudo translúcido e etéreo. Formas orgânicas no fundo com blur alto.`,

  "neon-tech": `ESTILO: Neon Tech.
- Background: #050510 (quase preto azulado).
- Glows neon com a cor primária (box-shadow: 0 0 40px rgba(cor,0.4), 0 0 80px rgba(cor,0.15)).
- Texto: branco brilhante. Linhas de grade sutis no fundo (grid pattern com opacidade 0.03).
- CTAs com glow intenso no hover. Sensação cyberpunk.`,

  luxury: `ESTILO: Luxury.
- Background: #0c0a09 (preto quente) ou #faf9f7 (creme).
- Cor de acento: dourado (#c5a44e) para detalhes, borders, ícones.
- Tipografia: serif para headlines (Playfair Display), sans para body.
- Espaçamento EXTREMAMENTE generoso. Borders finas e douradas. Sensação de hotel 5 estrelas.`,

  brutalist: `ESTILO: Brutalist.
- Fundos contrastantes: preto puro #000 ou branco puro #fff.
- Tipografia ENORME (clamp(4rem, 8vw, 8rem)), sem medo de ser gigante.
- Border-radius: 0px. Tudo angular. Borders grossas (2-3px).
- Cores primárias usadas em blocos sólidos. Mix de mono e cor. Bold e cru.`,
};

const SYSTEM_PROMPT = `Voce e um engenheiro de frontend senior especializado em landing pages de alta conversao para infoprodutores brasileiros. Seu padrao de qualidade visual e equivalente ao da ferramenta Lovable, com componentes no nivel shadcn/ui e design system do Linear/Stripe, adaptado para o mercado digital brasileiro.

REGRAS INVIOLAVEIS:
1. Retorne APENAS HTML completo. ZERO texto explicativo, markdown, crases. Primeiro caractere = <
2. Se uma REFERENCIA HTML foi fornecida, replique-a fielmente. Referencia e lei.
3. ZERO emojis. Nunca. Use SVG icons.
4. O sistema WavyFlow ja injeta automaticamente o design system Prymo LP com CSS variables. USE as variaveis CSS.

═══ DESIGN SYSTEM PRYMO LP (use SEMPRE estas variaveis) ═══

O sistema ja injeta as seguintes CSS variables. USE-AS no seu HTML:

CORES: var(--bg-primary) #0C0C0C | var(--bg-surface) #161616 | var(--bg-card) #1E1E1E | var(--text-primary) #F5F5F5 | var(--text-secondary) #999 | var(--text-muted) #666 | var(--accent) #FF5C00 | var(--accent-hover) #E04E00 | var(--accent-glow) rgba(255,92,0,0.35) | var(--highlight) #FFCC00 | var(--success) #22C55E | var(--border) rgba(255,255,255,0.08) | var(--border-hover) rgba(255,92,0,0.3)

FONTES: var(--font-display) Unbounded | var(--font-body) DM Sans
TAMANHOS: var(--text-hero) clamp(32px,5vw,56px) | var(--text-h2) clamp(22px,3vw,32px) | var(--text-h3) 18px | var(--text-body) 16px | var(--text-cta) 16px | var(--text-small) 13px
ESPACAMENTO: var(--section-y) clamp(56px,8vw,96px) | var(--container) 1100px | var(--card-pad) 28px | var(--gap-cards) 20px
BORDAS: var(--radius-card) 12px | var(--radius-btn) 6px | var(--radius-badge) 20px
EFEITOS: var(--shadow-cta) | var(--transition)

CLASSES PRE-DEFINIDAS (ja existem no CSS injetado):
- .container — max-width + padding
- .section / .section-alt — padding vertical + fundo alternado
- .badge / .badge-highlight — badges padrao
- .btn-cta — botao CTA laranja completo (hover, glow, mobile full-width)
- .btn-sec — botao secundario outline
- .card — card com hover translateY
- .check — icone de check verde circular
- .reveal / .rd1-rd5 — scroll animation com delays
- h1/h2/h3 — tipografia automatica

EXEMPLO DE USO:
<section class="section"><div class="container">
  <span class="badge reveal">Novo</span>
  <h2 class="reveal rd1" style="margin-bottom:48px">Headline</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--gap-cards)">
    <div class="card reveal rd1">...</div>
    <div class="card reveal rd2">...</div>
    <div class="card reveal rd3">...</div>
  </div>
</div></section>

═══ ESTRUTURA (ordem obrigatoria) ═══
1. HERO — headline + sub + CTA + prova social rapida
2. AUTORIDADE — numeros, logos midia, selos
3. PARA QUEM E — grid avatares + descricao
4. O QUE E — explicacao direta 3-5 linhas
5. PILARES/MODULOS — cards com icone+titulo+desc
6. PROVA SOCIAL — depoimentos com foto+nome+nicho+resultado
7. ESPECIALISTA — foto+bio+numeros
8. GARANTIA — destaque visual, prazo
9. OFERTA — ancora preco, CTA final
10. FAQ — 6-8 perguntas accordion
11. FOOTER — CNPJ, links legais, copyright

═══ QUALIDADE INEGOCIAVEL ═══
- Contraste minimo 4.5:1 (body), 3:1 (H1/H2)
- NUNCA Lorem Ipsum. Copy real ou [INSERIR: descricao]
- CTA acima da dobra + repetir a cada 2-3 secoes
- Hover em cards (translateY -2px), hover em botoes (glow laranja)
- Divisor secoes: border-top 1px rgba(255,255,255,0.06) OU fundo alternado #0C0C0C / #161616
- Meta tags: title, description, og:image
- ZERO emojis. SVG icons apenas.
- Quando tiver imagem do usuario, USE como <img> com object-fit:cover
- Quando NAO tiver, use placeholder com bg-card + texto descritivo centralizado`;


// Brand design knowledge
const BRAND_STYLES: Record<string, string> = {
  apple: "Apple: minimalismo extremo, espaço negativo, tipografia fina body / bold headlines, monocromático com único acento, fotos enormes, menos é mais.",
  nike: "Nike: bold/energético, tipografia condensada uppercase gigante, preto/branco + acento vibrante, assimétrico, muito contraste.",
  stripe: "Stripe: gradientes coloridos suaves, clean, espaçamento generoso, roxo/azul, glassmorphism, animações fluidas.",
  nubank: "Nubank: roxo principal, fundo escuro com glow roxo, bold e minimalista, acentos magenta.",
  linear: "Linear: ultra-minimalista, dark mode, gradientes sutis, UI extremamente limpa, espaçamento pixel-perfect.",
  vercel: "Vercel: preto puro, branco, gradientes iridescentes sutis, tipografia geométrica, espaçamento cinematográfico.",
  tesla: "Tesla: fundo escuro, fotos full-width, tipografia fina, CTAs sutis, luxo tecnológico, pouquíssimo texto.",
  spotify: "Spotify: gradientes vibrantes, dark mode, tipografia bold arredondada, cards com imagens, jovem e dinâmico.",
  claude: "Claude/Anthropic: tons terrosos (bege/amber), tipografia elegante, bordas suaves, inteligência e confiança.",
  framer: "Framer: animações fluidas, dark mode premium, gradientes sutis, micro-interações em tudo, minimalismo funcional.",
};

// Select relevant components based on the user prompt (max ~5 components)
function selectRelevantComponents(prompt: string, hasReference: boolean): string {
  if (hasReference) return ""; // reference overrides components

  const p = prompt.toLowerCase();
  const selected: string[] = [];

  // Always include a header
  if (p.includes("escur") || p.includes("dark") || p.includes("noite")) {
    selected.push("header-dark");
  } else if (p.includes("foto") || p.includes("imagem") || p.includes("mentor")) {
    selected.push("header-transparent");
  } else {
    selected.push("header-clean");
  }

  // Hero
  if (p.includes("captura") || p.includes("lead") || p.includes("formulário") || p.includes("inscri")) {
    if (p.includes("infoprodu") || p.includes("luana") || p.includes("execu") || p.includes("conversao extrema") || p.includes("formulario completo") || p.includes("split") || p.includes("cards flutuantes")) {
      selected.push("urgency-bar-countdown");
      selected.push("header-captura-clean");
      selected.push("hero-captura-split");
      selected.push("float-cards-social-proof");
      selected.push("footer-legal-minimal");
    } else if (p.includes("foto") || p.includes("mentor") || p.includes("escur") || p.includes("dark")) {
      selected.push("hero-dark-photo");
    } else {
      selected.push("hero-mentor-form");
    }
  } else if (p.includes("saas") || p.includes("dashboard") || p.includes("software") || p.includes("app")) {
    selected.push("hero-split-light");
  } else if (p.includes("lançamento") || p.includes("lancamento") || p.includes("venda")) {
    selected.push("hero-split-light");
  } else {
    selected.push("hero-centered-light");
  }

  // Features/benefits
  if (p.includes("feature") || p.includes("benefício") || p.includes("recurso") || p.includes("módulo") || p.includes("completa") || p.includes("venda")) {
    selected.push("features-grid");
  }

  // Sections based on keywords
  if (p.includes("depoimento") || p.includes("testemunho") || p.includes("review") || p.includes("completa") || p.includes("venda")) {
    selected.push("testimonials-cards");
  }
  if (p.includes("preço") || p.includes("plano") || p.includes("pricing") || p.includes("completa")) {
    selected.push("pricing-3col");
  }
  if (p.includes("urgência") || p.includes("countdown") || p.includes("timer") || p.includes("lançamento")) {
    selected.push("urgency-bar");
  }
  if (p.includes("garantia")) {
    selected.push("guarantee-section");
  }
  if (p.includes("stat") || p.includes("número") || p.includes("prova social") || p.includes("logo")) {
    selected.push("social-proof-logos");
    selected.push("stats-bar");
  }

  // Always add footer + CTA for full pages
  if (p.includes("completa") || p.includes("landing") || p.includes("página")) {
    selected.push("cta-dark");
    selected.push("footer-full");
  }

  // Deduplicate and limit to 6 max
  const unique = [...new Set(selected)].slice(0, 6);

  return unique
    .map(id => COMPONENT_LIBRARY[id])
    .filter(Boolean)
    .join("\n\n");
}

function enrichBrandContext(brand: string): string {
  const normalized = brand.toLowerCase().trim();
  for (const [key, desc] of Object.entries(BRAND_STYLES)) {
    if (normalized.includes(key)) return desc;
  }
  return `Aplique a essência visual da marca "${brand}": paleta, tipografia, sofisticação, tom emocional.`;
}

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    // Block internal/private IPs and reserved hosts
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
  if (!isAllowedUrl(url)) {
    console.warn("[WavyFlow] URL bloqueada por SSRF protection:", url);
    return null;
  }
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html",
      },
      redirect: "follow",
    });

    if (!res.ok) return null;

    const html = await res.text();

    // Limit total extraction to 8000 chars to avoid token overflow
    const maxLen = 8000;
    let extracted = "";

    // Extract <style> tags (key for colors and layout)
    const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi);
    if (styleMatches) {
      extracted += "/* CSS */\n" + styleMatches.join("\n").slice(0, 3000) + "\n\n";
    }

    // Clean body — remove noise aggressively
    let bodyHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<svg[\s\S]*?<\/svg>/gi, "")
      .replace(/<img[^>]*>/gi, "[IMG]")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
      .replace(/<video[\s\S]*?<\/video>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<path[^>]*>/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n");

    // Get body
    const bodyMatch = bodyHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      extracted += "/* HTML */\n" + bodyMatch[1].slice(0, maxLen - extracted.length);
    } else {
      extracted += bodyHtml.slice(0, maxLen - extracted.length);
    }

    // Font links
    const linkMatches = html.match(/<link[^>]*href="[^"]*font[^"]*"[^>]*>/gi);
    if (linkMatches) {
      extracted = "/* FONTS */\n" + linkMatches.slice(0, 3).join("\n") + "\n\n" + extracted;
    }

    return extracted;
  } catch {
    return null;
  }
}

// Simple in-memory rate limiter (per-process, resets on deploy)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20; // requests per window
const RATE_LIMIT_WINDOW = 60_000; // 1 minute

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

// Rough token estimate (~4 chars per token for mixed content)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const MAX_INPUT_TOKENS = 40000;

export async function POST(request: Request) {
  try {
    // Rate limiting
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip)) {
      return Response.json({ error: "Muitas requisicoes. Aguarde um minuto e tente novamente." }, { status: 429 });
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
    } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return Response.json({ error: "Prompt é obrigatório" }, { status: 400 });
    }

    const platformKey = platform || "html";
    const platformInstructions =
      PLATFORM_INSTRUCTIONS[platformKey] || PLATFORM_INSTRUCTIONS.html;

    // Build context
    const ctx: string[] = [];

    // Reference — fetch actual HTML (FIRST — highest priority)
    let hasReference = false;
    if (referenceUrl) {
      const refHTML = await fetchReferenceHTML(referenceUrl);
      if (refHTML) {
        hasReference = true;
        ctx.push(
          `═══ PÁGINA DE REFERÊNCIA (código real da URL: ${referenceUrl}) ═══
INSTRUÇÃO CRÍTICA — PRIORIDADE MÁXIMA:
O código abaixo é o HTML/CSS REAL da página de referência. Você DEVE:
1. REPLICAR a mesma paleta de cores (extraia do CSS — background-color, color, etc.)
2. REPLICAR a mesma estrutura de layout (se é fundo branco, use branco. Se é dark, use dark.)
3. REPLICAR a mesma tipografia e hierarquia
4. REPLICAR o mesmo espaçamento e padding
5. REPLICAR os mesmos tipos de componentes (navbar, hero, cards, stats, etc.)
6. IGNORAR qualquer preset de estilo/cor configurado — a referência tem prioridade absoluta.

Adapte APENAS o conteúdo textual para o que o usuário pediu.
NÃO invente um estilo diferente. NÃO mude dark para light ou vice-versa.
SE a referência tem fundo branco, o output DEVE ter fundo branco.
SE a referência tem fundo escuro, o output DEVE ter fundo escuro.

${refHTML}`
        );
      } else {
        ctx.push(
          `REFERÊNCIA: ${referenceUrl} (não foi possível acessar — use o domínio como inspiração).`
        );
      }
    }

    // Colors — only apply if NO reference URL was fetched
    if (!hasReference && (primaryColor || secondaryColor)) {
      ctx.push(
        `CORES DO PROJETO:\n- Cor primária: ${primaryColor || "#a78bfa"}\n- Cor secundária: ${secondaryColor || "#6366f1"}\nUse estas cores como --color-primary e --color-secondary.`
      );
    }

    // Font — only apply if NO reference URL was fetched
    if (!hasReference) {
      const fontKey = fontChoice || "sora";
      const fontImport = FONT_MAP[fontKey] || FONT_MAP.sora;
      const fontFamily = fontKey === "playfair" ? "Playfair Display" : fontKey === "space-grotesk" ? "Space Grotesk" : fontKey.charAt(0).toUpperCase() + fontKey.slice(1);
      ctx.push(
        `FONTE: Use @import url('https://fonts.googleapis.com/css2?family=${fontImport}&display=swap');\nfont-family: '${fontFamily}', sans-serif; para headlines.\nfont-family: 'Inter', sans-serif; para body.`
      );
    }

    // Style preset — only apply if NO reference URL was fetched
    if (!hasReference) {
      const styleInst = STYLE_INSTRUCTIONS[stylePreset || "dark-premium"] || STYLE_INSTRUCTIONS["dark-premium"];
      ctx.push(styleInst);
    }

    // Images
    if (images && Array.isArray(images) && images.length > 0) {
      const imageList = images
        .map((img: { name: string; base64: string }, i: number) => `Imagem ${i + 1} ("${img.name}"): ${img.base64.slice(0, 80)}...`)
        .join("\n");
      ctx.push(
        `IMAGENS DO CLIENTE (${images.length} imagens fornecidas):\n${imageList}\n\nUse estas imagens DIRETAMENTE no layout via <img src="BASE64_COMPLETO">. Aplique object-fit:cover, border-radius, sombra sofisticada. Posicione de forma que valorizem o layout (hero image, foto de produto, avatar, etc).`
      );
      // We'll inject full base64 in the user message for the AI to use
    }

    // (reference already handled above — do not duplicate)
    if (brandReference) {
      ctx.push(`BRAND: ${enrichBrandContext(brandReference)}`);
    }
    if (expectations) {
      ctx.push(`SENSAÇÃO: "${expectations}" — cada elemento visual deve reforçar essa sensação imediatamente.`);
    }

    const contextBlock = ctx.join("\n\n");

    // Check if prompt is ONLY a capture page (not a full landing page)
    const p = prompt.toLowerCase();
    const isFullPage = p.includes("completa") || p.includes("landing page") || p.includes("todas as") || p.includes("11 secoes") || p.includes("secoes obrigatoria");
    const isCaptura = !isFullPage && (p.includes("captura") || p.includes("inscri") || p.includes("lead") || p.includes("formulario") || p.includes("pre-inscri"));
    const isLancamento = isCaptura; // Only use ready template for capture pages, not full LPs

    let readyTemplateBlock = "";
    if (isLancamento && !hasReference) {
      try {
        const templateHtml = readFileSync(join(process.cwd(), "src/app/lib/ready-templates/captura-premium.html"), "utf-8");
        readyTemplateBlock = `\n\n═══ TEMPLATE BASE PRONTO (ALTA QUALIDADE) ═══
INSTRUCAO CRITICA: O HTML abaixo e um template premium hand-crafted. Voce DEVE usa-lo como base.
NAO gere do zero. CUSTOMIZE este template:
1. Altere os TEXTOS (headline, subtitle, labels, botao) para o que o usuario pediu
2. Altere as CORES se o usuario especificou outras
3. Mantenha TODA a estrutura HTML/CSS intacta — ela ja esta perfeita
4. Se o usuario enviou foto, substitua o div.photo-placeholder por <img src="foto_base64" class="hero-right-photo">
5. Retorne o template completo com as customizacoes aplicadas

TEMPLATE:
${templateHtml}
═══ FIM DO TEMPLATE ═══`;
      } catch {}
    }

    // Select relevant components only if no ready template
    const selectedComponents = !readyTemplateBlock ? selectRelevantComponents(prompt, hasReference) : "";
    const componentBlock = selectedComponents
      ? `\n\n═══ COMPONENTES BASE ═══\n${selectedComponents}\n═══ FIM ═══`
      : "";

    // Build multimodal message content
    const contentParts: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

    // Add images as vision content blocks (NOT as text)
    if (images && Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (img.base64 && typeof img.base64 === "string") {
          const match = img.base64.match(/^data:(image\/[^;]+);base64,(.+)$/);
          if (match) {
            contentParts.push({
              type: "image",
              source: {
                type: "base64",
                media_type: match[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: match[2],
              },
            });
          }
        }
      }
    }

    // Add text content
    const hasImages = images && Array.isArray(images) && images.length > 0;
    contentParts.push({
      type: "text",
      text: `${platformInstructions}\n\n${contextBlock}${readyTemplateBlock}${componentBlock}\n\n--- PEDIDO ---\n${prompt}${hasImages ? "\n\nO usuario enviou imagem(ns) acima. Se forem fotos de referencia visual, replique o estilo. Se forem fotos de produto/pessoa, use-as no layout via <img> tag." : ""}${readyTemplateBlock ? "\n\nIMPORTANTE: Use o TEMPLATE BASE PRONTO fornecido acima. Apenas customize os textos para o pedido do usuario. NAO gere do zero." : "\n\nCrie a pagina usando Tailwind CSS. Resultado: pagina COMPLETA e funcional em portugues."}`,
    });

    // Estimate tokens to prevent API failures
    const textContent = contentParts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
    const estimatedTokens = estimateTokens(SYSTEM_PROMPT + textContent);
    const imageCount = contentParts.filter((p) => p.type === "image").length;
    // Each image ~1600 tokens (Claude vision estimate)
    const totalEstimate = estimatedTokens + imageCount * 1600;

    if (totalEstimate > MAX_INPUT_TOKENS) {
      return Response.json(
        { error: `Entrada muito grande (~${Math.round(totalEstimate / 1000)}k tokens). Reduza o tamanho da referencia, imagens ou prompt.` },
        { status: 400 }
      );
    }

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: contentParts,
        },
      ],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("Generate error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return Response.json({ error: message }, { status: 500 });
  }
}
