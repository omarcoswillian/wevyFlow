import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { loadBrandSystem, TEXT_LAYER_RULE } from "@/lib/launches/brand-system";
import { checkAndDeductCredit, isCreditError, limitReachedResponse, finalizeGeneration } from "../../lib/credits";
import {
  ASPECT_MAP, stripDataUrl, resizeIfNeeded, normalizeCarouselContext,
  analyzeSceneForSwap, analyzeTextOverlays, analyzeTextOverlayGroups, cropToPersonForIdentityRef,
  analyzeAvatarDetails, withRetry, extractImage, buildPersonSwapPrompt,
  buildAdaptReferencePrompt,
  type Part,
} from "./shared";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let generationId: string | undefined;
  try {
    const {
      prompt,
      copy,
      referenceImages,
      avatarImages,
      format = "9:16",
      imageModel,
      quality,
      targetWidth,
      targetHeight,
      carouselContext,
      projectId,
      textLayer,
    } = await req.json() as {
      prompt: string;
      // Approved headline+CTA from the Copy picker — when present alongside
      // a reference image (no avatar), triggers ADAPT REFERENCE mode instead
      // of the surgical single-instruction edit. See shared.ts:
      // buildAdaptReferencePrompt() for why this needs to be structured
      // rather than folded into `prompt` as free text.
      copy?: { headline: string; cta: string };
      referenceImages?: string[];
      avatarImages?: string[];
      format?: string;
      imageModel?: string;
      quality?: "1K" | "2K" | "4K";
      targetWidth?: number;
      targetHeight?: number;
      carouselContext?: unknown;
      // Lançamento de origem: quando existe e é do usuário, a geração sem
      // referência herda o Brand System dele (cores, fonte, estilo, regras, logo).
      projectId?: string;
      // true = o texto da peça será aplicado depois em camada separada.
      textLayer?: boolean;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt obrigatorio." }, { status: 400 });
    }

    // This route always uses WevyFlow's own server key (no BYOK option) and
    // previously had no auth or quota check — anyone who found the URL could
    // trigger unlimited Nano Banana Pro generations for free.
    // Custo pelo modo real da geração (inferido do corpo, nunca de um campo
    // que o cliente possa mandar pra pagar menos): usar avatar dispara as
    // chamadas de visão extras da troca de pessoa.
    const hasAvatarInput = (avatarImages ?? []).some((u) => u?.startsWith("data:"));
    const creditResult = await checkAndDeductCredit(hasAvatarInput ? "design_swap" : "design", prompt.trim());
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
    const aspectRatio = ASPECT_MAP[format] ?? "9:16";

    const refImages  = (referenceImages ?? []).filter(u => u?.startsWith("data:"));
    const avImages   = (avatarImages   ?? []).filter(u => u?.startsWith("data:"));
    const hasRefs    = refImages.length > 0;
    const hasAvatars = avImages.length  > 0;
    const normalizedCarouselContext = normalizeCarouselContext(carouselContext);

    let workingB64 = "";
    let workingMime = "";

    // ── PERSON SWAP: direct full-image generation ─────────────────────────
    // No local crop, no pixel mask, no post-generation geometry validation.
    // A prior localized-patch pipeline forcibly restored every pixel outside
    // a tight ellipse around the source person, which produced visible
    // ghosting whenever the new pose/pose-adjacent request (e.g. swapping a
    // held item) didn't line up with the old one — leftover fragments of the
    // original hand/prop stayed baked into the output. Sending the whole
    // reference straight to the model and trusting its own single-shot
    // result avoids that class of defect entirely.
    if (hasRefs && hasAvatars) {
      const resizedRef = await resizeIfNeeded(refImages[0]);
      const resizedAv  = await resizeIfNeeded(avImages[0]);
      const { mimeType: refMime, data: refData } = stripDataUrl(resizedRef);

      const [{ textOverlays, colorTreatment, bodyPose }, avatarDesc, avatarForGeneration] = await Promise.all([
        withRetry(() => analyzeSceneForSwap(client, resizedRef)),
        withRetry(() => analyzeAvatarDetails(client, resizedAv)),
        withRetry(() => cropToPersonForIdentityRef(client, resizedAv)),
      ]);
      const { mimeType: avMime, data: avData } = stripDataUrl(avatarForGeneration);
      const userRequestBlock = normalizedCarouselContext
        ? `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EFFECTIVE USER REQUEST FOR THIS CAROUSEL SLIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER-AUTHORED REQUEST (the only requested changes beyond replacing the person):
"${prompt.trim()}"

AUTOMATIC REFERENCE-FIDELITY CONSTRAINTS (part of this effective user request; these
describe what must stay unchanged, not additional creative freedom):
Current image: slide ${normalizedCarouselContext.slideNumber} of ${normalizedCarouselContext.totalSlides}.

WHOLE-CAROUSEL ANALYSIS (use the S${normalizedCarouselContext.slideNumber}
directive for this image; use the global pattern to preserve intentional
cross-slide crops and photos that bleed across adjacent slides):
${normalizedCarouselContext.analysis}

Do not render prompt prose, analysis labels, metadata, signatures, watermarks,
or marks imported from IMAGE 2.`
        : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER REQUEST (the ONLY things allowed to differ from IMAGE 1, besides the person):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"${prompt.trim()}"`;

      const parts: Part[] = [
        {
          text: buildPersonSwapPrompt({
            userRequestBlock,
            textOverlays,
            colorTreatment,
            bodyPose,
            avatarDesc,
            generationAspectRatio: aspectRatio,
          }),
        },
        { text: "IMAGE 1 — the reference/template to reproduce exactly except for the person (and whatever the user request explicitly asks to change)." },
        { inlineData: { mimeType: refMime, data: refData } },
        { text: "IMAGE 2 — identity reference only." },
        { inlineData: { mimeType: avMime, data: avData } },
      ];

      const generation = await withRetry(() => client.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio, imageSize: quality ?? "2K" },
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
      workingB64 = generated.b64;
      workingMime = generated.mimeType;

    // ── EDIT MODE (reference only, no avatar) ────────────────────────────────
    } else {
      let parts: Part[];
      if (hasRefs && !hasAvatars) {
        const resizedRef = await resizeIfNeeded(refImages[0]);
        const { mimeType: refMime, data: refData } = stripDataUrl(resizedRef);
        const hasStructuredCopy = Boolean(copy?.headline?.trim() && copy?.cta?.trim());

        const editText = hasStructuredCopy
          // ── ADAPT REFERENCE: approved headline+CTA came from the Copy
          // picker as distinct fields — replace those groups wholesale
          // instead of guessing which fragment of a flat instruction string
          // maps to which overlay (see shared.ts: buildAdaptReferencePrompt).
          ? buildAdaptReferencePrompt({
              headline: copy!.headline.trim(),
              cta: copy!.cta.trim(),
              analysis: await withRetry(() => analyzeTextOverlayGroups(client, resizedRef)),
              aspectRatio,
            })
          // ── SURGICAL EDIT: a freeform one-line instruction (manual typing,
          // or the "Ajustar" refinement flow) — unchanged from before.
          : `You are doing a precise, surgical edit — not a redesign. Change ONLY what this instruction asks for; everything else must come out pixel-identical to the reference image.

INSTRUCTION: "${prompt.trim()}"

Every text/graphic overlay currently in the image:
${await withRetry(() => analyzeTextOverlays(client, resizedRef))}

Go through that list element by element. If the instruction above supplies new wording for an element, replace ONLY its text — keep its exact font weight, color, background shape/color, position, and size. If the instruction does not mention an element, leave it completely untouched. Do not leave any old wording mixed in with the new copy anywhere in the image.

Preserve layout, lighting, color grade, and all non-text graphic elements exactly as they are — including the overall color treatment (e.g. if the reference is black-and-white/monochrome, the output must also be black-and-white/monochrome; do not add color unless explicitly asked to).
High quality, photorealistic. Aspect ratio: ${aspectRatio}.`;

        parts = [
          { text: editText },
          { inlineData: { mimeType: refMime, data: refData } },
        ];

      // ── PURE GENERATION (no references) ────────────────────────────────────
      } else {
        const avParts: Part[] = [];
        for (const av of avImages) {
          const resized = await resizeIfNeeded(av);
          const { mimeType, data } = stripDataUrl(resized);
          avParts.push({ inlineData: { mimeType, data } });
        }

        // Só a geração do zero herda o Brand System: com referência, é a
        // referência que manda no visual e a fidelidade a ela não pode ser
        // sobrescrita por regras de marca.
        const brand = await loadBrandSystem(projectId);
        const promptText = [
          brand?.block,
          textLayer ? TEXT_LAYER_RULE : "",
          prompt.trim(),
          `Aspect ratio: ${aspectRatio}.`,
        ].filter(Boolean).join("\n\n");

        parts = [
          { text: promptText },
          ...(brand?.logo ? [{ text: "LOGO OFICIAL (reproduzir exatamente, sem alterar):" }, { inlineData: brand.logo }] : []),
          ...avParts,
        ];
      }

      const generation = await withRetry(() => client.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio, imageSize: quality ?? "2K" },
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
      workingB64 = generated.b64;
      workingMime = generated.mimeType;
    }

    // Gemini honors aspect ratio but not an exact pixel size — when the
    // caller needs a precise deliverable (e.g. "1080x1080" for Google Ads),
    // crop/resize to match exactly instead of shipping whatever native
    // resolution the model returned.
    let finalB64 = workingB64;
    let finalMime = workingMime;
    if (targetWidth && targetHeight) {
      try {
        const sharp = (await import("sharp")).default;
        const resized = await sharp(Buffer.from(workingB64, "base64"))
          .resize({ width: targetWidth, height: targetHeight, fit: "cover", position: "attention" })
          .jpeg({ quality: 92 })
          .toBuffer();
        finalB64 = resized.toString("base64");
        finalMime = "image/jpeg";
      } catch (resizeErr) {
        console.error("[generate-design] resize to target size failed:", resizeErr);
      }
    }

    await finalizeGeneration(generationId, true);
    return NextResponse.json({ b64: finalB64, mimeType: finalMime });

  } catch (e: unknown) {
    const err = e as Error;
    const msg = String(err?.message ?? "");
    console.error("[generate-design] exception:", msg, String(err?.stack ?? "").slice(0, 400));
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
