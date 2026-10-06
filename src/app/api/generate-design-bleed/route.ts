import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkAndDeductCredit, isCreditError, limitReachedResponse, finalizeGeneration } from "../../lib/credits";
import {
  stripDataUrl, resizeIfNeeded,
  analyzeSceneForSwap, analyzeAvatarDetails, cropToPersonForIdentityRef, withRetry, extractImage,
  buildPersonSwapPrompt, type Part,
} from "../generate-design/shared";

export const maxDuration = 120;

interface SlideInput {
  slideNumber: number;
  referenceImage: string;
}

interface StitchSlot {
  left: number;
  width: number;
  height: number;
}

/**
 * Stitches N same-height reference images side by side into one composite,
 * so the generation call can treat a photo that bleeds across adjacent
 * carousel slides as ONE continuous scene instead of independently
 * regenerating each slide (which produces visibly mismatched lighting/pose
 * at the seam, since each independent generation call has its own
 * randomness). Returns null when the slides' heights differ too much to
 * safely represent as one continuous photo — callers must fall back to
 * independent per-slide generation in that case.
 */
async function stitchHorizontal(buffers: Buffer[]): Promise<{ buffer: Buffer; slots: StitchSlot[] } | null> {
  const sharp = (await import("sharp")).default;
  const decoded = await Promise.all(buffers.map(async buf => {
    const oriented = await sharp(buf, { failOn: "error" }).rotate().png().toBuffer({ resolveWithObject: true });
    return { data: oriented.data, width: oriented.info.width, height: oriented.info.height };
  }));
  if (decoded.some(d => !d.width || !d.height)) return null;

  const heights = decoded.map(d => d.height);
  if (Math.max(...heights) / Math.min(...heights) > 1.03) return null;

  const targetHeight = decoded[0].height;
  const heightNormalized = await Promise.all(decoded.map(async d => {
    if (d.height === targetHeight) return { buf: d.data, width: d.width };
    const out = await sharp(d.data).resize({ height: targetHeight }).png().toBuffer({ resolveWithObject: true });
    return { buf: out.data, width: out.info.width };
  }));

  // Adjacent carousel slides represent equal-width viewports. If their
  // normalized widths disagree materially, stitching them would make later
  // output resizing move each shared edge by a different amount. Tiny export
  // rounding differences are normalized deterministically with no crop.
  const normalizedWidths = heightNormalized.map(d => d.width);
  if (Math.max(...normalizedWidths) / Math.min(...normalizedWidths) > 1.01) return null;
  const targetWidth = normalizedWidths[0];
  const resized = await Promise.all(heightNormalized.map(async d => {
    if (d.width === targetWidth) return d;
    const out = await sharp(d.buf)
      .resize({ width: targetWidth, height: targetHeight, fit: "fill" })
      .png()
      .toBuffer();
    return { buf: out, width: targetWidth };
  }));

  const totalWidth = resized.reduce((sum, r) => sum + r.width, 0);
  if (totalWidth < 256 || totalWidth > 8192 || targetHeight < 256) return null;

  const slots: StitchSlot[] = [];
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  let cursor = 0;
  for (const r of resized) {
    composites.push({ input: r.buf, left: cursor, top: 0 });
    slots.push({ left: cursor, width: r.width, height: targetHeight });
    cursor += r.width;
  }

  const buffer = await sharp({
    create: { width: totalWidth, height: targetHeight, channels: 3, background: { r: 0, g: 0, b: 0 } },
  }).composite(composites).png().toBuffer();

  return { buffer, slots };
}

async function splitHorizontal(buffer: Buffer, slots: StitchSlot[]): Promise<Buffer[]> {
  const sharp = (await import("sharp")).default;
  return Promise.all(slots.map(slot => sharp(buffer).extract({ left: slot.left, top: 0, width: slot.width, height: slot.height }).png().toBuffer()));
}

function normalizeBleedCarouselContext(value: unknown): { analysis: string; totalSlides: number } | null {
  if (!value || typeof value !== "object") return null;
  const { analysis, totalSlides } = value as { analysis?: unknown; totalSlides?: unknown };
  if (typeof analysis !== "string" || !analysis.trim() || typeof totalSlides !== "number" || !Number.isInteger(totalSlides) || totalSlides < 2) {
    return null;
  }
  return { analysis: analysis.trim().slice(0, 5_000), totalSlides };
}

