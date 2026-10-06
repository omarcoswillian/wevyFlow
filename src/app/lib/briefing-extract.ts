import { resolveConfig, callOnce } from "./ai-client";
import { BRIEFING_LIMITS } from "./launch-briefing";

/** Extrai o briefing do lançamento a partir de texto livre (e, se houver, do texto de
 * um documento ou página de vendas). Só preenche o que está no texto: o que não
 * aparece volta vazio, nunca inventado. */

export const LAUNCH_TYPE_OPTIONS = ["Perpétuo", "Semente", "Interno", "Externo", "Afiliados", "Pago / VSL"] as const;

export interface ExtractedBriefing {
  productName: string;
  niche: string;
  targetAudience: string;
  transformation: string;
  mecanismo: string;
  preco: string;
  provas: string;
  launchType: string;
}

const SYSTEM = `Você organiza o briefing de um lançamento digital brasileiro a partir do que o cliente escreveu.

REGRAS:
- Use SOMENTE o que está no texto. Se uma informação não aparece, devolva string vazia. NUNCA invente produto, número, preço, resultado, depoimento ou público.
- Copie números, preços e nomes exatamente como aparecem.
- Escreva em português do Brasil, de forma curta e direta, sem emojis.
- "productName": nome do produto, curso ou método (não a frase inteira).
- "niche": área em poucas palavras (ex.: emagrecimento feminino, finanças pessoais).
- "targetAudience": quem é o público e em que momento está.
- "transformation": a promessa, a transformação que o produto entrega e em quanto tempo, se dito.
- "mecanismo": o método ou diferencial que explica por que funciona.
- "preco": preço, âncora, parcelas, bônus e garantia, se citados.
- "provas": resultados, números, depoimentos e credenciais citados.
- "launchType": um destes, só se o texto indicar claramente: ${LAUNCH_TYPE_OPTIONS.join(", ")}. Senão, string vazia.
- Responda APENAS com um JSON válido com exatamente essas chaves, sem texto fora dele.`;

const clean = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function sanitizeExtraction(raw: unknown): ExtractedBriefing {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const launchType = clean(r.launchType, BRIEFING_LIMITS.launchType);
  return {
    productName: clean(r.productName, BRIEFING_LIMITS.productName),
    niche: clean(r.niche, BRIEFING_LIMITS.niche),
    targetAudience: clean(r.targetAudience, BRIEFING_LIMITS.targetAudience),
    transformation: clean(r.transformation, BRIEFING_LIMITS.transformation),
    mecanismo: clean(r.mecanismo, BRIEFING_LIMITS.mecanismo),
    preco: clean(r.preco, BRIEFING_LIMITS.preco),
    provas: clean(r.provas, BRIEFING_LIMITS.provas),
    launchType: (LAUNCH_TYPE_OPTIONS as readonly string[]).includes(launchType) ? launchType : "",
  };
}

export async function extractBriefing(input: { text: string; document?: string }): Promise<ExtractedBriefing> {
  const user = [
    "TEXTO DO CLIENTE:",
    input.text.slice(0, 6000),
    input.document?.trim() ? `\nDOCUMENTO OU PÁGINA ENVIADOS (use para completar o que o texto não diz):\n${input.document.slice(0, 12000)}` : "",
  ].join("\n");
  const raw = await callOnce(resolveConfig(undefined, undefined, undefined, "copy"), SYSTEM, user, 1500);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("A IA devolveu uma resposta ilegível. Tente de novo.");
  return sanitizeExtraction(JSON.parse(match[0]));
}
