import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `Voce e um engenheiro frontend senior. O usuario ja tem um layout HTML e quer refina-lo.

REGRAS:
1. Retorne APENAS HTML completo. ZERO texto, markdown, crases. Primeiro caractere = <
2. Retorne o codigo COMPLETO — nao apenas o trecho modificado.
3. Mantenha o que nao foi pedido para alterar EXATAMENTE como esta.
4. ZERO emojis. SVG icons apenas.

DESIGN TOKENS:
- H1: Unbounded, 48px/32px mobile, weight 800
- Body: DM Sans, 16px, weight 400, line-height 1.7
- CTA: bg #FF5C00, texto branco uppercase, min-height 52px, radius 6px, hover glow laranja
- Cores: bg #0C0C0C, surface #161616, card #1E1E1E, texto #F5F5F5, secundario #999
- Secoes: py 80px desktop, alternando bg #0C0C0C e #161616
- Cards: bg #1E1E1E, border rgba(255,255,255,0.08), radius 12px, hover translateY(-2px)
- Contraste minimo 4.5:1. Texto sobre dark SEMPRE #F5F5F5 ou #999 (nunca abaixo)

ANÁLISE DE IMAGENS:
Se o usuário enviar uma imagem (screenshot, referência, mockup), analise-a VISUALMENTE e:
- Identifique cores, tipografia, layout, espaçamento, componentes
- Replique o estilo visual da imagem no código
- Se for um screenshot de erro ou problema, corrija o que está visualmente errado
- Se for uma referência, adapte o layout atual para se parecer com a referência`;

export async function POST(request: Request) {
  try {
    const { originalCode, refinementRequest, platform, images } = await request.json();

    if (!originalCode || !refinementRequest) {
      return Response.json(
        { error: "Código original e pedido de refinamento são obrigatórios" },
        { status: 400 }
      );
    }

    // Build message content - supports multimodal (text + images)
    const contentParts: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

    // Add images first if present (vision)
    if (images && Array.isArray(images) && images.length > 0) {
      for (const img of images) {
        if (img.base64 && typeof img.base64 === "string") {
          // Extract media type and data from data URL
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
${originalCode}

PEDIDO DO USUÁRIO: ${refinementRequest}
${images && images.length > 0 ? "\nO usuário enviou imagem(ns) acima como referência visual. Analise e aplique ao layout." : ""}

Retorne o código HTML/CSS COMPLETO com as alterações aplicadas.`,
    });

    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: contentParts }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Transfer-Encoding": "chunked" },
    });
  } catch (err) {
    console.error("Refine error:", err);
    const message = err instanceof Error ? err.message : "Erro interno";
    return Response.json({ error: message }, { status: 500 });
  }
}
