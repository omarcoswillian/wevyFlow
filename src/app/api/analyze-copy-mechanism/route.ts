import { createClient } from "@/lib/supabase/server";
import { resolveConfig, callOnce, parseApiError } from "../../lib/ai-client";

interface SlideInput {
  slideNumber: number;
  text: string;
}

interface CopyMechanismSlide {
  slideNumber: number;
  role: string;
  summary: string;
}

interface CopyMechanismAnalysis {
  framework: string;
  hook: { type: string; description: string };
  targetPain: string;
  coreMechanism: string;
  objectionHandled: string;
  proof: string;
  offer: string;
  tone: string;
  slides: CopyMechanismSlide[];
}

const MAX_SLIDES = 10;
const MAX_SLIDE_TEXT_CHARS = 2_000;
const SLIDE_ROLES = [
  "hook", "problem", "agitation", "mechanism", "proof",
  "objection", "offer", "cta", "transition", "other",
] as const;

export const maxDuration = 30;

const SYSTEM_PROMPT = `Você é um estrategista de copywriting e growth sênior, especialista em dissecar a mecânica de venda por trás de posts e carrosséis de redes sociais.

Sua tarefa é analisar a copy de um carrossel, slide por slide, e descrever a ESTRUTURA persuasiva usada — o que cada slide está fazendo dentro do funil de convencimento — para que essa mesma mecânica possa depois ser reaplicada a um produto e público completamente diferentes.

Regras:
- Não corrija, não opine e não avalie a qualidade da copy.
- Descreva a função de cada slide, não o conteúdo literal (evite copiar frases inteiras de volta).
- Se a sequência corresponder claramente a um framework de copywriting conhecido (PAS, AIDA, StoryBrand, PASTOR, 4Ps, Before-After-Bridge, Hook-Retain-Reward, etc.), nomeie-o no campo "framework". Se não corresponder a nenhum com precisão, use "custom" e descreva a lógica própria em "coreMechanism".
- O campo "role" de cada slide deve ser exatamente um destes valores: ${SLIDE_ROLES.join(", ")}.

Responda SOMENTE com um JSON válido, sem markdown, sem texto antes ou depois, no formato exato:
{
  "framework": string,
  "hook": { "type": string, "description": string },
  "targetPain": string,
  "coreMechanism": string,
  "objectionHandled": string,
  "proof": string,
  "offer": string,
  "tone": string,
  "slides": [ { "slideNumber": number, "role": string, "summary": string } ]
}`;

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function isValidRole(role: unknown): role is string {
  return typeof role === "string" && (SLIDE_ROLES as readonly string[]).includes(role);
}

function parseAnalysis(raw: string, validSlideNumbers: Set<number>): CopyMechanismAnalysis | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  const hook = p.hook && typeof p.hook === "object" ? p.hook as Record<string, unknown> : {};
  const rawSlides = Array.isArray(p.slides) ? p.slides as Record<string, unknown>[] : [];

  const slides = rawSlides
    .filter(s => typeof s.slideNumber === "number" && validSlideNumbers.has(s.slideNumber) && isValidRole(s.role))
    .map(s => ({
      slideNumber: s.slideNumber as number,
      role: s.role as string,
      summary: typeof s.summary === "string" ? s.summary.slice(0, 300) : "",
    }))
    .sort((a, b) => a.slideNumber - b.slideNumber);

  if (slides.length === 0) return null;

  return {
    framework: typeof p.framework === "string" ? p.framework.slice(0, 80) : "custom",
    hook: {
      type: typeof hook.type === "string" ? hook.type.slice(0, 80) : "",
      description: typeof hook.description === "string" ? hook.description.slice(0, 300) : "",
    },
    targetPain: typeof p.targetPain === "string" ? p.targetPain.slice(0, 300) : "",
    coreMechanism: typeof p.coreMechanism === "string" ? p.coreMechanism.slice(0, 300) : "",
    objectionHandled: typeof p.objectionHandled === "string" ? p.objectionHandled.slice(0, 300) : "",
    proof: typeof p.proof === "string" ? p.proof.slice(0, 300) : "",
    offer: typeof p.offer === "string" ? p.offer.slice(0, 300) : "",
    tone: typeof p.tone === "string" ? p.tone.slice(0, 200) : "",
    slides,
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Faça login para continuar." }, { status: 401 });
    }

    const body = await request.json() as { slides?: unknown };
    if (!Array.isArray(body.slides) || body.slides.length === 0 || body.slides.length > MAX_SLIDES) {
      return Response.json({ error: `Envie de 1 a ${MAX_SLIDES} slides.` }, { status: 400 });
    }

    const slides: SlideInput[] = [];
    for (const item of body.slides) {
      if (!item || typeof item !== "object") {
        return Response.json({ error: "Slide inválido." }, { status: 400 });
      }
      const { slideNumber, text } = item as { slideNumber?: unknown; text?: unknown };
      if (typeof slideNumber !== "number" || !Number.isInteger(slideNumber) || slideNumber < 1 || slideNumber > MAX_SLIDES) {
        return Response.json({ error: "Número de slide inválido." }, { status: 400 });
      }
      if (typeof text !== "string" || !text.trim()) {
        return Response.json({ error: `Texto ausente no slide ${slideNumber}.` }, { status: 400 });
      }
      slides.push({ slideNumber, text: text.trim().slice(0, MAX_SLIDE_TEXT_CHARS) });
    }
    if (new Set(slides.map(s => s.slideNumber)).size !== slides.length) {
      return Response.json({ error: "Números de slide duplicados." }, { status: 400 });
    }

    const validSlideNumbers = new Set(slides.map(s => s.slideNumber));
    const userMsg = slides
      .sort((a, b) => a.slideNumber - b.slideNumber)
      .map(s => `SLIDE ${s.slideNumber}:\n${s.text}`)
      .join("\n\n");

    const config = resolveConfig();
    const raw = await callOnce(config, SYSTEM_PROMPT, userMsg, 1_500);
    const analysis = parseAnalysis(raw, validSlideNumbers);
    if (!analysis) {
      return Response.json({ error: "Não foi possível interpretar a análise da copy." }, { status: 502 });
    }

    return Response.json({ analysis });
  } catch (error) {
    console.error("[analyze-copy-mechanism]", error instanceof Error ? error.message : error);
    const { status, message } = parseApiError(error);
    return Response.json({ error: message }, { status });
  }
}
