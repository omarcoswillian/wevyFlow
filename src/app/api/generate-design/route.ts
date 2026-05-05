import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

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
): Promise<{ sceneDesc: string; textOverlays: string }> {
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

  // Split text overlay section from the rest for separate use in Step 2
  const textMatch = full.match(/## TEXT & GRAPHIC OVERLAYS([\s\S]*?)(?=## BODY|$)/);
  const textOverlays = textMatch ? textMatch[0].trim() : "";
  const sceneDesc = full;

  return { sceneDesc, textOverlays };
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
  try {
    const {
      prompt,
      referenceImages,
      avatarImages,
      format = "9:16",
      imageModel,
    } = await req.json() as {
      prompt: string;
      referenceImages?: string[];
      avatarImages?: string[];
      format?: string;
      imageModel?: string;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt obrigatorio." }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Chave Google AI nao configurada." }, { status: 400 });
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
      const { mimeType: avMime, data: avData } = stripDataUrl(resizedAv);

      // Step 1: parallel analysis — no sequential wait
      const [{ sceneDesc, textOverlays }, avatarDesc] = await Promise.all([
        withRetry(() => analyzeSceneForSwap(client, resizedRef)),
        withRetry(() => analyzeAvatarDetails(client, resizedAv)),
      ]);

      // Step 2: generate — avatar image is the visual anchor, descriptions guide fidelity
      // Text overlays are listed FIRST as the highest-priority constraint
      parts = [
        {
          text: `You are a world-class photo compositor. Your task: place the person from the attached AVATAR IMAGE into the scene described below, with complete body replacement.

USER REQUEST: "${prompt.trim()}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ PRIORITY 1 — TEXT & GRAPHIC OVERLAYS (reproduce these EXACTLY, character by character):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${textOverlays}

Every text element above must appear in the output with IDENTICAL wording, font weight, color, size, position, and styling. Do not paraphrase, resize, recolor, or reposition any of them. These are non-negotiable design assets.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FULL SCENE DESCRIPTION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${sceneDesc}

━━━ AVATAR PERSON — EXACT PHYSICAL DETAILS ━━━
${avatarDesc}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTION RULES:

THE PERSON (from avatar image — non-negotiable):
• Use the avatar image as the DEFINITIVE visual reference for the person
• Reproduce EVERY physical detail: exact nail color and length, each piece of jewelry on the correct finger/ear, exact hair color/texture/volume, exact eye color, skin tone, lip color, clothing details
• FULL BODY replacement — head, face, hair, neck, shoulders, torso, arms, hands, fingers, nails — everything. NOT a face swap.
• Replicate the exact pose from the scene analysis: body orientation, arm position, hand placement, what they hold and how, head angle, gaze direction
• Apply the scene's lighting onto this person: shadow direction, color temperature, specular highlights on skin

BACKGROUND & ENVIRONMENT (preserve exactly):
• Every background element, color, gradient, texture, blur/bokeh, particles, atmosphere
• Color grade, LUT style, overall exposure mood

QUALITY:
• Photorealistic — indistinguishable from a professional original photo shoot
• No visible compositing artifacts, no plastic skin, natural hair and skin texture
• The person must look like they were the original subject photographed in this scene
Aspect ratio: ${aspectRatio}.`,
        },
        { inlineData: { mimeType: avMime, data: avData } },
      ];

    // ── EDIT MODE (reference only, no avatar) ────────────────────────────────
    } else if (hasRefs && !hasAvatars) {
      const resizedRef = await resizeIfNeeded(refImages[0]);
      const { mimeType: refMime, data: refData } = stripDataUrl(resizedRef);

      parts = [
        {
          text: `Edit this image as requested: "${prompt.trim()}"
Preserve everything not explicitly mentioned. Keep all text overlays, layout, lighting, color grade, and graphic elements intact.
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
      config: { responseModalities: ["TEXT", "IMAGE"] },
    }));

    const { b64, mimeType, blocked } = extractImage(step2.candidates);

    if (blocked) {
      return NextResponse.json({ error: "Geração bloqueada pelo Google. Tente reformular o prompt ou usar imagens diferentes." }, { status: 400 });
    }
    if (!b64) {
      const modelText = (step2.candidates ?? []).flatMap(c => (c.content?.parts ?? []) as Part[]).filter(p => p.text).map(p => p.text).join(" ").trim();
      return NextResponse.json({ error: `Imagem não retornada pelo modelo${modelText ? `: ${modelText.slice(0, 200)}` : "."}` }, { status: 500 });
    }

    return NextResponse.json({ b64, mimeType });

  } catch (e: unknown) {
    const err = e as Error;
    const msg = String(err?.message ?? "");
    console.error("[generate-design] exception:", msg, String(err?.stack ?? "").slice(0, 400));

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
