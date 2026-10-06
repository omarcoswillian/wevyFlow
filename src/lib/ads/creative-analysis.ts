import { GoogleGenAI } from "@google/genai";
import type { AdMetrics, Confidence, Verdict } from "./scoring";

/** Análise de um criativo de anúncio por IA multimodal (imagem, ou vídeo curto +
 * capa). A saída é estruturada: o que o criativo faz e hipóteses de teste para
 * novas imagens. As hipóteses NÃO são causas provadas. */

export interface CreativeHypothesis {
  title: string;
  /** Por que isso poderia melhorar o resultado (hipótese, não fato). */
  rationale: string;
  /** Instrução concreta de edição visual pra gerar a variação em imagem. */
  editInstruction: string;
}

export interface CreativeAnalysis {
  hook: string;
  promise: string;
  mechanism: string;
  proof: string;
  cta: string;
  visualStyle: string;
  textOnCreative: string;
  strengths: string[];
  weaknesses: string[];
  hypotheses: CreativeHypothesis[];
}

export interface AnalysisInput {
  mediaType: "image" | "video";
  still: { mimeType: string; data: string };
  video?: { mimeType: string; data: string } | null;
  headline: string | null;
  body: string | null;
  metrics?: AdMetrics | null;
  verdict?: Verdict | null;
  confidence?: Confidence | null;
}

export const ANALYSIS_MODEL = "gemini-2.5-flash";

const str = (v: unknown, max = 600): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v: unknown, max = 5): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, 300)).filter(Boolean).slice(0, max) : [];

export function sanitizeAnalysis(raw: unknown): CreativeAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const hypotheses: CreativeHypothesis[] = Array.isArray(r.hypotheses)
    ? r.hypotheses
        .map((h): CreativeHypothesis => {
          const o = (h ?? {}) as Record<string, unknown>;
          return { title: str(o.title, 120), rationale: str(o.rationale, 400), editInstruction: str(o.editInstruction, 600) };
        })
        .filter((h) => h.title && h.editInstruction)
        .slice(0, 3)
    : [];
  if (hypotheses.length === 0) return null;
  return {
    hook: str(r.hook), promise: str(r.promise), mechanism: str(r.mechanism), proof: str(r.proof),
    cta: str(r.cta), visualStyle: str(r.visualStyle), textOnCreative: str(r.textOnCreative, 800),
    strengths: strList(r.strengths), weaknesses: strList(r.weaknesses), hypotheses,
  };
}

function metricsLine(m: AdMetrics | null | undefined): string {
  if (!m) return "Sem dados de performance disponíveis.";
  const pct = (v: number | null) => (v === null ? "n/d" : `${(v * 100).toFixed(1)}%`);
  return [
    `gasto ${m.spend.toFixed(2)}`, `impressões ${m.impressions}`, `compras ${m.purchases}`,
    `ROAS ${m.roas === null ? "n/d" : m.roas.toFixed(2)}`, `CPA ${m.cpa === null ? "n/d" : m.cpa.toFixed(2)}`,
    `CTR ${pct(m.ctr)}`, ...(m.hookRate !== null ? [`hook rate ${pct(m.hookRate)}`, `retenção 25% ${pct(m.hold25)}`] : []),
  ].join(", ");
}

export async function analyzeCreative(client: GoogleGenAI, input: AnalysisInput): Promise<CreativeAnalysis> {
  const prompt = `Você é um diretor de arte e estrategista de performance de anúncios no Meta (infoprodutos, Brasil).
Analise este criativo de anúncio (${input.mediaType === "video" ? "um VÍDEO: veja os primeiros segundos e o conjunto; a imagem avulsa é a capa" : "uma IMAGEM"}).

Texto do anúncio: título "${input.headline ?? ""}"; corpo "${(input.body ?? "").slice(0, 600)}".
Performance no período: ${metricsLine(input.metrics)}. Classificação: ${input.verdict ?? "n/d"} (confiança ${input.confidence ?? "n/d"}).

Responda SOMENTE um JSON com exatamente estas chaves (textos curtos, em português do Brasil):
{
 "hook": "o que prende a atenção nos primeiros instantes",
 "promise": "a promessa central",
 "mechanism": "o mecanismo ou método apresentado (vazio se não houver)",
 "proof": "a prova usada (vazio se não houver)",
 "cta": "a chamada para ação",
 "visualStyle": "estilo visual: cores, composição, tipo de foto, tipografia",
 "textOnCreative": "texto visível na peça, copiado literalmente",
 "strengths": ["até 3 pontos fortes observáveis"],
 "weaknesses": ["até 3 fraquezas observáveis"],
 "hypotheses": [ exatamente 3 objetos { "title": "nome curto da hipótese", "rationale": "por que PODE melhorar o resultado (diga que é hipótese)", "editInstruction": "instrução imperativa e concreta de edição VISUAL da imagem para gerar a variação, mantendo o restante igual. Se envolver texto, escreva o texto novo exato." } ]
}
Regras: as 3 hipóteses devem testar mudanças diferentes (ex.: hook visual, clareza da promessa, prova, contraste/composição). Não invente números, resultados, depoimentos nem promessas de renda ou saúde que não estejam no criativo. Não afirme causalidade: use linguagem de hipótese.`;

  const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [{ text: prompt }];
  if (input.video) parts.push({ inlineData: input.video });
  parts.push({ inlineData: input.still });

  const result = await client.models.generateContent({
    model: ANALYSIS_MODEL,
    contents: [{ role: "user", parts }],
    config: { responseMimeType: "application/json" },
  });
  const text = (result.candidates?.[0]?.content?.parts ?? []).map((p) => (p as { text?: string }).text ?? "").join("").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
  } catch {
    throw new Error("A IA devolveu uma análise ilegível. Tente de novo.");
  }
  const clean = sanitizeAnalysis(parsed);
  if (!clean) throw new Error("A IA não devolveu hipóteses utilizáveis. Tente de novo.");
  return clean;
}
