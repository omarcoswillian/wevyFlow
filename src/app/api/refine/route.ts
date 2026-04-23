import Anthropic from "@anthropic-ai/sdk";
import { resolveConfig, iterableToReadable, parseApiError, startStream } from "../../lib/ai-client";

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 30;
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

function buildSystemPrompt(designContext?: { primaryColor?: string; secondaryColor?: string; fontChoice?: string; stylePreset?: string }): string {
  const base = `Voce e um engenheiro frontend senior. O usuario ja tem um layout HTML e quer refina-lo.

REGRAS:
1. Retorne APENAS HTML completo. ZERO texto, markdown, crases. Primeiro caractere = <
2. Retorne o codigo COMPLETO — nao apenas o trecho modificado.
3. Mantenha o que nao foi pedido para alterar EXATAMENTE como esta.
4. ZERO emojis. SVG icons apenas.

ANÁLISE DE IMAGENS:
Se o usuário enviar uma imagem (screenshot, referência, mockup), analise-a VISUALMENTE e:
- Identifique cores, tipografia, layout, espaçamento, componentes
- Replique o estilo visual da imagem no código
- Se for um screenshot de erro ou problema, corrija o que está visualmente errado
- Se for uma referência, adapte o layout atual para se parecer com a referência`;

  const tokens: string[] = [];
  if (designContext?.primaryColor && designContext?.secondaryColor) {
    tokens.push(`- Cor primaria do projeto: ${designContext.primaryColor}, secundaria: ${designContext.secondaryColor}`);
  }
  if (designContext?.fontChoice) {
    tokens.push(`- Fonte do projeto: ${designContext.fontChoice}`);
  }
  if (designContext?.stylePreset) {
    tokens.push(`- Estilo visual: ${designContext.stylePreset}`);
  }

  if (tokens.length > 0) {
    return base + `\n\nDESIGN CONTEXT DO PROJETO (respeite ao refinar):\n${tokens.join("\n")}`;
  }

  return base + `\n\nDESIGN TOKENS PADRAO:
- H1: Unbounded, 48px/32px mobile, weight 800
- Body: DM Sans, 16px, weight 400, line-height 1.7
- CTA: bg #FF5C00, texto branco uppercase, min-height 52px, radius 6px, hover glow laranja
- Cores: bg #0C0C0C, surface #161616, card #1E1E1E, texto #F5F5F5, secundario #999
- Secoes: py 80px desktop, alternando bg #0C0C0C e #161616
- Cards: bg #1E1E1E, border rgba(255,255,255,0.08), radius 12px, hover translateY(-2px)
- Contraste minimo 4.5:1. Texto sobre dark SEMPRE #F5F5F5 ou #999 (nunca abaixo)`;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip)) {
      return Response.json({ error: "Muitas requisicoes. Aguarde um minuto e tente novamente." }, { status: 429 });
    }

    const { originalCode, refinementRequest, platform, images, designContext, apiKey, aiProvider, aiModel } = await request.json();
    const aiConfig = resolveConfig(apiKey, aiProvider, aiModel);

    if (!originalCode || !refinementRequest) {
      return Response.json(
        { error: "Código original e pedido de refinamento são obrigatórios" },
        { status: 400 }
      );
    }

    // Compact the code to fit within token limits
    let compactCode = originalCode as string;

    // Minify CSS: collapse whitespace, remove comments
    compactCode = compactCode.replace(/\/\*[\s\S]*?\*\//g, ""); // remove CSS comments
    compactCode = compactCode.replace(/\s{2,}/g, " "); // collapse multi-spaces
    compactCode = compactCode.replace(/\n\s*\n/g, "\n"); // collapse blank lines

    // If still too large (>80k chars ~20k tokens), split CSS and body
    const MAX_CODE_CHARS = 80000;
    if (compactCode.length > MAX_CODE_CHARS) {
      // Extract and heavily compress CSS
      const styleMatch = compactCode.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      if (styleMatch) {
        let css = styleMatch[1];
        // Aggressive CSS minification
        css = css.replace(/\s*{\s*/g, "{").replace(/\s*}\s*/g, "}").replace(/\s*;\s*/g, ";").replace(/\s*:\s*/g, ":").replace(/\s*,\s*/g, ",");
        // Remove media queries for reduced-motion (not essential for refine)
        css = css.replace(/@media\s*\(prefers-reduced-motion[^}]*\{[^}]*\}\s*\}/g, "");
        compactCode = compactCode.replace(styleMatch[0], `<style>${css}</style>`);
      }

      // If STILL too large, truncate CSS keeping only first 15k chars of it
      if (compactCode.length > MAX_CODE_CHARS) {
        const styleMatch2 = compactCode.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        if (styleMatch2 && styleMatch2[1].length > 15000) {
          const truncatedCss = styleMatch2[1].slice(0, 15000) + "\n/* ... CSS truncado para caber no limite ... */";
          compactCode = compactCode.replace(styleMatch2[0], `<style>${truncatedCss}</style>`);
        }
      }
    }

    // Build message content - supports multimodal (text + images)
    const contentParts: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

    // Add images first if present (vision)
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
    contentParts.push({
      type: "text",
      text: `PLATAFORMA: ${platform || "html"}

CÓDIGO ATUAL DO LAYOUT:
${compactCode}

PEDIDO DO USUÁRIO: ${refinementRequest}
${images && images.length > 0 ? "\nO usuário enviou imagem(ns) acima como referência visual. Analise e aplique ao layout." : ""}

Retorne o código HTML/CSS COMPLETO com as alterações aplicadas.`,
    });

    const codeLength = compactCode.length;
    const maxTokens = codeLength > 40000 ? 32000 : 16000;

    // Build text message from contentParts
    const textPart = contentParts.find((p) => p.type === "text") as { type: "text"; text: string } | undefined;
    const userMsg = textPart?.text ?? `PEDIDO: ${refinementRequest}\n\nCÓDIGO:\n${compactCode}`;

    let gen: AsyncIterable<string>;
    try {
      gen = await startStream(aiConfig, buildSystemPrompt(designContext), userMsg, maxTokens);
    } catch (e: unknown) {
      const { status, message } = parseApiError(e, aiConfig.provider);
      return Response.json({ error: message }, { status });
    }

    return new Response(iterableToReadable(gen), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("Refine error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return Response.json({ error: message }, { status: 500 });
  }
}
