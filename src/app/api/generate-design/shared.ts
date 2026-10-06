import { GoogleGenAI } from "@google/genai";
import { parsePersonRegion, normalizedToPixels, clamp } from "./person-patch";

export const ASPECT_MAP: Record<string, string> = {
  "1:1":   "1:1",
  "4:5":   "4:5",
  "9:16":  "9:16",
  "16:9":  "16:9",
};

export type Part = { text?: string; inlineData?: { mimeType: string; data: string } };

export interface CarouselGenerationContext {
  analysis: string;
  slideNumber: number;
  totalSlides: number;
}

export function stripDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const [meta, data] = dataUrl.split(",");
  const match = meta.match(/:(.*?);/);
  return { mimeType: match?.[1] ?? "image/jpeg", data: data ?? "" };
}

export async function resizeIfNeeded(dataUrl: string): Promise<string> {
  const MAX_B64_LEN = 1_400_000;
  try {
    const sharp = (await import("sharp")).default;
    const { data: rawData } = stripDataUrl(dataUrl);
    const buf = Buffer.from(rawData, "base64");
    const metadata = await sharp(buf, { failOn: "error" }).metadata();
    const needsResize = dataUrl.length > MAX_B64_LEN;
    const needsOrientation = typeof metadata.orientation === "number" && metadata.orientation !== 1;
    if (!needsResize && !needsOrientation) return dataUrl;

    let pipeline = sharp(buf, { failOn: "error" }).rotate();
    if (needsResize) {
      pipeline = pipeline.resize({ width: 1024, withoutEnlargement: true });
    }
    const resized = await pipeline
      .jpeg({ quality: 88 })
      .toBuffer();
    return `data:image/jpeg;base64,${resized.toString("base64")}`;
  } catch {
    return dataUrl;
  }
}

function extractMarkdownSection(full: string, heading: string): string {
  const match = full.match(new RegExp(`## ${heading}([\\s\\S]*?)(?=\\n## |$)`));
  return match ? match[0].trim() : "";
}

export function normalizeCarouselContext(value: unknown): CarouselGenerationContext | null {
  if (!value || typeof value !== "object") return null;
  const { analysis, slideNumber, totalSlides } = value as {
    analysis?: unknown;
    slideNumber?: unknown;
    totalSlides?: unknown;
  };
  if (
    typeof analysis !== "string"
    || !analysis.trim()
    || typeof slideNumber !== "number"
    || !Number.isInteger(slideNumber)
    || slideNumber < 1
    || typeof totalSlides !== "number"
    || !Number.isInteger(totalSlides)
    || totalSlides < slideNumber
  ) {
    return null;
  }
  return {
    analysis: analysis.trim().slice(0, 5_000),
    slideNumber,
    totalSlides,
  };
}

export function buildFrameOccupancyDirective(frameOccupancy: string): string {
  if (!frameOccupancy) {
    return "Preserve IMAGE 1's visible-person bounds, edge crop, and negative space exactly.";
  }

  const width = frameOccupancy.match(/width\s*(?:≈|~=|about|approximately)?\s*(\d+(?:\.\d+)?)%/i)?.[1];
  const height = frameOccupancy.match(/height\s*(?:≈|~=|about|approximately)?\s*(\d+(?:\.\d+)?)%/i)?.[1];
  const caps = [
    width ? `The visible person must occupy no more than ${width}% of the canvas width.` : "",
    height ? `The visible person must occupy no more than ${height}% of the canvas height.` : "",
  ].filter(Boolean).join(" ");

  return `${frameOccupancy}${caps ? `\nDerived size caps: ${caps}` : ""}`;
}

/**
 * Step 1 of the person-swap pipeline.
 * Uses Gemini Vision (text model) to extract a precise, technical description
 * of the reference image — everything EXCEPT who the person is.
 * This description drives Step 2 and is what makes simple prompts produce
 * high-quality, complete results.
 */
