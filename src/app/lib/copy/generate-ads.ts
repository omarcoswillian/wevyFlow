import { resolveConfig, callOnce, type AICallConfig } from "../ai-client";
import { CIALDINI_PRINCIPLES_BLOCK } from "./persuasion-principles";

export interface AdCopyFacts {
  productName?: string;
  niche?: string;
  targetAudience?: string;
  transformation?: string;
  price?: string;
  provas?: string;
  tone?: string;
}

export interface AdCopyOption {
  headline: string;
  cta: string;
  angle: string;
  /** Só em carrosséis: textos dos slides depois da capa, na ordem. */
  slides?: string[];
}

const HEADLINE_MAX = 70;
const CTA_MAX = 25;

// Ângulos possíveis — "prova social/número" só entra na lista quando o
// briefing realmente fornece uma prova real (facts.provas). Sem isso, o
// modelo tende a inventar estatística ("340% de aumento") pra preencher o
// ângulo — ver achado do Codex na auditoria do loop de crítica.
function buildAngleList(facts: AdCopyFacts): string[] {
  const angles = ["transformação/resultado", "curiosidade", "dor específica", "lógica/objeção"];
  if (facts.provas?.trim()) angles.push("prova social/número (baseado na prova fornecida)");
  if (facts.price?.trim()) angles.push("oferta/preço");
  else angles.push("medo de perder (escassez genuína, sem inventar prazo)");
  return angles;
}

function buildSystem(facts: AdCopyFacts): string {
  const angles = buildAngleList(facts);
  return `Você é um redator publicitário especialista em anúncios pagos (Meta Ads, Google Ads) para o mercado digital brasileiro. Sua única tarefa é gerar pares de headline + CTA curtos e de alto impacto — nunca um anúncio completo, nunca um parágrafo.

REGRAS:
- Gere ${angles.length} pares, um pra cada um destes ângulos, nesta ordem: ${angles.join(", ")}.
- Headline: no máximo ${HEADLINE_MAX} caracteres, direto ao ponto, sem enrolação.
- CTA: no máximo ${CTA_MAX} caracteres, sempre na primeira pessoa ("Quero...", "Garantir...") ou imperativo curto ("Comece agora").
- Copy em Português Brasileiro. Zero emojis. Zero clichês vazios ("transforme sua vida", "não perca essa chance única").
- PROIBIDO inventar números, resultados, depoimentos, garantia ou prazo de escassez que não estejam no briefing fornecido. Se o briefing não tiver um dado concreto pra um ângulo, use uma variação genérica desse ângulo sem inventar o dado — nunca insira um número ou fato que não veio do briefing.
- Responda APENAS com JSON válido no formato: {"options":[{"headline":"...","cta":"...","angle":"..."}]}
- Zero texto fora do JSON.

${CIALDINI_PRINCIPLES_BLOCK}`;
}

function buildUserMessage(facts: AdCopyFacts): string {
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

/** Keeps only options with non-empty headline/cta/angle within length limits — the
 * previous version of this endpoint only checked `Array.isArray(options)`, letting
 * malformed or oversized entries (e.g. the model ignoring the char limits) through
 * to the UI untouched. */
function validateOptions(raw: unknown): AdCopyOption[] {
  if (!Array.isArray(raw)) return [];
  const valid: AdCopyOption[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const headline = typeof (item as Record<string, unknown>).headline === "string" ? (item as Record<string, unknown>).headline as string : "";
    const cta = typeof (item as Record<string, unknown>).cta === "string" ? (item as Record<string, unknown>).cta as string : "";
    const angle = typeof (item as Record<string, unknown>).angle === "string" ? (item as Record<string, unknown>).angle as string : "";
    if (!headline.trim() || !cta.trim() || !angle.trim()) continue;
    if (headline.length > HEADLINE_MAX * 1.5 || cta.length > CTA_MAX * 1.5) continue; // some slack over the instructed limit before we reject outright
    valid.push({ headline: headline.trim(), cta: cta.trim(), angle: angle.trim() });
  }
  return valid;
}

export async function generateAdCopy(
  facts: AdCopyFacts,
  auth?: { apiKey?: string; aiProvider?: string; aiModel?: string },
): Promise<{ options: AdCopyOption[]; model: string }> {
  const aiConfig: AICallConfig = resolveConfig(auth?.apiKey, auth?.aiProvider, auth?.aiModel, "copy");
  const raw = await callOnce(aiConfig, buildSystem(facts), buildUserMessage(facts), 1024);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Resposta inválida do modelo.");
  const parsed = JSON.parse(jsonMatch[0]);
  const options = validateOptions(parsed.options);
  if (options.length === 0) throw new Error("O modelo não retornou opções válidas — tente de novo.");
  return { options, model: aiConfig.model || "" };
}