export async function POST(req: NextRequest) {
  let generationId: string | undefined;
  try {
    const {
      prompt,
      slides,
      avatarImages,
      imageModel,
      quality,
      targetWidth,
      targetHeight,
      carouselContext,
    } = await req.json() as {
      prompt: string;
      slides?: SlideInput[];
      avatarImages?: string[];
      format?: string;
      imageModel?: string;
      quality?: "1K" | "2K" | "4K";
      targetWidth?: number;
      targetHeight?: number;
      carouselContext?: unknown;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt obrigatorio." }, { status: 400 });
    }

    const orderedSlides = (slides ?? [])
      .filter(s => s && Number.isInteger(s.slideNumber) && s.slideNumber > 0 && s.referenceImage?.startsWith("data:"))
      .sort((a, b) => a.slideNumber - b.slideNumber);
    if (orderedSlides.length < 2) {
      return NextResponse.json({ error: "São necessários ao menos 2 slides para geração conjunta." }, { status: 400 });
    }
    if (orderedSlides.some((slide, index) => index > 0 && slide.slideNumber !== orderedSlides[index - 1].slideNumber + 1)) {
      return NextResponse.json({ error: "Os slides da geração conjunta devem ser únicos e consecutivos." }, { status: 400 });
    }
    const avImages = (avatarImages ?? []).filter(u => u?.startsWith("data:"));
    if (avImages.length === 0) {
      return NextResponse.json({ error: "Avatar obrigatório para geração conjunta de slides." }, { status: 400 });
    }

    const creditResult = await checkAndDeductCredit("design_swap", prompt.trim());
    if (isCreditError(creditResult)) {
      return NextResponse.json({ error: creditResult.error }, { status: creditResult.status });
    }
    if (!creditResult.allowed) {
      return limitReachedResponse(creditResult) as NextResponse;
    }
    generationId = creditResult.generationId;
    const failWithCredit = async (error: string, status: number) => {
      await finalizeGeneration(generationId!, false, error);
      return NextResponse.json({ error }, { status });
    };

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return failWithCredit("Chave Google AI nao configurada.", 400);
    }

    const client = new GoogleGenAI({ apiKey });
    const model = imageModel || "gemini-3-pro-image-preview";
    const normalizedCarouselContext = normalizeBleedCarouselContext(carouselContext);

    const originalBuffers = orderedSlides.map(s => Buffer.from(stripDataUrl(s.referenceImage).data, "base64"));
    const stitched = await stitchHorizontal(originalBuffers);
    if (!stitched) {
      return failWithCredit("Não foi possível combinar esses slides em uma única foto contínua (dimensões incompatíveis).", 422);
    }

    const resizedAv = await resizeIfNeeded(avImages[0]);
    const stitchedDataUrl = `data:image/png;base64,${stitched.buffer.toString("base64")}`;
    const resizedStitchedDataUrl = await resizeIfNeeded(stitchedDataUrl);

    const [{ textOverlays, colorTreatment, bodyPose }, avatarDesc, avatarForGeneration] = await Promise.all([
      withRetry(() => analyzeSceneForSwap(client, resizedStitchedDataUrl)),
      withRetry(() => analyzeAvatarDetails(client, resizedAv)),
      withRetry(() => cropToPersonForIdentityRef(client, resizedAv)),
    ]);
    const { mimeType: avMime, data: avData } = stripDataUrl(avatarForGeneration);

    const slideNumbers = orderedSlides.map(s => s.slideNumber);
    const slideLabel = slideNumbers.length === 2
      ? `slides ${slideNumbers[0]} and ${slideNumbers[1]}`
      : `slides ${slideNumbers[0]}-${slideNumbers[slideNumbers.length - 1]}`;

    const userRequestBlock = normalizedCarouselContext
      ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EFFECTIVE USER REQUEST FOR THESE CAROUSEL SLIDES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER-AUTHORED REQUEST (the only requested changes beyond replacing the person):
"${prompt.trim()}"

AUTOMATIC REFERENCE-FIDELITY CONSTRAINTS (part of this effective user request; these
describe what must stay unchanged, not additional creative freedom):
IMAGE 1 is a SINGLE stitched composite showing ${slideLabel} of ${normalizedCarouselContext.totalSlides},
placed edge-to-edge with zero gap, in original slide order left to right. This is
because in the original carousel, ONE continuous photograph of the person bleeds
across the shared edge between these slides — the same body continues from one
slide into the next. Generate ONE single continuous photograph across the full
stitched width so the person lines up perfectly at the seam(s) — do not treat each
slide-width segment as a separate photo, and do not add a visible seam, cut, or
mismatch in lighting/pose/skin tone at the boundary between slides.

WHOLE-CAROUSEL ANALYSIS (use the global pattern to preserve intentional cross-slide
crops and photos that bleed across adjacent slides):
${normalizedCarouselContext.analysis}

Do not render prompt prose, analysis labels, metadata, signatures, watermarks, or marks
imported from IMAGE 2.`
      : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER REQUEST (the ONLY things allowed to differ from IMAGE 1, besides the person):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"${prompt.trim()}"

IMPORTANT: IMAGE 1 is a SINGLE stitched composite of ${slideLabel}, placed edge-to-edge
with zero gap in original order, because one continuous photograph bleeds across the
shared edge between them. Generate ONE continuous photograph across the full width so
the person lines up perfectly at the seam — do not treat each segment as a separate
photo, and do not add a visible seam or mismatch at the boundary.`;

    const stitchedTotalWidth = stitched.slots.reduce((sum, s) => sum + s.width, 0);
    const { mimeType: stitchedRefMime, data: stitchedRefData } = stripDataUrl(resizedStitchedDataUrl);
    const parts: Part[] = [
      {
        text: buildPersonSwapPrompt({
          userRequestBlock,
          textOverlays,
          colorTreatment,
          bodyPose,
          avatarDesc,
          generationAspectRatio: `${stitchedTotalWidth}:${stitched.slots[0].height} (match IMAGE 1's exact aspect ratio)`,
        }),
      },
      { text: "IMAGE 1 — the stitched reference/template to reproduce exactly except for the person (and whatever the user request explicitly asks to change)." },
      { inlineData: { mimeType: stitchedRefMime, data: stitchedRefData } },
      { text: "IMAGE 2 — identity reference only." },
      { inlineData: { mimeType: avMime, data: avData } },
    ];
    const generation = await withRetry(() => client.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { imageSize: quality ?? "2K" },
      },
    }));
    const generated = extractImage(generation.candidates);
    if (generated.blocked) {
      return failWithCredit("Geração bloqueada pelo Google. Tente reformular o prompt ou usar imagens diferentes.", 400);
    }
    if (!generated.b64) {
      const modelText = (generation.candidates ?? []).flatMap(c => (c.content?.parts ?? []) as Part[]).filter(p => p.text).map(p => p.text).join(" ").trim();
      return failWithCredit(`Imagem não retornada pelo modelo${modelText ? `: ${modelText.slice(0, 200)}` : "."}`, 500);
    }

    const sharp = (await import("sharp")).default;
    let compositeBuffer = await sharp(Buffer.from(generated.b64, "base64"), { failOn: "error" })
      .rotate()
      .resize({ width: stitchedTotalWidth, height: stitched.slots[0].height, fit: "fill" })
      .png()
      .toBuffer();
    let outputSlots = stitched.slots;
    const outputWidth = typeof targetWidth === "number" && Number.isInteger(targetWidth) && targetWidth > 0
      ? targetWidth
      : null;
    const outputHeight = typeof targetHeight === "number" && Number.isInteger(targetHeight) && targetHeight > 0
      ? targetHeight
      : null;
    if (outputWidth !== null && outputHeight !== null) {
      const sourceAspect = stitched.slots[0].width / stitched.slots[0].height;
      const targetAspect = outputWidth / outputHeight;
      const aspectDrift = Math.abs(targetAspect / sourceAspect - 1);
      const combinedTargetWidth = outputWidth * orderedSlides.length;
      if (aspectDrift > 0.02 || combinedTargetWidth > 8192) {
        return failWithCredit("As dimensões de saída não preservam com segurança a continuidade entre os slides.", 422);
      }
      compositeBuffer = await sharp(compositeBuffer)
        .resize({ width: combinedTargetWidth, height: outputHeight, fit: "fill" })
        .png()
        .toBuffer();
      outputSlots = orderedSlides.map((_, index) => ({
        left: index * outputWidth,
        width: outputWidth,
        height: outputHeight,
      }));
    }

    const splitBuffers = await splitHorizontal(compositeBuffer, outputSlots);
    const outputs = await Promise.all(orderedSlides.map(async (slide, index) => {
      const slideBuffer = splitBuffers[index];
      if (outputWidth !== null && outputHeight !== null) {
        try {
          const resized = await sharp(slideBuffer)
            .jpeg({ quality: 92 })
            .toBuffer();
          return { slideNumber: slide.slideNumber, b64: resized.toString("base64"), mimeType: "image/jpeg" };
        } catch (resizeErr) {
          console.error("[generate-design-bleed] resize to target size failed:", resizeErr);
        }
      }
      return { slideNumber: slide.slideNumber, b64: slideBuffer.toString("base64"), mimeType: "image/png" };
    }));

    await finalizeGeneration(generationId, true);
    return NextResponse.json({ slides: outputs });

  } catch (e: unknown) {
    const err = e as Error;
    const msg = String(err?.message ?? "");
    console.error("[generate-design-bleed] exception:", msg, String(err?.stack ?? "").slice(0, 400));
    if (generationId) await finalizeGeneration(generationId, false, msg);

    if (msg.includes("401") || msg.includes("API_KEY") || msg.includes("invalid")) {
      return NextResponse.json({ error: "API Key Google inválida ou expirada." }, { status: 401 });
    }
    if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
      return NextResponse.json({ error: "Cota Google insuficiente. Verifique billing em aistudio.google.com." }, { status: 429 });
    }
    if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) {
      return NextResponse.json({ error: "Modelo Google sobrecarregado. Tente novamente em alguns segundos." }, { status: 503 });
    }
    if (msg.includes("safety") || msg.includes("SAFETY") || msg.includes("block") || msg.includes("PERSON")) {
      return NextResponse.json({ error: "Geração bloqueada pelo Google. Tente reformular o prompt ou usar imagens diferentes." }, { status: 400 });
    }
    if (msg.includes("400")) {
      return NextResponse.json({ error: `Requisição inválida: ${msg.slice(0, 200)}` }, { status: 400 });
    }
    return NextResponse.json({ error: `Erro ao gerar: ${msg.slice(0, 200) || "erro desconhecido"}` }, { status: 500 });
  }
}