export async function analyzeSceneForSwap(
  client: GoogleGenAI,
  refDataUrl: string
): Promise<{ textOverlays: string; colorTreatment: string; bodyPose: string; frameOccupancy: string }> {
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
If the image has NO text or graphic overlays at all, write exactly "NO VISIBLE TEXT OR GRAPHIC OVERLAYS" and skip the rest of this section.
Otherwise, number every element. For EACH text element include:
  - Element number and verbatim text (copy every word and character EXACTLY, including punctuation)
  - Font weight (ultra-bold / bold / semibold / regular / light / thin)
  - Font style (normal / italic)
  - Color (hex code if visible, otherwise precise description)
  - Any background treatment (colored filled box, pill shape, underline, etc. — include exact color and shape)
  - Position in image (use: top-left corner / top-center / top-right / left side / center / right side / bottom-left / bottom-center / bottom-right / overlay on person, etc.)
  - Relative size (hero=massive headline / large / medium / small / caption-small)
  - Text case (ALL CAPS / Title Case / lowercase)
  - PROTECTED PIXEL BOUNDS (required): this element's own tight bounding box as percentages of the full frame, using exactly this format: "PROTECTED PIXEL BOUNDS: left=__% top=__% right=__% bottom=__%." left/top is the top-left corner, right/bottom is the bottom-right corner, both as % of frame width/height from the image's top-left origin. Use the element's own box, not a larger card/panel it sits inside.
For EACH logo, icon, badge, button, divider, graphic shape:
  - Type and description
  - Colors (fill and stroke)
  - Position and approximate size
  - Any text inside it (verbatim)
  - PROTECTED PIXEL BOUNDS in the same format as above

## BODY & POSE
- Full body visibility (full body / waist-up / chest-up / face-only — be specific)
- FRAME OCCUPANCY & POSITION (required one-line callout): estimate the visible person's bounding box as percentages of the full frame, using exactly this format: "FRAME OCCUPANCY & POSITION: width ≈ __% of frame; height ≈ __% of frame; horizontal position = __; vertical position = __; cropped by frame at __." Measure only the visible person, not their shadow or surrounding graphics. Name every frame edge that cuts the person, and report unusually narrow or off-center crops literally (for example, "left-edge sliver occupying ≈ 18% of frame width" or "right-aligned, upper-middle, occupying ≈ 38% of frame width").
- PERSON BOUNDS (required one-line callout, only when a person is visible): the same visible person's tightest bounding box as edge percentages, using exactly this format: "PERSON BOUNDS: left=__% top=__% right=__% bottom=__% confidence=high|medium." left/top is the top-left corner, right/bottom is the bottom-right corner, both as % of frame width/height from the image's top-left origin — this must describe the exact same region as FRAME OCCUPANCY & POSITION above, just as edge coordinates instead of a width/height summary. Use confidence=medium if the exact edge is uncertain (motion blur, soft focus, cropped by another element). If no person is visible anywhere in the frame, write "PERSON BOUNDS: none".
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
  const textOverlays = extractMarkdownSection(full, "TEXT & GRAPHIC OVERLAYS");
  const colorTreatment = extractMarkdownSection(full, "COLOR TREATMENT")
    .replace(/^## COLOR TREATMENT\s*/, "")
    .trim();
  const bodyPose = extractMarkdownSection(full, "BODY & POSE")
    .replace(/^## BODY & POSE\s*/, "")
    .trim();
  const frameOccupancy = bodyPose.match(/^.*FRAME OCCUPANCY & POSITION:.*$/mi)?.[0].trim() ?? "";

  return { textOverlays, colorTreatment, bodyPose, frameOccupancy };
}

/**
 * Text-swap edit path (no avatar): a plain "edit this image" instruction
 * left the model free to update only some overlay elements and leave stale
 * wording mixed with the new copy on busier layouts. Listing every overlay
 * explicitly first — same technique as analyzeSceneForSwap — makes the
 * model treat each one as a checklist item instead of guessing which parts
 * "the new copy" refers to.
 */
/** Controle de qualidade da camada de texto: o fundo gerado não pode trazer
 * palavras, letras ou números legíveis, porque o texto final entra depois por
 * cima. Falha segura: se a checagem em si falhar, não bloqueia a peça. */
export async function detectStrayText(client: GoogleGenAI, dataUrl: string): Promise<boolean> {
  try {
    const { mimeType, data } = stripDataUrl(dataUrl);
    const result = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          { text: "Does this image contain any legible words, letters, numbers, fake logos or watermarks (ignore tiny incidental marks that cannot be read)? Answer with exactly one word: SIM or NAO." },
          { inlineData: { mimeType, data } },
        ],
      }],
    });
    const parts = (result.candidates?.[0]?.content?.parts ?? []) as Part[];
    return /^\s*SIM/i.test(parts.map(p => p.text ?? "").join(" "));
  } catch {
    return false;
  }
}

