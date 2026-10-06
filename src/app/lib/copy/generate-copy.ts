import { resolveConfig, callOnce, type AICallConfig } from "../ai-client";
import { CIALDINI_PRINCIPLES_BLOCK } from "./persuasion-principles";
import type { AdCopyFacts, AdCopyOption } from "./generate-ads";

/** Copy de Carrosséis e de Thumbs (YouTube). Mesmo formato de opção dos
 * anúncios (headline + cta + ângulo), com `slides` extra nos carrosséis. */

export type CopyKind = "carrossel" | "thumb";

const THUMB_TEXT_MAX = 32;
const THUMB_TAG_MAX = 18;
const CAROUSEL_COVER_MAX = 70;
const CAROUSEL_SLIDE_MAX = 130;
const CAROUSEL_CTA_MAX = 40;
const CAROUSEL_MIN_SLIDES = 4;
const CAROUSEL_MAX_SLIDES = 8;

const COMMON_RULES = `- Copy em Português Brasileiro. Zero emojis. Zero clichês vazios.
- PROIBIDO inventar números, resultados, depoimentos, garantia ou prazo que não estejam no briefing. Sem dado concreto, use uma versão genérica do ângulo, sem inserir número ou fato novo.
- Responda APENAS com JSON válido. Zero texto fora do JSON.`;

function angles(kind: CopyKind, facts: AdCopyFacts): string[] {
  const hasProof = Boolean(facts.provas?.trim());
  if (kind === "thumb") {
    return [
      "curiosidade", "resultado/transformação", "erro ou aviso", "contraste (antes e depois)",
      ...(hasProof ? ["prova social/número (baseado na prova fornecida)"] : ["pergunta direta"]),
      "desafio",
    ];
  }
  return [
    "dor específica", "transformação/resultado", "passo a passo/método", "lógica/objeção",
    ...(hasProof ? ["prova social/número (baseado na prova fornecida)"] : []),
  ];
}

function system(kind: CopyKind, facts: AdCopyFacts): string {
  const list = angles(kind, facts);
  if (kind === "thumb") {
    return `Você é um estrategista de thumbnails do YouTube para o mercado digital brasileiro. Gera o TEXTO que vai escrito na thumbnail, nunca o título do vídeo.

REGRAS:
- Gere ${list.length} opções, uma para cada ângulo, nesta ordem: ${list.join(", ")}.
- "headline": o texto principal da thumb, no máximo ${THUMB_TEXT_MAX} caracteres e 2 a 5 palavras, legível em tela de celular, forte e específico.
- "cta": um complemento curto opcional da thumb (selo, rótulo ou palavra de apoio, ex.: "NOVO", "PASSO A PASSO"), no máximo ${THUMB_TAG_MAX} caracteres; use string vazia se não agregar.
- Cada opção deve despertar curiosidade honesta: a thumb não pode prometer algo que o vídeo não entrega nem usar sensacionalismo enganoso.
${COMMON_RULES}
- Formato: {"options":[{"headline":"...","cta":"...","angle":"..."}]}

${CIALDINI_PRINCIPLES_BLOCK}`;
  }
  return `Você é um redator de carrosséis para Instagram do mercado digital brasileiro. Escreve o texto de cada slide, em sequência, para prender o leitor até o último.

REGRAS:
- Gere ${list.length} carrosséis, um para cada ângulo, nesta ordem: ${list.join(", ")}.
- "headline": o texto da CAPA (slide 1), no máximo ${CAROUSEL_COVER_MAX} caracteres, que faz a pessoa deslizar.
- "slides": de ${CAROUSEL_MIN_SLIDES} a ${CAROUSEL_MAX_SLIDES} textos curtos para os slides seguintes à capa, na ordem de leitura (um por slide), cada um com no máximo ${CAROUSEL_SLIDE_MAX} caracteres e uma única ideia. O último deve preparar a chamada para ação.
- "cta": o texto do slide final de chamada para ação, no máximo ${CAROUSEL_CTA_MAX} caracteres, no imperativo ou na primeira pessoa.
${COMMON_RULES}
- Formato: {"options":[{"headline":"...","slides":["..."],"cta":"...","angle":"..."}]}

${CIALDINI_PRINCIPLES_BLOCK}`;
}

function userMessage(facts: AdCopyFacts): string {
  return [
    `PRODUTO: ${facts.productName || "(não informado)"}`,
    `NICHO: ${facts.niche || "(não informado)"}`,
    facts.targetAudience ? `PÚBLICO-ALVO: ${facts.targetAudience}` : "",
    facts.transformation ? `TRANSFORMAÇÃO/BENEFÍCIO PRINCIPAL: ${facts.transformation}` : "",
    facts.price ? `PREÇO + ÂNCORA: ${facts.price}` : "",
    facts.provas ? `PROVAS E RESULTADOS (use exatamente estes, não invente outros): ${facts.provas}` : "",
    facts.tone ? `TOM DESEJADO: ${facts.tone}` : "",
  ].filter(Boolean).join("\n");
}

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function validateKindOptions(kind: CopyKind, raw: unknown): AdCopyOption[] {
  if (!Array.isArray(raw)) return [];
  const out: AdCopyOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const headline = text(o.headline);
    const cta = text(o.cta);
    const angle = text(o.angle);
    if (!headline || !angle) continue;
    if (kind === "thumb") {
      if (headline.length > THUMB_TEXT_MAX * 1.5 || cta.length > THUMB_TAG_MAX * 1.5) continue;
      out.push({ headline, cta, angle });
    } else {
      const slides = Array.isArray(o.slides) ? o.slides.map(text).filter(Boolean) : [];
      if (slides.length < CAROUSEL_MIN_SLIDES || !cta) continue;
      if (headline.length > CAROUSEL_COVER_MAX * 1.5 || cta.length > CAROUSEL_CTA_MAX * 1.5) continue;
      out.push({
        headline, cta, angle,
        slides: slides.slice(0, CAROUSEL_MAX_SLIDES).map((s) => s.slice(0, Math.round(CAROUSEL_SLIDE_MAX * 1.5))),
      });
    }
  }
  return out;
}

export async function generateKindCopy(
  kind: CopyKind,
  facts: AdCopyFacts,
  auth?: { apiKey?: string; aiProvider?: string; aiModel?: string },
): Promise<{ options: AdCopyOption[]; model: string }> {
  const aiConfig: AICallConfig = resolveConfig(auth?.apiKey, auth?.aiProvider, auth?.aiModel, "copy");
  const raw = await callOnce(aiConfig, system(kind, facts), userMessage(facts), kind === "carrossel" ? 3000 : 1024);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta inválida do modelo.");
  const options = validateKindOptions(kind, JSON.parse(match[0]).options);
  if (options.length === 0) throw new Error("O modelo não retornou opções válidas — tente de novo.");
  return { options, model: aiConfig.model || "" };
}
