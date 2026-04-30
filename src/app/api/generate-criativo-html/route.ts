import { resolveConfig, startStream, iterableToReadable, parseApiError } from "../../lib/ai-client";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

const FORMAT_DIMS: Record<string, { w: number; h: number; platform: string; safeZone?: string }> = {
  "stories":           { w: 1080, h: 1920, platform: "Instagram Stories (9:16)", safeZone: "Texto: evite os primeiros e últimos 15% do frame (áreas cobertas pela UI do Stories)." },
  "feed-quadrado":     { w: 1080, h: 1080, platform: "Instagram / Facebook Feed (1:1)" },
  "feed-retrato":      { w: 1080, h: 1350, platform: "Instagram Feed Retrato (4:5)" },
  "youtube-thumbnail": { w: 1280, h: 720,  platform: "YouTube Thumbnail (16:9)" },
  "banner-horizontal": { w: 1200, h: 628,  platform: "Meta Ads / Google Display Banner" },
  "whatsapp":          { w: 1080, h: 1080, platform: "WhatsApp / Criativo Quadrado (1:1)" },
};

const FASE_CTX: Record<string, string> = {
  aquecimento: "FASE: AQUECIMENTO — Provoque curiosidade sem revelar o produto. Tom: intrigante, aspiracional. Sem preço, sem urgência.",
  lancamento:  "FASE: LANÇAMENTO — Produto revelado. Energia celebratória e alta. Destaque o benefício principal e o nome do produto.",
  urgencia:    "FASE: URGÊNCIA — Escassez real. Vermelho, countdown, pressão. O leitor precisa agir AGORA.",
  encerramento:"FASE: ENCERRAMENTO — Última chance. Tom emocional, perda iminente. CTA definitivo.",
};

const ESTILO_CTX: Record<string, string> = {
  bold:         "ESTILO: Bold — alto contraste, tipografia dominante, cores fortes, impacto visual máximo.",
  minimal:      "ESTILO: Minimal — espaço negativo generoso, tipografia refinada, elegância discreta.",
  professional: "ESTILO: Profissional — grid limpo, paleta corporativa, credibilidade e confiança.",
  colorful:     "ESTILO: Colorido — gradientes vibrantes, overlapping de formas, energia e alegria.",
};

function buildSystem(w: number, h: number): string {
  return `Você é um designer gráfico sênior especializado em criativos para redes sociais e marketing digital para infoprodutores brasileiros. Você cria peças que PARAM o scroll, comunicam em 2 segundos e convertem.

Retorne APENAS o HTML completo. Primeiro caractere: "<". Último: ">". Zero texto explicativo, zero markdown, zero crases.

DIMENSÕES ABSOLUTAS: ${w}×${h}px.
body { width:${w}px; height:${h}px; overflow:hidden; margin:0; padding:0; }
O criativo deve ser exatamente esse tamanho — sem scroll, sem elemento fora do frame.

REGRAS TÉCNICAS:
1. Uma única <link> de Google Fonts no <head> com <link rel="preconnect"> antes — NUNCA a fonte Unbounded
2. Todos os estilos em <style> no <head> — zero CSS inline exceto quando essencial
3. Zero JavaScript
4. Zero emojis — use formas SVG inline ou clip-path CSS
5. Fundo cobre 100% do frame (gradiente, cor sólida ou padrão)
6. Contraste de texto: mínimo 4.5:1 com o fundo

PADRÕES VISUAIS DE EXCELÊNCIA:
— Headlines: 80–160px, font-weight 800–900, letter-spacing -0.03em a -0.05em
— Textos de apoio: 28–48px, font-weight 300–400
— NUNCA use pesos médios (400–600) para headlines — pesos extremos criam impacto
— Elementos decorativos: SVG geométrico inline, gradientes radiais, clip-path, pseudo-elementos ::before/::after
— Profundidade: diferentes z-index, box-shadow, text-shadow, opacidade em camadas
— Composição intencional: hierarquia visual A→B→C (headline → benefício/prova → CTA)
— Cores: use a cor primária do briefing como dominante, não como detalhe
— CTA (quando solicitado): pill/badge destacado, contraste alto, font-weight 700+`;
}

function buildPrompt(
  w: number, h: number, platform: string, safeZone: string | undefined,
  produto: string, headline: string, cta: string,
  cor: string, estilo: string, fase: string,
  chatInstruction?: string,
  brandContext?: string,
): string {
  return [
    `FORMATO: ${platform} — ${w}×${h}px`,
    safeZone ? safeZone : "",
    FASE_CTX[fase] ?? "",
    ESTILO_CTX[estilo] ?? "",
    `COR PRIMÁRIA: ${cor || "#6c47ff"}`,
    produto   ? `PRODUTO / OFERTA: ${produto}` : "",
    headline  ? `HEADLINE (exibir com destaque máximo): "${headline}"` : "",
    cta       ? `CTA (botão ou badge de destaque): "${cta}"` : "",
    brandContext ? `\nIDENTIDADE VISUAL APROVADA:\n${brandContext}` : "",
    chatInstruction ? `\nINSTRUÇÃO ADICIONAL: ${chatInstruction}` : "",
    `\nGere um criativo HTML/CSS de altíssima qualidade de ${w}×${h}px para o formato ${platform}. O resultado deve ser uma peça profissional que compete com o melhor do mercado de infoprodutos.`,
  ].filter(Boolean).join("\n");
}

export async function POST(req: Request) {
  const {
    format,
    produto = "",
    headline = "",
    cta = "",
    cor = "#6c47ff",
    estilo = "bold",
    fase = "lancamento",
    chatInstruction,
    brandContext,
    apiKey,
    aiProvider,
    aiModel,
  } = await req.json();

  const hasBrief = headline?.trim() || produto?.trim() || chatInstruction?.trim();
  if (!hasBrief) {
    return Response.json({ error: "Preencha o headline ou produto." }, { status: 400 });
  }

  const dims = FORMAT_DIMS[format];
  if (!dims) {
    return Response.json({ error: "Formato inválido." }, { status: 400 });
  }

  if (!apiKey) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return Response.json({ error: "Faça login para gerar criativos." }, { status: 401 });
    } catch { /* non-blocking */ }
  }

  const aiConfig = resolveConfig(apiKey, aiProvider, aiModel);

  const system = buildSystem(dims.w, dims.h);
  const userMsg = buildPrompt(
    dims.w, dims.h, dims.platform, dims.safeZone,
    produto, headline, cta, cor, estilo, fase,
    chatInstruction, brandContext,
  );

  let gen: AsyncIterable<string>;
  try {
    gen = await startStream(aiConfig, system, userMsg, 8192);
  } catch (e: unknown) {
    const { status, message } = parseApiError(e, aiConfig.provider);
    return Response.json({ error: message }, { status });
  }

  return new Response(iterableToReadable(gen), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