export async function analyzeTextOverlays(client: GoogleGenAI, refDataUrl: string): Promise<string> {
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
 * Structured sibling of analyzeTextOverlays() for the ADAPT REFERENCE mode
 * (used when the caller supplies approved copy as distinct headline/CTA
 * fields instead of a freeform instruction — see generate-ads copy picker).
 * The flat numbered list above is fine for a human-authored one-line edit
 * ("troque o CTA pra X"), but it gives the model no way to know that
 * "não sabe." and a headline fragment three lines up belong to the SAME
 * message, or that a decorative pill shape only exists to frame one word of
 * that headline — so a full copy swap left orphaned fragments/shapes behind.
 * Grouping fragments into one message and linking dependent decorations to
 * their group lets the replacement prompt treat "replace this group" as one
 * atomic operation instead of patching text runs individually.
 */
export interface OverlayGroup {
  id: string;
  role: "headline" | "subheadline" | "cta" | "body" | "tag" | "brand_identity" | "other";
  fullText: string;
  containerType: "button" | "pill" | "plain_text" | "badge" | "none";
  position: string;
}

export interface OverlayDecoration {
  id: string;
  description: string;
  /** Group id this decoration exists to frame/emphasize, or null if it's
   * independent of any specific text (e.g. a background pattern). */
  dependsOnGroupId: string | null;
}

export interface OverlayAnalysis {
  groups: OverlayGroup[];
  decorations: OverlayDecoration[];
}

const EMPTY_OVERLAY_ANALYSIS: OverlayAnalysis = { groups: [], decorations: [] };

export async function analyzeTextOverlayGroups(client: GoogleGenAI, refDataUrl: string): Promise<OverlayAnalysis> {
  const { mimeType, data } = stripDataUrl(refDataUrl);

  const result = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        {
          text: `Analyze every text and graphic overlay in this image and group them by MESSAGE, not by isolated text run.

A single headline that wraps across lines, or is visually broken by a decorative highlight/pill in the middle of the sentence, is ONE group — not several. Do not split one sentence into multiple groups just because a decoration sits inside it.

For each group, output:
- id: a short stable id like "g1", "g2"
- role: one of "headline", "subheadline", "cta" (button/link text whose job is to drive a click), "body" (long-form paragraph), "tag" (small category/label chip), "brand_identity" (a person's name, company name, signature, or logo text), "other"
- fullText: the complete wording of the group, copied verbatim, in reading order
- containerType: "button" | "pill" | "plain_text" | "badge" | "none"
- position: rough position like "top-left", "center", "bottom"

Then list purely decorative elements (shapes, highlights, underlines, pills) that exist ONLY to frame/emphasize a specific word or phrase inside one of the groups above — set dependsOnGroupId to that group's id. If a decoration is independent of any text (background pattern, generic graphic), set dependsOnGroupId to null.

Respond with ONLY this JSON, no markdown fences, no other commentary:
{"groups":[{"id":"g1","role":"headline","fullText":"...","containerType":"plain_text","position":"center"}],"decorations":[{"id":"d1","description":"...","dependsOnGroupId":"g1"}]}`
        },
        { inlineData: { mimeType, data } }
      ]
    }],
  });

  const parts2 = (result.candidates?.[0]?.content?.parts ?? []) as Part[];
  const raw = parts2.map(p => p.text ?? "").join("\n").trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[analyzeTextOverlayGroups] no JSON in model response:", raw.slice(0, 200));
    return EMPTY_OVERLAY_ANALYSIS;
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.groups)) return EMPTY_OVERLAY_ANALYSIS;
    return {
      groups: parsed.groups.filter((g: unknown): g is OverlayGroup =>
        !!g && typeof g === "object" && typeof (g as OverlayGroup).id === "string" && typeof (g as OverlayGroup).fullText === "string"),
      decorations: Array.isArray(parsed.decorations)
        ? parsed.decorations.filter((d: unknown): d is OverlayDecoration =>
            !!d && typeof d === "object" && typeof (d as OverlayDecoration).id === "string")
        : [],
    };
  } catch (e) {
    console.error("[analyzeTextOverlayGroups] JSON parse failed:", e);
    return EMPTY_OVERLAY_ANALYSIS;
  }
}

