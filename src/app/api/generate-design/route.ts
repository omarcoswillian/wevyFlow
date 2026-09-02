import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { checkAndDeductCredit, isCreditError, limitReachedResponse, finalizeGeneration } from "../../lib/credits";

const ASPECT_MAP: Record<string, string> = {
  "1:1":   "1:1",
  "4:5":   "4:5",
  "9:16":  "9:16",
  "16:9":  "16:9",
};

type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

function stripDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const [meta, data] = dataUrl.split(",");
  const match = meta.match(/:(.*?);/);
  return { mimeType: match?.[1] ?? "image/jpeg", data: data ?? "" };
}

async function resizeIfNeeded(dataUrl: string): Promise<string> {
  const MAX_B64_LEN = 1_400_000;
  if (dataUrl.length <= MAX_B64_LEN) return dataUrl;
  try {
    const sharp = (await import("sharp")).default;
    const { data: rawData } = stripDataUrl(dataUrl);
    const buf = Buffer.from(rawData, "base64");
    const resized = await sharp(buf)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
    return `data:image/jpeg;base64,${resized.toString("base64")}`;
  } catch {
    return dataUrl;
  }
}

/**
 * Step 1 of the person-swap pipeline.
 * Uses Gemini Vision (text model) to extract a precise, technical description
 * of the reference image — everything EXCEPT who the person is.
 * This description drives Step 2 and is what makes simple prompts produce
 * high-quality, complete results.
 */
async function analyzeSceneForSwap(
  client: GoogleGenAI,
  refDataUrl: string
): Promise<{ sceneDesc: string; textOverlays: string; colorTreatment: string; bodyPose: string }> {
  const { mimeType, data } = stripDataUrl(refDataUrl);

  const result = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        {
          text: `You are a professional photo compositor and art director.
Analyze this image in extreme technical detail so it can be perfectly recreated with a different person.
Describe everything EXCEPT who the person looks like or their identity.

Output structured sections:

## TEXT & GRAPHIC OVERLAYS
Number every element. For EACH text element include:
  - Element number and verbatim text (copy every word and character EXACTLY, including punctuation)
  - Font weight (ultra-bold / bold / semibold / regular / light / thin)
  - Font style (normal / italic)
  - Color (hex code if visible, otherwise precise description)
  - Any background treatment (colored filled box, pill shape, underline, etc. — include exact color and shape)
  - Position in image (use: top-left corner / top-center / top-right / left side / center / right side / bottom-left / bottom-center / bottom-right / overlay on person, etc.)
  - Relative size (hero=massive headline / large / medium / small / caption-small)
  - Text case (ALL CAPS / Title Case / lowercase)
For EACH logo, icon, badge, button, divider, graphic shape:
  - Type and description
  - Colors (fill and stroke)
  - Position and approximate size
  - Any text inside it (verbatim)

## BODY & POSE
- Full body visibility (full body / waist-up / chest-up / face-only — be specific)
- Body orientation to camera (full frontal, 3/4 angle left/right, profile, etc.)
- Exact torso angle and shoulder position
- Arms: position of each arm (bent, extended, at side, raised), elbow angle
- Hands: precise placement, what they are holding (describe object and grip), finger positions
- Head tilt angle (straight, slightly right/left), face turn direction, chin up/down
- Eye gaze direction (direct to camera, slightly off, downward, etc.)
- Facial expression (serious, confident, slight smile, intense, etc.)
- Leg and foot position if visible (stance width, weight distribution)
- Overall energy and body language (powerful, relaxed, authoritative, etc.)

## COLOR TREATMENT
State plainly, in one line: is this image full color, black-and-white/monochrome,
duotone, sepia, or otherwise color-graded/desaturated? This is a hard constraint
for recreation — say it unambiguously (e.g. "Black-and-white / monochrome, no
color tint" or "Full color, warm golden grade").

## LIGHTING
- Primary light: direction (left/right/front/back), height (high/eye-level/low), quality (hard/soft)
- Color temperature (warm golden, cool blue, neutral daylight, etc.)
- Shadow: direction, sharpness, fill ratio
- Secondary lights if any (rim light, hair light, background light, kicker)
- Specular highlights: where they appear on skin, any reflections
- Overall exposure feel (bright studio, moody dark, natural, dramatic, etc.)

## BACKGROUND & ENVIRONMENT
- Every background element described in full detail
- Colors, gradients, textures, patterns
- Depth blur / bokeh amount and quality
- Any particles, flares, glows, atmospheric effects
- Overall background mood

## COMPOSITION NOTES
- Rule of thirds placement
- Camera focal length impression (wide/normal/telephoto)
- Any cropping or padding patterns

Be exhaustive and precise — every character of text matters.`
        },
        { inlineData: { mimeType, data } }
      ]
    }],
  });

  const parts = (result.candidates?.[0]?.content?.parts ?? []) as Part[];
  const full = parts.map(p => p.text ?? "").join("\n").trim();

  // Split text overlay, color-treatment, and body-pose sections from the
  // rest for separate, prioritized use in Step 2's prompt. Pose in
  // particular — exact head angle, gaze direction, mouth/expression — is
  // easy for the model to skim past when it's busy handling the identity
  // swap, even with the reference image right there; calling it out
  // explicitly in text measurably improves how closely it's followed.
  const textMatch = full.match(/## TEXT & GRAPHIC OVERLAYS([\s\S]*?)(?=## COLOR TREATMENT|$)/);
  const textOverlays = textMatch ? textMatch[0].trim() : "";
  const colorMatch = full.match(/## COLOR TREATMENT([\s\S]*?)(?=## LIGHTING|$)/);
  const colorTreatment = colorMatch ? colorMatch[1].trim() : "";
  const poseMatch = full.match(/## BODY & POSE([\s\S]*?)(?=## COLOR TREATMENT|$)/);
  const bodyPose = poseMatch ? poseMatch[1].trim() : "";
  const sceneDesc = full;

  return { sceneDesc, textOverlays, colorTreatment, bodyPose };
}

/**
 * Text-swap edit path (no avatar): a plain "edit this image" instruction
 * left the model free to update only some overlay elements and leave stale
 * wording mixed with the new copy on busier layouts. Listing every overlay
 * explicitly first — same technique as analyzeSceneForSwap — makes the
 * model treat each one as a checklist item instead of guessing which parts
 * "the new copy" refers to.
 */
async function analyzeTextOverlays(client: GoogleGenAI, refDataUrl: string): Promise<string> {
  const { mimeType, data } = stripDataUrl(refDataUrl);

  const result = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        {
          text: `List every text and graphic overlay in this image, numbered. For each one include:
- Exact wording, copied verbatim
- Font weight and case (bold/regular, ALL CAPS/Title Case)
- Color (hex if visible, else precise description)
- Background treatment (filled box/pill/underline color and shape, or none)
- Position (top-left, center, bottom-right, etc.)
- Relative size (headline/large/medium/small/caption)

Include headline, subheadline, body copy, CTA button text, captions, and any logo or badge text. Be exhaustive — do not skip small captions. Output as a numbered list only, no other commentary.`
        },
        { inlineData: { mimeType, data } }
      ]
    }],
  });

  const parts = (result.candidates?.[0]?.content?.parts ?? []) as Part[];
  return parts.map(p => p.text ?? "").join("\n").trim();
}

