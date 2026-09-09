import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

type ModelPart = { text?: string };

interface CarouselSlideInput {
  slideNumber: number;
  image: string;
}

interface ModelCarouselAnalysis {
  designSystem?: unknown;
  colorTreatment?: unknown;
  subjectScalePattern?: unknown;
  continuity?: unknown;
  slides?: unknown;
}

interface ModelSlideAnalysis {
  slideNumber?: unknown;
  role?: unknown;
  framingDirective?: unknown;
  continuityNote?: unknown;
  bleedGroupId?: unknown;
}

const MAX_SLIDES = 10;
const MAX_TOTAL_DATA_URL_CHARS = 40_000_000;

export const maxDuration = 45;

function parseImageDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([a-zA-Z0-9+/=\r\n]+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

async function prepareForAnalysis(dataUrl: string): Promise<{ mimeType: string; data: string } | null> {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) return null;

  try {
    const sharp = (await import("sharp")).default;
    const resized = await sharp(Buffer.from(parsed.data, "base64"))
      .resize({ width: 768, withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    return { mimeType: "image/jpeg", data: resized.toString("base64") };
  } catch {
    return parsed;
  }
}

function compactText(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
    : "";
}

function computeBleedGroups(rawSlides: ModelSlideAnalysis[], validSlideNumbers: Set<number>): number[][] {
  const byGroupId = new Map<string, number[]>();
  for (const slide of rawSlides) {
    const slideNumber = typeof slide.slideNumber === "number" && Number.isInteger(slide.slideNumber)
      ? slide.slideNumber
      : null;
    const groupId = typeof slide.bleedGroupId === "string" ? slide.bleedGroupId.trim() : "";
    if (slideNumber === null || !validSlideNumbers.has(slideNumber) || !groupId) continue;
    const list = byGroupId.get(groupId) ?? [];
    list.push(slideNumber);
    byGroupId.set(groupId, list);
  }

  const groups: number[][] = [];
  for (const members of byGroupId.values()) {
    const sorted = [...new Set(members)].sort((a, b) => a - b);
    if (sorted.length < 2) continue;
    // Only adjacent, consecutive slide numbers can be jointly generated as
    // one stitched photo — anything else can't be reliably stitched side by
    // side, so split into the largest consecutive runs instead of dropping
    // the whole group.
    let runStart = 0;
    for (let i = 1; i <= sorted.length; i++) {
      if (i === sorted.length || sorted[i] !== sorted[i - 1] + 1) {
        const run = sorted.slice(runStart, i);
        if (run.length >= 2) groups.push(run);
        runStart = i;
      }
    }
  }
  return groups;
}

function formatAnalysis(raw: ModelCarouselAnalysis, validSlideNumbers: Set<number>): { text: string; bleedGroups: number[][] } {
  const designSystem = compactText(raw.designSystem, 360);
  const colorTreatment = compactText(raw.colorTreatment, 220);
  const subjectScalePattern = compactText(raw.subjectScalePattern, 360);
  const continuity = compactText(raw.continuity, 360);
  const rawSlides = Array.isArray(raw.slides) ? raw.slides as ModelSlideAnalysis[] : [];
  const slideLines = rawSlides
    .flatMap(slide => {
      const slideNumber = typeof slide.slideNumber === "number" && Number.isInteger(slide.slideNumber)
        ? slide.slideNumber
        : null;
      if (slideNumber === null || !validSlideNumbers.has(slideNumber)) return [];
      const role = compactText(slide.role, 60) || "other";
      const framing = compactText(slide.framingDirective, 260);
      const continuityNote = compactText(slide.continuityNote, 160);
      return [`S${slideNumber} [${role}]: ${framing}${continuityNote ? ` Continuity: ${continuityNote}` : ""}`];
    })
    .sort((a, b) => Number(a.match(/^S(\d+)/)?.[1] ?? 0) - Number(b.match(/^S(\d+)/)?.[1] ?? 0));

  const sections = [
    designSystem && `DESIGN SYSTEM: ${designSystem}`,
    colorTreatment && `SET COLOR TREATMENT: ${colorTreatment}`,
    subjectScalePattern && `SUBJECT-SCALE PATTERN: ${subjectScalePattern}`,
    continuity && `CROSS-SLIDE CONTINUITY: ${continuity}`,
    slideLines.length > 0 && `SLIDE MAP:\n${slideLines.join("\n")}`,
  ].filter((section): section is string => Boolean(section));

  return {
    text: sections.join("\n").slice(0, 5_000),
    bleedGroups: computeBleedGroups(rawSlides, validSlideNumbers),
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Faça login para continuar." }, { status: 401 });
    }

    const body = await request.json() as { slides?: unknown; totalSlides?: unknown };
    if (!Array.isArray(body.slides) || body.slides.length === 0 || body.slides.length > MAX_SLIDES) {
      return Response.json({ error: `Envie de 1 a ${MAX_SLIDES} slides.` }, { status: 400 });
    }

    const slides: CarouselSlideInput[] = [];
    let totalDataUrlChars = 0;
    for (const item of body.slides) {
      if (!item || typeof item !== "object") {
        return Response.json({ error: "Slide inválido." }, { status: 400 });
      }
      const { slideNumber, image } = item as { slideNumber?: unknown; image?: unknown };
      if (typeof slideNumber !== "number" || !Number.isInteger(slideNumber) || slideNumber < 1 || slideNumber > MAX_SLIDES) {
        return Response.json({ error: "Número de slide inválido." }, { status: 400 });
      }
      if (typeof image !== "string" || !parseImageDataUrl(image)) {
        return Response.json({ error: `Imagem inválida no slide ${slideNumber}.` }, { status: 400 });
      }
      totalDataUrlChars += image.length;
      slides.push({ slideNumber, image });
    }
    if (new Set(slides.map(slide => slide.slideNumber)).size !== slides.length) {
      return Response.json({ error: "Números de slide duplicados." }, { status: 400 });
    }
    if (totalDataUrlChars > MAX_TOTAL_DATA_URL_CHARS) {
      return Response.json({ error: "O carrossel é grande demais para análise." }, { status: 413 });
    }

    const requestedTotal = typeof body.totalSlides === "number" && Number.isInteger(body.totalSlides)
      ? body.totalSlides
      : slides.length;
    const totalSlides = Math.max(slides.length, Math.min(MAX_SLIDES, requestedTotal));
    const prepared = await Promise.all(slides.map(async slide => ({
      slideNumber: slide.slideNumber,
      image: await prepareForAnalysis(slide.image),
    })));
    if (prepared.some(slide => !slide.image)) {
      return Response.json({ error: "Não foi possível preparar todos os slides." }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Chave Google AI nao configurada." }, { status: 400 });
    }

    const prompt = `You are analyzing one ordered Instagram carousel as a single visual system, not as unrelated images.

Study all labeled slides together. Identify:
1. The shared design system and photographic treatment across the set.
2. The subject-scale rhythm across slides: hero portraits, standard portraits, tiny edge fragments, and slides with no person.
3. Whether adjacent slides use fragments of one continuous photograph bleeding across slide boundaries. Treat a narrow face/body strip at an edge as an intentional fragment, never as a conventional portrait that should be enlarged or centered.
4. A compact framing directive for every supplied slide. When a person is visible, estimate their visible bounding-box width as a percentage of that slide and state it as a maximum width cap (for example, "right-edge face sliver; visible person must remain at most 15% of canvas width; cropped at top, bottom, and right"). When there is no visible person, say so explicitly.
5. For every slide, a bleedGroupId: if this slide's visible person is a fragment of the SAME continuous photograph that also appears in an immediately ADJACENT slide (the photo genuinely crosses that exact edge — the same body continues, not just a similar style or subject), assign every slide in that continuous photo the SAME short id (e.g. "A", "B"). Only group slides that are directly next to each other in slide order. If a slide is not part of such a cross-slide photo, or you are not confident, use an empty string.

Do not transcribe carousel copy. Do not identify the person. Describe only reusable visual relationships needed to replace the photographed subject while preserving the original design. Slide numbers in the output must match the labels supplied below. The ordered carousel has ${totalSlides} total slide${totalSlides === 1 ? "" : "s"}.`;

    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [{ text: prompt }];
    for (const slide of prepared) {
      parts.push({ text: `SLIDE ${slide.slideNumber} OF ${totalSlides}` });
      parts.push({ inlineData: slide.image! });
    }

    const client = new GoogleGenAI({ apiKey });
    const result = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts }],
      config: {
        temperature: 0,
        maxOutputTokens: 1_800,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          additionalProperties: false,
          required: ["designSystem", "colorTreatment", "subjectScalePattern", "continuity", "slides"],
          properties: {
            designSystem: { type: "string" },
            colorTreatment: { type: "string" },
            subjectScalePattern: { type: "string" },
            continuity: { type: "string" },
            slides: {
              type: "array",
              minItems: 1,
              maxItems: MAX_SLIDES,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["slideNumber", "role", "framingDirective", "continuityNote", "bleedGroupId"],
                properties: {
                  slideNumber: { type: "integer", minimum: 1, maximum: MAX_SLIDES },
                  role: {
                    type: "string",
                    enum: ["hero", "standard-subject", "edge-fragment", "environment-only", "text-graphic-only", "other"],
                  },
                  framingDirective: { type: "string" },
                  continuityNote: { type: "string" },
                  bleedGroupId: { type: "string" },
                },
              },
            },
          },
        },
      },
    });

    const resultText = ((result.candidates?.[0]?.content?.parts ?? []) as ModelPart[])
      .map(part => part.text ?? "")
      .join("")
      .trim();
    const raw = JSON.parse(resultText) as ModelCarouselAnalysis;
    const { text: analysis, bleedGroups } = formatAnalysis(raw, new Set(slides.map(slide => slide.slideNumber)));
    if (!analysis) {
      return Response.json({ error: "Análise do carrossel vazia." }, { status: 502 });
    }

    return Response.json({ analysis, bleedGroups });
  } catch (error) {
    console.error("[analyze-carousel]", error instanceof Error ? error.message : error);
    return Response.json({ error: "Erro ao analisar o carrossel." }, { status: 500 });
  }
}