/**
 * ADAPT REFERENCE mode prompt — used when the caller supplies approved copy
 * as distinct headline/CTA fields (see analyzeTextOverlayGroups() above for
 * why). Distinct from the surgical-edit prompt in route.ts: that one treats
 * every overlay as independently preservable and is still what a freeform
 * one-line instruction ("clareie o fundo") goes through — this one assumes
 * the headline and CTA groups are being replaced WHOLESALE, and instructs
 * the model on what to do with fragments/decorations left behind by that
 * replacement instead of leaving it to guess.
 */
export function buildAdaptReferencePrompt(params: {
  headline: string;
  cta: string;
  analysis: OverlayAnalysis;
  aspectRatio: string;
}): string {
  const { headline, cta, analysis, aspectRatio } = params;
  const groupsText = analysis.groups.length
    ? analysis.groups.map(g => `- ${g.id} [${g.role}, ${g.containerType}, ${g.position}]: "${g.fullText}"`).join("\n")
    : "(none detected — treat the whole image as having no identifiable text groups; still remove any text that isn't the approved copy below)";
  const decorationsText = analysis.decorations.length
    ? analysis.decorations.map(d => `- ${d.id}: ${d.description}${d.dependsOnGroupId ? ` (depends on ${d.dependsOnGroupId})` : " (independent of any text)"}`).join("\n")
    : "(none detected)";

  return `ADAPT MODE — you are replacing this reference creative's message with new approved copy. The reference supplies visual direction (layout, photography, composition, color grade) — it is NOT the source of truth for wording or identity.

APPROVED COPY (use this exact wording verbatim — do not rewrite, shorten, or embellish it):
Headline: "${headline}"
CTA: "${cta}"

REFERENCE TEXT GROUPS (each one is a complete message; replace a group WHOLESALE, never patch part of it and leave the rest):
${groupsText}

DECORATIVE ELEMENTS TIED TO REFERENCE TEXT:
${decorationsText}

RULES — follow all of these:
1. Find the group with role "headline" (or "subheadline" if that is clearly the primary message). Replace its ENTIRE text with the approved headline above. Do not retain any word, clause, or trailing fragment of the old headline anywhere in the image — not even a partial sentence like "...não sabe." left dangling after the new text.
2. Find the group with role "cta". Replace the text INSIDE that same button/container with the approved CTA above — it must be the button's label, not a separate line of body text floating near the button. If no button/container exists for it, place the CTA as a clearly actionable button-style element in a sensible position.
3. For every decoration listed above that depends on the headline group: if the approved headline doesn't naturally contain a word/phrase in the same position to highlight the same way, REMOVE that decoration entirely and recompose the space cleanly. Never leave a decorative shape (pill, highlight, underline) floating with nothing left to frame.
4. Remove every group with role "brand_identity" (a person's name, signature, or company name belonging to the reference's original client) — it does not belong to this new creative. Do not invent a replacement identity; just remove it.
5. Every other group not covered above (tags, captions, secondary body text) stays exactly as in the reference, untouched.
6. Reflow lines, resize the CTA container, and adjust spacing as needed so the complete approved copy fits and stays legible at its intended size. Do not shrink essential text to illegible sizes, truncate the approved copy, or leave old wording in just to preserve the original layout's exact line breaks.

PRIORITY ORDER when these rules pull against matching the reference exactly:
1. The approved copy appears complete and correct, with nothing from the old copy mixed in.
2. Legibility at the intended display size.
3. Clear visual hierarchy.
4. Similarity to the reference's exact geometry (lowest priority — layout may reflow to satisfy the rules above).

Preserve everything else exactly: layout language, lighting, color grade, photography, and all non-text graphic elements not covered by the rules above. Do not add claims, names, numbers, or promotional wording beyond what's in the approved copy. High quality, photorealistic. Aspect ratio: ${aspectRatio}.`;
}