/**
 * Step 1b: Analyze the avatar image to extract every fine physical detail.
 * This feeds into Step 2 so the generated person is a faithful replica,
 * not just a "similar-looking" person.
 */
async function analyzeAvatarDetails(client: GoogleGenAI, avatarDataUrl: string): Promise<string> {
  const { mimeType, data } = stripDataUrl(avatarDataUrl);

  const result = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        {
          text: `You are a forensic-level photo analyst. Describe every visible physical detail of the person in this image with extreme precision. This description will be used to recreate this exact person in a different scene — every detail matters.

## FACE
- Face shape (oval, round, square, heart, etc.)
- Skin tone: exact description (light/medium/dark, undertone warm/cool/neutral, any freckles/marks)
- Eyes: exact color (e.g. "dark brown with golden ring near pupil"), shape (almond, round, hooded), size, visible lash fullness, eyebrow shape and color
- Nose: shape, width, bridge height
- Lips: thickness (upper vs lower), color (natural lip color), any visible lipstick color
- Jawline and chin shape
- Cheekbones prominence
- Any distinctive facial features (moles, dimples, scars, etc.)

## HAIR
- Exact color (include highlights, roots, ombre if any)
- Texture (straight, wavy, curly, coily)
- Length and volume
- Style / how it falls (center part, side part, up, down, etc.)
- Shine and texture quality

## SKIN & BODY
- Overall skin quality (matte, dewy, textured)
- Body type impression (slim, athletic, curvy, etc.)
- Visible skin on hands/arms: tone, any veins, nail details

## NAILS
- Nail length (short, medium, long)
- Shape (square, oval, almond, coffin, round)
- Color: EXACT color (e.g. "deep burgundy red", "nude pink", "bright coral", "bare natural")
- Finish (matte, glossy, glitter)
- Any nail art or details

## JEWELRY & ACCESSORIES
- Every piece visible: type (ring, earring, necklace, bracelet, watch), material color (gold, silver, rose gold), style (thin band, statement, hoops, etc.), which hand/finger/ear

## CLOTHING (visible portions)
- Color, fabric type impression, style
- Neckline, collar, any visible details

Be exhaustive. Use precise, specific language. No vague terms.`
        },
        { inlineData: { mimeType, data } }
      ]
    }],
  });

  const parts = (result.candidates?.[0]?.content?.parts ?? []) as Part[];
  return parts.map(p => p.text ?? "").join("\n").trim();
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 3000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: unknown) {
      const msg = String((e as Error)?.message ?? "");
      const is503 = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand");
      if (is503 && i < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new Error("Max retries exceeded");
}

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let generationId: string | undefined;
  try {
    const {
      prompt,
      referenceImages,
      avatarImages,
      format = "9:16",
      imageModel,
      quality,
      targetWidth,
      targetHeight,
    } = await req.json() as {
      prompt: string;
      referenceImages?: string[];
      avatarImages?: string[];
      format?: string;
      imageModel?: string;
      quality?: "1K" | "2K" | "4K";
      targetWidth?: number;
      targetHeight?: number;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt obrigatorio." }, { status: 400 });
    }

    // This route always uses WevyFlow's own server key (no BYOK option) and
    // previously had no auth or quota check — anyone who found the URL could
    // trigger unlimited Nano Banana Pro generations for free.
    const creditResult = await checkAndDeductCredit("ensaio", prompt.trim());
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

    let parts: Part[];

    // ── PERSON SWAP: 2-step pipeline ─────────────────────────────────────────
    // Step 1: analyze scene + avatar details in parallel (zero extra latency)
    // Step 2: single generation call — avatar image + full scene + avatar detail desc
    if (hasRefs && hasAvatars) {
      const resizedRef = await resizeIfNeeded(refImages[0]);
      const resizedAv  = await resizeIfNeeded(avImages[0]);
      const { mimeType: refMime, data: refData } = stripDataUrl(resizedRef);
      const { mimeType: avMime, data: avData } = stripDataUrl(resizedAv);

      // Step 1: parallel analysis — no sequential wait
      const [{ textOverlays, colorTreatment, bodyPose }, avatarDesc] = await Promise.all([
        withRetry(() => analyzeSceneForSwap(client, resizedRef)),
        withRetry(() => analyzeAvatarDetails(client, resizedAv)),
      ]);

      // Step 2: generate. Critically, BOTH images are sent as visual input —
      // the reference is not just described in text, it's shown directly, so
      // pose/crop/typography/diagramming come from actually looking at it
      // rather than from the model reconstructing them from a paragraph of
      // English. A prior version only sent the avatar image and relied on a
      // text description of the reference for everything else; composition
      // and framing drifted noticeably because "extreme close crop, subject
      // fills right two-thirds of frame" is a much weaker signal than the
      // pixels themselves. The scene-description text (textOverlays,
      // colorTreatment, avatarDesc) still helps pin down details a viewer
      // could miss, but the images are now the primary source of truth.
      parts = [
        {
          text: `You are a world-class photo compositor doing a precise, surgical edit — not a redesign.

You are given two images:
• IMAGE 1 (the reference/template): the exact creative to reproduce. Its style, pose, crop/framing, background, lighting, color treatment, typography, and text diagramming are the template — copy them as precisely as if you were tracing over IMAGE 1.
• IMAGE 2 (the avatar): the person who must appear in the output instead of the person in IMAGE 1.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER REQUEST (the ONLY things allowed to differ from IMAGE 1, besides the person):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"${prompt.trim()}"

MINIMAL-CHANGE POLICY:
Reproduce IMAGE 1 exactly — same pose, same crop and framing, same camera
angle, same background, same lighting, same color treatment, same
typography, same text layout/diagramming, same graphic elements — except for
two things: (1) the person is replaced with the one from IMAGE 2, and (2)
whatever the user request above explicitly asks to change. Nothing else
changes. If the user request mentions one specific text element (e.g. a
button label), change ONLY that element's wording — keep its own font,
color, size, and position — and leave every OTHER text element exactly as it
appears in IMAGE 1, verbatim.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEXT & GRAPHIC OVERLAYS in IMAGE 1 (reproduce verbatim UNLESS the user
request above explicitly asks to change that specific one):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${textOverlays}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COLOR TREATMENT of IMAGE 1 (preserve exactly unless the user request explicitly asks to change it):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${colorTreatment}
This applies to the ENTIRE output image, including the newly-placed person —
e.g. if IMAGE 1 is black-and-white/monochrome, the person must also render
in black-and-white/monochrome, not in color.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HEAD POSE, GAZE & EXPRESSION in IMAGE 1 (the single most commonly missed
detail — copy it onto the IMAGE 2 person exactly, do not default to a
neutral frontal look-at-camera pose):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${bodyPose}

━━━ AVATAR PERSON (IMAGE 2) — EXACT PHYSICAL DETAILS ━━━
${avatarDesc}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTION RULES:

THE PERSON (from IMAGE 2 — non-negotiable):
• Use IMAGE 2 as the DEFINITIVE visual reference for the person's identity
• Reproduce EVERY physical detail: exact nail color and length, each piece of jewelry on the correct finger/ear, exact hair color/texture/volume, exact eye color, skin tone, lip color
• FULL BODY replacement — head, face, hair, neck, shoulders, torso, arms, hands, fingers, nails — everything. NOT a face swap.
• Copy the EXACT pose, crop, and framing from IMAGE 1, per the HEAD POSE, GAZE & EXPRESSION block above: same body orientation, same arm position, same hand placement, same head tilt and turn angle, same gaze direction (if IMAGE 1's subject looks away from camera, the output must too — do not default to direct eye contact), same mouth/facial expression, same distance/zoom level, same position within the frame — as if IMAGE 2's person had been physically photographed in IMAGE 1's exact spot, with the exact same camera never moving
• DO NOT zoom out, zoom in, or otherwise change the camera distance. If IMAGE 1 is a tight close-up showing only the face (or face and shoulders), the output must be that SAME tight crop — do not reveal more of the body, more clothing, or more of the room than IMAGE 1 shows. If IMAGE 1 shows the full body, keep it a full body shot. Match IMAGE 1's crop boundary exactly.
• Clothing/outfit: match IMAGE 1's styling (silhouette, color, formality) unless the user request says otherwise — and only to the extent it's actually visible within IMAGE 1's crop
• Apply IMAGE 1's lighting AND color treatment onto this person: shadow direction, color temperature, specular highlights on skin, and — critically — the same overall color treatment as the rest of the image (see above)

BACKGROUND, DEPTH & DIAGRAMMING (preserve exactly from IMAGE 1 — do not substitute a different room, backdrop, or depth of field):
• Every background element, color, gradient, texture, blur/bokeh, particles, atmosphere — if IMAGE 1's background is a plain dark/black backdrop, the output's background must also be that same plain dark/black backdrop, not a room, wall, or furniture
• Same depth of field / bokeh amount — do not sharpen a blurred background or blur a sharp one
• Color grade, LUT style, overall exposure mood — do not shift these unless the user request explicitly asks to
• Exact font choices, text sizes, and the exact position/layout of every text block relative to the photo

QUALITY:
• Photorealistic — indistinguishable from a professional original photo shoot
• No visible compositing artifacts, no plastic skin, natural hair and skin texture
• The person must look like they were the original subject photographed in IMAGE 1's exact scene, through IMAGE 1's exact camera position

⚠️ CRITICAL CHECKS BEFORE YOU FINISH:
1. The face, hair, and body in your output must be IMAGE 2's person — NOT IMAGE 1's. Copying IMAGE 1 unchanged is the single most common mistake here — do not do that.
2. The crop, camera distance, and background in your output must match IMAGE 1 exactly — NOT IMAGE 2's. If IMAGE 2 is a wider shot showing more of the room, body, or clothing than IMAGE 1 does, you must crop/frame it back down to IMAGE 1's exact boundaries. Importing IMAGE 2's background, camera angle, or zoom level is just as wrong as importing IMAGE 2's face would be right — a common failure is producing something that looks like IMAGE 2's photo with IMAGE 1's text pasted on top. That is wrong. The photo itself — angle, crop, depth, background — must look like IMAGE 1; only the identity of the person changes.
3. Head angle, gaze direction, and facial expression must match the HEAD POSE, GAZE & EXPRESSION block above — NOT a generic neutral face looking straight at the camera. A common failure is defaulting to a plain frontal look-at-camera pose because it's "safe" — if IMAGE 1's subject has their head turned, is looking off to the side, or has a distinctive expression, the output must reproduce that specific pose, not a more standard/generic one.
Aspect ratio: ${aspectRatio}.`,
        },
        { text: "IMAGE 1 — the reference/template. Copy its pose, crop, background, lighting, color treatment, and all text exactly. Do NOT copy this specific person's face/body into the output." },
        { inlineData: { mimeType: refMime, data: refData } },
        { text: "IMAGE 2 — the avatar. This exact person (face, hair, body, skin tone) is who must appear in the output, placed into IMAGE 1's pose and scene." },
        { inlineData: { mimeType: avMime, data: avData } },
      ];

    // ── EDIT MODE (reference only, no avatar) ────────────────────────────────
    } else if (hasRefs && !hasAvatars) {
      const resizedRef = await resizeIfNeeded(refImages[0]);
      const { mimeType: refMime, data: refData } = stripDataUrl(resizedRef);
      const overlays = await withRetry(() => analyzeTextOverlays(client, resizedRef));

      parts = [
        {
          text: `You are doing a precise, surgical edit — not a redesign. Change ONLY what this instruction asks for; everything else must come out pixel-identical to the reference image.

INSTRUCTION: "${prompt.trim()}"

Every text/graphic overlay currently in the image:
${overlays}

Go through that list element by element. If the instruction above supplies new wording for an element, replace ONLY its text — keep its exact font weight, color, background shape/color, position, and size. If the instruction does not mention an element, leave it completely untouched. Do not leave any old wording mixed in with the new copy anywhere in the image.

Preserve layout, lighting, color grade, and all non-text graphic elements exactly as they are — including the overall color treatment (e.g. if the reference is black-and-white/monochrome, the output must also be black-and-white/monochrome; do not add color unless explicitly asked to).
High quality, photorealistic. Aspect ratio: ${aspectRatio}.`,
        },
        { inlineData: { mimeType: refMime, data: refData } },
      ];

    // ── PURE GENERATION (no references) ──────────────────────────────────────
    } else {
      const avParts: Part[] = [];
      for (const av of avImages) {
        const resized = await resizeIfNeeded(av);
        const { mimeType, data } = stripDataUrl(resized);
        avParts.push({ inlineData: { mimeType, data } });
      }

      parts = [
        { text: `${prompt.trim()} Aspect ratio: ${aspectRatio}.` },
        ...avParts,
      ];
    }

    function extractImage(candidates: Array<{ finishReason?: string; content?: { parts?: unknown[] } }> | undefined | null) {
      for (const candidate of (candidates ?? [])) {
        const reason = (candidate as { finishReason?: string }).finishReason;
        if (reason && reason !== "STOP" && reason !== "MAX_TOKENS") {
          const txt = ((candidate.content?.parts ?? []) as Part[]).filter(p => p.text).map(p => p.text).join(" ");
          console.warn("[generate-design] finishReason:", reason, txt);
          if (reason === "SAFETY" || reason === "RECITATION") return { b64: "", mimeType: "", blocked: true };
        }
      }
      for (const candidate of (candidates ?? [])) {
        for (const part of (candidate.content?.parts ?? []) as Part[]) {
          if (part.inlineData?.data) return { b64: part.inlineData.data, mimeType: part.inlineData.mimeType ?? "image/png", blocked: false };
        }
      }
      return { b64: "", mimeType: "", blocked: false };
    }

    // ── Step 2 generation ─────────────────────────────────────────────────────
    const step2 = await withRetry(() => client.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: { aspectRatio, imageSize: quality ?? "2K" },
      },
    }));

    const { b64, mimeType, blocked } = extractImage(step2.candidates);

    if (blocked) {
      return failWithCredit("Geração bloqueada pelo Google. Tente reformular o prompt ou usar imagens diferentes.", 400);
    }
    if (!b64) {
      const modelText = (step2.candidates ?? []).flatMap(c => (c.content?.parts ?? []) as Part[]).filter(p => p.text).map(p => p.text).join(" ").trim();
      return failWithCredit(`Imagem não retornada pelo modelo${modelText ? `: ${modelText.slice(0, 200)}` : "."}`, 500);
    }

    // Gemini honors aspect ratio but not an exact pixel size — when the
    // caller needs a precise deliverable (e.g. "1080x1080" for Google Ads),
    // crop/resize to match exactly instead of shipping whatever native
    // resolution the model returned.
    let finalB64 = b64;
    let finalMime = mimeType;
    if (targetWidth && targetHeight) {
      try {
        const sharp = (await import("sharp")).default;
        const resized = await sharp(Buffer.from(b64, "base64"))
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