/**
 * Step 1b: Analyze the avatar image to extract every fine physical detail.
 * This feeds into Step 2 so the generated person is a faithful replica,
 * not just a "similar-looking" person.
 */
export async function analyzeAvatarDetails(client: GoogleGenAI, avatarDataUrl: string): Promise<string> {
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

/**
 * Post-generation safety check for local person patches. This is intentionally
 * much smaller than the full scene analysis: its only job is to report where
 * the generated person landed inside the returned patch so the compositor can
 * auto-align ordinary drift and reject only an untrustworthy/extreme result.
 */
export async function analyzeGeneratedPersonBounds(client: GoogleGenAI, imageDataUrl: string): Promise<string> {
  const resized = await resizeIfNeeded(imageDataUrl);
  const { mimeType, data } = stripDataUrl(resized);
  const result = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{
      role: "user",
      parts: [
        {
          text: `Locate the single visible person in this image. Return exactly one line and nothing else:
PERSON BOUNDS: left=__% top=__% right=__% bottom=__% confidence=high|medium|low

Measure the tight bounding box of every visible part of the person (hair, face, body, arms, hands, and clothing), relative to this image's own width and height from its top-left corner. Use confidence=high only when all visible edges are clear. If there is more than one distinct person or a duplicated/ghosted person, use confidence=low. If no person is visible, return exactly "PERSON BOUNDS: none".`,
        },
        { inlineData: { mimeType, data } },
      ],
    }],
    config: {
      temperature: 0,
      maxOutputTokens: 80,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const parts = (result.candidates?.[0]?.content?.parts ?? []) as Part[];
  return parts.map(part => part.text ?? "").join("\n").trim();
}

/**
 * Crops the avatar photo tightly around the visible person before it is sent
 * to the generation model as the identity reference. The avatar's OWN
 * background, room, and camera framing are never supposed to influence the
 * output — pose, crop, and background are meant to come entirely from the
 * reference image (see buildPersonSwapPrompt) — but a full, uncropped avatar
 * photo hands the model a large amount of competing visual context (its own
 * wall, lighting, selfie angle) that can outweigh the text instruction to
 * ignore it. Tightening the crop removes that competing signal without
 * removing anything the identity swap actually needs: analyzeAvatarDetails
 * (which captures jewelry/nails/clothing detail in text) always runs on the
 * original, uncropped photo separately, so no descriptive detail is lost
 * here even when this crop is generous. Reuses the same person-locating
 * prompt already used to validate generated patches, rather than a new,
 * unvalidated detection call. Best-effort: any failure just falls back to
 * the original, uncropped avatar photo — never a broken generation.
 */
export async function cropToPersonForIdentityRef(
  client: GoogleGenAI,
  avatarDataUrl: string,
): Promise<string> {
  try {
    const boundsText = await analyzeGeneratedPersonBounds(client, avatarDataUrl);
    const region = parsePersonRegion(boundsText);
    if (!region) return avatarDataUrl;

    const sharp = (await import("sharp")).default;
    const { data } = stripDataUrl(avatarDataUrl);
    const normalized = await sharp(Buffer.from(data, "base64"), { failOn: "error" })
      .rotate()
      .png()
      .toBuffer({ resolveWithObject: true });
    const { width, height } = normalized.info;
    if (!width || !height) return avatarDataUrl;

    const person = normalizedToPixels(region.bounds, width, height);
    const padX = Math.round(person.width * 0.35);
    const padTop = Math.round(person.height * 0.25);
    const padBottom = Math.round(person.height * 0.35);
    const left = clamp(person.left - padX, 0, width - 1);
    const top = clamp(person.top - padTop, 0, height - 1);
    const right = clamp(person.left + person.width + padX, left + 1, width);
    const bottom = clamp(person.top + person.height + padBottom, top + 1, height);
    const cropWidth = right - left;
    const cropHeight = bottom - top;
    // Skip crops that wouldn't meaningfully remove background anyway.
    if (cropWidth < 64 || cropHeight < 64 || cropWidth * cropHeight > width * height * 0.85) {
      return avatarDataUrl;
    }

    const cropped = await sharp(normalized.data)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .jpeg({ quality: 90 })
      .toBuffer();
    return `data:image/jpeg;base64,${cropped.toString("base64")}`;
  } catch {
    return avatarDataUrl;
  }
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 3000): Promise<T> {
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

export function extractImage(candidates: Array<{ finishReason?: string; content?: { parts?: unknown[] } }> | undefined | null) {
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

/**
 * The core person-swap prompt. Shared by the single-slide `/api/generate-design`
 * person-swap branch and the multi-slide `/api/generate-design-bleed` route so
 * prompt-engineering fixes apply to both instead of drifting apart.
 */
export function buildPersonSwapPrompt(params: {
  userRequestBlock: string;
  textOverlays: string;
  colorTreatment: string;
  bodyPose: string;
  avatarDesc: string;
  generationAspectRatio: string;
}): string {
  const {
    userRequestBlock,
    textOverlays,
    colorTreatment,
    bodyPose,
    avatarDesc,
    generationAspectRatio,
  } = params;
  const overlayPolicy = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEXT & GRAPHIC OVERLAYS in IMAGE 1 (reproduce verbatim UNLESS the user
request above explicitly asks to change that specific one):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${textOverlays}

ZERO-EXCEPTION TEXT/GRAPHIC RULE: Only the text and graphics explicitly
itemized above from IMAGE 1 may appear in the output (with wording changed
only when the USER REQUEST explicitly targets that item). Never add flavor
text, location names, brand names, logos, wordmarks, or any other word or
graphic that is not in that itemized IMAGE 1 overlay list, under any
circumstance.`;
  const geometryPolicy = `PERSON SCALE, FRAME OCCUPANCY, POSITION, HEAD POSE, GAZE & EXPRESSION in
IMAGE 1 (non-negotiable — treat the occupancy percentages, alignment, and
cropped frame edges below as hard layout constraints; copy them exactly
onto the IMAGE 2 person and do not enlarge, center, or reveal more of the
person):`;
  return `You are a world-class photo compositor doing a precise, surgical edit — not a redesign.

You are given two images:
• IMAGE 1 (the reference/template): the exact creative to reproduce. Its style, pose, crop/framing, background, lighting, color treatment, typography, and text diagramming are the template — copy them as precisely as if you were tracing over IMAGE 1.
• IMAGE 2 (the avatar): the person who must appear in the output instead of the person in IMAGE 1.

${userRequestBlock}

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

${overlayPolicy}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COLOR TREATMENT of IMAGE 1 (preserve exactly unless the user request explicitly asks to change it):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${colorTreatment}
This applies to the ENTIRE output image, including the newly-placed person —
e.g. if IMAGE 1 is black-and-white/monochrome, the person must also render
in black-and-white/monochrome, not in color.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${geometryPolicy}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${bodyPose}

━━━ AVATAR PERSON (IMAGE 2) — EXACT PHYSICAL DETAILS ━━━
${avatarDesc}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTION RULES:

THE PERSON (from IMAGE 2 — non-negotiable):
• Use IMAGE 2 as the DEFINITIVE visual reference for the person's identity
• Reproduce EVERY physical detail: exact nail color and length, each piece of jewelry on the correct finger/ear, exact hair color/texture/volume, exact eye color, skin tone, lip color
• FULL BODY replacement means full-person IDENTITY replacement, NOT full-body visibility: every part of the person that is VISIBLE inside IMAGE 1's existing crop — head, face, hair, neck, shoulders, torso, arms, hands, fingers, nails — must be IMAGE 2's identity, not just the face. It does NOT mean expanding the crop or making more of the person visible than IMAGE 1 shows. If IMAGE 1 reveals only a sliver of face or shoulder, show that exact same sliver, scaled and positioned identically — never a larger or more complete view.
• PERSON SCALE & FRAME OCCUPANCY ARE HARD, NON-NEGOTIABLE LAYOUT CONSTRAINTS: match the explicit width percentage, height percentage, horizontal/vertical position, and cropped frame edges in the PERSON SCALE, FRAME OCCUPANCY, POSITION, HEAD POSE, GAZE & EXPRESSION block above. The visible person must occupy the same fraction of the canvas and leave the same negative space for text/graphics; do not make the person larger, more centered, wider, or more prominent.
• Copy the EXACT pose, crop, and framing from IMAGE 1, per the PERSON SCALE, FRAME OCCUPANCY, POSITION, HEAD POSE, GAZE & EXPRESSION block above: same body orientation, same arm position, same hand placement, same head tilt and turn angle, same gaze direction (if IMAGE 1's subject looks away from camera, the output must too — do not default to direct eye contact), same mouth/facial expression, same distance/zoom level, same position within the frame — as if IMAGE 2's person had been physically photographed in IMAGE 1's exact spot, with the exact same camera never moving
• DO NOT zoom out, zoom in, or otherwise change the camera distance. If IMAGE 1 is a tight close-up showing only the face (or face and shoulders), the output must be that SAME tight crop — do not reveal more of the body, more clothing, or more of the room than IMAGE 1 shows. If IMAGE 1 shows the full body, keep it a full body shot. Match IMAGE 1's crop boundary exactly.
• Clothing/outfit: match IMAGE 1's styling (silhouette, color, formality) unless the user request says otherwise — and only to the extent it's actually visible within IMAGE 1's crop
• IMAGE 2 contributes identity and physical appearance only. Never reproduce any text, logo, wordmark, branding, or graphic printed on IMAGE 2's clothing or accessories; clothing/accessory markings from the avatar must be omitted. Only text/graphics belonging to the itemized overlays from IMAGE 1 are allowed in the output.
• NEVER add any object, prop, or accessory that is not clearly visible in IMAGE 1 and was not explicitly requested by the user — no microphones, extra phones, glasses, headphones, jewelry, or other items invented because they seem thematically fitting. If IMAGE 1's hands are empty or holding one specific object, the output's hands must hold that same object (or nothing) — never a different or additional object — UNLESS the USER REQUEST above explicitly asks for a specific different object, in which case replace only that object, keeping the same grip/hand position, and invent nothing beyond what the user asked for.
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
3. Head angle, gaze direction, and facial expression must match the PERSON SCALE, FRAME OCCUPANCY, POSITION, HEAD POSE, GAZE & EXPRESSION block above — NOT a generic neutral face looking straight at the camera. A common failure is defaulting to a plain frontal look-at-camera pose because it's "safe" — if IMAGE 1's subject has their head turned, is looking off to the side, or has a distinctive expression, the output must reproduce that specific pose, not a more standard/generic one.
4. The visible person's scale and position must match the PERSON SCALE, FRAME OCCUPANCY, POSITION, HEAD POSE, GAZE & EXPRESSION block above: same percentage of frame width and height, same alignment, and same edges cropped. If IMAGE 1 shows a narrow partial sliver at an edge, the output must remain that same narrow sliver — never enlarge, center, widen, or complete the person into a conventional portrait.
Aspect ratio: ${generationAspectRatio}.`;
}
