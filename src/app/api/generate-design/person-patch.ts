export interface NormalizedRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PersonRegion {
  bounds: NormalizedRect;
  confidence: "high" | "medium";
}

export interface PersonPatchPlan {
  original: Buffer;
  cropImage: Buffer;
  /** Generous scene context sent to Gemini. This never defines what may change. */
  contextCrop: PixelRect;
  /** Tight source-person box, localized to contextCrop, used to build the edit mask. */
  personInContext: PixelRect;
  /** Original text/logo pixels that are always re-stamped after the person composite. */
  protectedInContext: PixelRect[];
  personInOriginal: PixelRect;
  expandedContext: PixelRect;
  fullWidth: number;
  fullHeight: number;
  generationAspectRatio: string;
}

export interface PersonPatchDiagnostics {
  originalBBox: PixelRect;
  expandedBBox: PixelRect;
  generatedBBox: PixelRect;
  alignedBBox: PixelRect;
  iou: number;
  alignedIou: number;
  centerShift: { x: number; y: number };
  alignedCenterShift: { x: number; y: number };
  scaleRatio: { x: number; y: number };
  appliedScale: { x: number; y: number };
}

export type PersonPatchPreparation =
  | { plan: PersonPatchPlan; reason?: never }
  | { plan: null; reason: string };

export type PersonPatchComposite =
  | { buffer: Buffer; diagnostics: PersonPatchDiagnostics; reason?: never }
  | { buffer: null; reason: string; diagnostics?: Partial<PersonPatchDiagnostics> };

/**
 * One source of truth for person-patch geometry, retry, and validation policy.
 * Ratios are relative to the detected source-person width/height unless noted.
 */
export const PERSON_PATCH_CONFIG = {
  BASE_PADDING_X: 0.24,
  BASE_PADDING_TOP: 0.20,
  BASE_PADDING_BOTTOM: 0.18,
  MIN_CANVAS_PADDING_RATIO: 0.025,
  MAX_EXTRA_CONTEXT_RATIO: 0.30,
  MIN_PADDING_PX: 12,
  RETRY_COUNT: 3,
  RETRY_CONTEXT_EXPANSION: [0, 0.15, 0.30] as const,
  MAX_SOURCE_PERSON_AREA_RATIO: 0.85,
  MAX_CONTEXT_CROP_AREA_RATIO: 0.92,
  // Pre-alignment trust limits. A bbox outside these bounds is more likely a
  // different pose/crop (or duplicate person) than harmless model drift.
  MAX_CENTER_SHIFT: 0.70,
  MIN_SCALE_RATIO: 0.55,
  MAX_SCALE_RATIO: 1.80,
  MIN_IOU: 0.03,
  MAX_NON_UNIFORM_CORRECTION: 1.50,
  // The transformed bbox should land very close to the source bbox. These
  // allow only interpolation/rounding residue after deterministic alignment.
  MAX_RESIDUAL_CENTER_SHIFT: 0.04,
  MIN_RESIDUAL_SCALE_RATIO: 0.94,
  MAX_RESIDUAL_SCALE_RATIO: 1.06,
  MIN_RESIDUAL_IOU: 0.88,
  MAX_GENERATED_ASPECT_DRIFT: 0.03,
  MASK_FEATHER_RATIO: 0.10,
  MASK_MIN_FEATHER_PX: 24,
  MASK_MAX_FEATHER_PX: 120,
  MASK_PERSON_PADDING_RATIO: 0.18,
  PIXEL_INTEGRITY_EPSILON: 0,
} as const;

const PATCH_ASPECT_RATIOS = [
  { label: "9:16", value: 9 / 16 },
  { label: "2:3", value: 2 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:2", value: 3 / 2 },
  { label: "16:9", value: 16 / 9 },
  { label: "21:9", value: 21 / 9 },
] as const;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function parsePercent(line: string, field: "left" | "top" | "right" | "bottom"): number | null {
  const value = line.match(new RegExp(`${field}\\s*(?:=|:|≈|~=|about|approximately)?\\s*(-?\\d+(?:\\.\\d+)?)\\s*%`, "i"))?.[1];
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRectLine(line: string): NormalizedRect | null {
  const left = parsePercent(line, "left");
  const top = parsePercent(line, "top");
  const right = parsePercent(line, "right");
  const bottom = parsePercent(line, "bottom");
  if (left === null || top === null || right === null || bottom === null) return null;
  if (left < 0 || top < 0 || right > 100 || bottom > 100 || right <= left || bottom <= top) return null;
  return { left, top, right, bottom };
}

export function parsePersonRegion(bodyPose: string): PersonRegion | null {
  const line = bodyPose
    .split(/\r?\n/)
    .find(candidate => /PERSON BOUNDS/i.test(candidate));
  if (!line) return null;

  const bounds = parseRectLine(line);
  const confidence = line.match(/confidence\s*(?:=|:)\s*(high|medium|low)/i)?.[1]?.toLowerCase();
  if (!bounds || (confidence !== "high" && confidence !== "medium")) return null;

  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  if (width < 3 || height < 8) return null;
  return { bounds, confidence };
}

export function parseProtectedRegions(textOverlays: string): NormalizedRect[] {
  const seen = new Set<string>();
  const regions: NormalizedRect[] = [];

  for (const line of textOverlays.split(/\r?\n/)) {
    if (!/PROTECTED PIXEL BOUNDS/i.test(line)) continue;
    const rect = parseRectLine(line);
    if (!rect) continue;
    const area = (rect.right - rect.left) * (rect.bottom - rect.top) / 10_000;
    // Large regions are usually background panels rather than literal overlay
    // pixels. Applying a rectangular hole for one would retain the old person.
    if (area > 0.35) continue;
    const key = `${rect.left}:${rect.top}:${rect.right}:${rect.bottom}`;
    if (!seen.has(key)) {
      seen.add(key);
      regions.push(rect);
    }
  }

  return regions;
}

export function analysisExplicitlyHasNoOverlays(textOverlays: string): boolean {
  return /NO (?:VISIBLE )?TEXT (?:OR|AND) GRAPHIC OVERLAYS/i.test(textOverlays);
}

export function normalizedToPixels(rect: NormalizedRect, width: number, height: number): PixelRect {
  const left = clamp(Math.floor(rect.left / 100 * width), 0, width - 1);
  const top = clamp(Math.floor(rect.top / 100 * height), 0, height - 1);
  const right = clamp(Math.ceil(rect.right / 100 * width), left + 1, width);
  const bottom = clamp(Math.ceil(rect.bottom / 100 * height), top + 1, height);
  return { left, top, width: right - left, height: bottom - top };
}

function intersectionArea(a: PixelRect, b: PixelRect): number {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
}

function intersectionOverUnion(a: PixelRect, b: PixelRect): number {
  const intersection = intersectionArea(a, b);
  const union = a.width * a.height + b.width * b.height - intersection;
  return union > 0 ? intersection / union : 0;
}

function containingRectAtAspect(
  rect: PixelRect,
  canvasWidth: number,
  canvasHeight: number,
  aspect: number,
): PixelRect | null {
  let width = Math.max(rect.width, Math.ceil(rect.height * aspect));
  const height = Math.max(rect.height, Math.ceil(width / aspect));
  width = Math.max(width, Math.ceil(height * aspect));

  if (width > canvasWidth || height > canvasHeight) return null;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const left = clamp(Math.round(centerX - width / 2), 0, canvasWidth - width);
  const top = clamp(Math.round(centerY - height / 2), 0, canvasHeight - height);
  const candidate = { left, top, width, height };
  const contains = candidate.left <= rect.left
    && candidate.top <= rect.top
    && candidate.left + candidate.width >= rect.left + rect.width
    && candidate.top + candidate.height >= rect.top + rect.height;
  return contains ? candidate : null;
}

function localizeRect(rect: PixelRect, crop: PixelRect): PixelRect | null {
  const left = Math.max(rect.left, crop.left);
  const top = Math.max(rect.top, crop.top);
  const right = Math.min(rect.left + rect.width, crop.left + crop.width);
  const bottom = Math.min(rect.top + rect.height, crop.top + crop.height);
  if (right <= left || bottom <= top) return null;
  return { left: left - crop.left, top: top - crop.top, width: right - left, height: bottom - top };
}

export async function preparePersonPatch(
  sourceBuffer: Buffer,
  personRegion: PersonRegion,
  protectedRegions: NormalizedRect[],
  requireProtectedRegions: boolean,
  options: { extraContextRatio?: number } = {},
): Promise<PersonPatchPreparation> {
  // NOTE: this used to hard-reject the whole plan whenever the overlay
  // scan reported zero protected regions on a slide that clearly has text
  // (`requireProtectedRegions` true) — on the theory that we can't safely
  // guarantee text protection without at least one detected box. In
  // practice the vision model's free-text bounding-box format is brittle
  // enough (one malformed line out of several overlays and the whole
  // response parses to zero) that this triggered far more often than a
  // genuine "there is text this pipeline can't protect" situation, and it
  // made every retry attempt fail identically (this input never changes
  // between attempts) — i.e. it was the dominant cause of "replacement
  // wasn't safe, original kept" on ordinary slides. It is intentionally
  // NOT reinstated: the composite's real protection against touching text
  // is structural, not this pre-check — every pixel outside the person
  // mask always comes from the untouched original regardless of whether
  // any protected region was detected (see compositePersonPatch/
  // buildPersonPatchMask). `protectedInContext` (populated below, possibly
  // empty) only adds a belt-and-suspenders re-stamp for the narrower case
  // of a text/logo box that happens to overlap the person's own mask area;
  // an empty list here just means that extra re-stamp has nothing to do,
  // not that background/text elsewhere is at risk.
  void requireProtectedRegions;

  try {
    const sharp = (await import("sharp")).default;
    // Auto-orient once, then use this same decoded source both for extraction
    // and the final composite so all geometry is in display coordinates.
    const normalized = await sharp(sourceBuffer, { failOn: "error" })
      .rotate()
      .png()
      .toBuffer({ resolveWithObject: true });
    const fullWidth = normalized.info.width;
    const fullHeight = normalized.info.height;
    if (!fullWidth || !fullHeight || fullWidth < 256 || fullHeight < 256) {
      return { plan: null, reason: "reference dimensions are too small" };
    }

    const person = normalizedToPixels(personRegion.bounds, fullWidth, fullHeight);
    const personAreaRatio = person.width * person.height / (fullWidth * fullHeight);
    if (
      person.width < 32
      || person.height < 64
      || personAreaRatio > PERSON_PATCH_CONFIG.MAX_SOURCE_PERSON_AREA_RATIO
    ) {
      return { plan: null, reason: "person bounds are implausible for a local patch" };
    }

    const pixelProtected = protectedRegions.map(rect => normalizedToPixels(rect, fullWidth, fullHeight));
    const extraContextRatio = clamp(
      options.extraContextRatio ?? 0,
      0,
      PERSON_PATCH_CONFIG.MAX_EXTRA_CONTEXT_RATIO,
    );
    const minimumMaskContext = Math.max(
      clamp(
        Math.round(Math.min(person.width, person.height) * PERSON_PATCH_CONFIG.MASK_FEATHER_RATIO),
        PERSON_PATCH_CONFIG.MASK_MIN_FEATHER_PX,
        PERSON_PATCH_CONFIG.MASK_MAX_FEATHER_PX,
      ),
      Math.round(Math.min(person.width, person.height) * PERSON_PATCH_CONFIG.MASK_PERSON_PADDING_RATIO),
    );
    const computePadded = (padX: number, padTop: number, padBottom: number) => {
      const paddedLeft = Math.max(0, person.left - padX);
      const paddedTop = Math.max(0, person.top - padTop);
      const paddedRight = Math.min(fullWidth, person.left + person.width + padX);
      const paddedBottom = Math.min(fullHeight, person.top + person.height + padBottom);
      return {
        left: paddedLeft,
        top: paddedTop,
        width: paddedRight - paddedLeft,
        height: paddedBottom - paddedTop,
      };
    };
    const findCandidate = (rect: PixelRect) => PATCH_ASPECT_RATIOS.flatMap(candidate => {
      const crop = containingRectAtAspect(rect, fullWidth, fullHeight, candidate.value);
      return crop ? [{ ...candidate, crop }] : [];
    }).sort((a, b) => a.crop.width * a.crop.height - b.crop.width * b.crop.height)[0];

    const padX = Math.max(
      PERSON_PATCH_CONFIG.MIN_PADDING_PX,
      minimumMaskContext,
      Math.round(fullWidth * PERSON_PATCH_CONFIG.MIN_CANVAS_PADDING_RATIO),
      Math.round(person.width * (PERSON_PATCH_CONFIG.BASE_PADDING_X + extraContextRatio)),
    );
    const padTop = Math.max(
      PERSON_PATCH_CONFIG.MIN_PADDING_PX,
      minimumMaskContext,
      Math.round(fullHeight * PERSON_PATCH_CONFIG.MIN_CANVAS_PADDING_RATIO),
      Math.round(person.height * (PERSON_PATCH_CONFIG.BASE_PADDING_TOP + extraContextRatio)),
    );
    const padBottom = Math.max(
      PERSON_PATCH_CONFIG.MIN_PADDING_PX,
      minimumMaskContext,
      Math.round(fullHeight * PERSON_PATCH_CONFIG.MIN_CANVAS_PADDING_RATIO),
      Math.round(person.height * (PERSON_PATCH_CONFIG.BASE_PADDING_BOTTOM + extraContextRatio)),
    );
    let padded = computePadded(padX, padTop, padBottom);
    let selected = findCandidate(padded);

    // A person filling a large fraction of the frame can make the fully
    // padded rect exceed the canvas at every supported aspect ratio — this
    // is a deterministic function of the person's own size, so it fails
    // identically on every retry regardless of the caller's extraContextRatio
    // (which only ever adds more padding, never less). Before giving up,
    // retry once with just the minimum padding mask feathering actually
    // needs — still enough for a clean blend, just without the generous
    // extra context — rather than falling back to the original untouched
    // image for every hero/close-up shot in a carousel.
    if (!selected) {
      const minPad = Math.max(PERSON_PATCH_CONFIG.MIN_PADDING_PX, minimumMaskContext);
      padded = computePadded(minPad, minPad, minPad);
      selected = findCandidate(padded);
    }

    // A person occupying nearly the full frame on one axis (e.g. a close-up
    // selfie where the visible body spans ~85% of the frame height) can leave
    // no aspect-ratio candidate able to both fit inside the canvas AND fully
    // contain the padded person rect — every supported ratio either overflows
    // the canvas or, once shrunk to fit, is too small to contain the person's
    // own extent. There's no ratio to fall back to as a wider frame in that
    // case, so use the full source canvas itself as the context crop: it
    // trivially contains any rect and stays localized (still not a full
    // redesign — the person mask/pixel-integrity checks downstream are
    // unaffected), which is far better than abandoning the local patch
    // entirely for every tight/close-up reference photo.
    let usedFullCanvasFallback = false;
    if (!selected) {
      const nativeAspect = fullWidth / fullHeight;
      const closestLabel = PATCH_ASPECT_RATIOS
        .reduce((best, candidate) => (
          Math.abs(candidate.value - nativeAspect) < Math.abs(best.value - nativeAspect) ? candidate : best
        ));
      selected = { ...closestLabel, crop: { left: 0, top: 0, width: fullWidth, height: fullHeight } };
      usedFullCanvasFallback = true;
    }

    const cropAreaRatio = selected.crop.width * selected.crop.height / (fullWidth * fullHeight);
    // The full-canvas fallback above is itself the deliberate last resort for
    // a person that no supported aspect ratio could otherwise contain — its
    // whole point is to cover the full reference, so this area cap (meant to
    // catch accidentally oversized crops from the normal padding path) does
    // not apply to it.
    if (!usedFullCanvasFallback && cropAreaRatio > PERSON_PATCH_CONFIG.MAX_CONTEXT_CROP_AREA_RATIO) {
      return { plan: null, reason: "safe crop would cover almost the full reference" };
    }

    const cropImage = await sharp(normalized.data)
      .extract(selected.crop)
      .png()
      .toBuffer();
    const personInContext = localizeRect(person, selected.crop);
    if (!personInContext) return { plan: null, reason: "person does not intersect computed crop" };

    const protectedInContext = pixelProtected.flatMap(rect => {
      const local = localizeRect(rect, selected.crop);
      return local ? [local] : [];
    });

    return {
      plan: {
        original: normalized.data,
        cropImage,
        contextCrop: selected.crop,
        personInContext,
        protectedInContext,
        personInOriginal: person,
        expandedContext: padded,
        fullWidth,
        fullHeight,
        generationAspectRatio: selected.label,
      },
    };
  } catch (error) {
    return {
      plan: null,
      reason: `image preparation failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Builds the actual allowed person-edit shape. It is deliberately independent
 * from contextCrop: increasing model context never increases the replaceable
 * region. The source-person rectangle stays fully opaque, while the outer
 * transition follows an ellipse rather than four picture-frame edges.
 */
export function buildPersonPatchMask(plan: PersonPatchPlan): Buffer {
  const { width, height } = plan.contextCrop;
  const person = plan.personInContext;
  const personRight = person.left + person.width;
  const personBottom = person.top + person.height;
  const feather = clamp(
    Math.round(Math.min(person.width, person.height) * PERSON_PATCH_CONFIG.MASK_FEATHER_RATIO),
    PERSON_PATCH_CONFIG.MASK_MIN_FEATHER_PX,
    PERSON_PATCH_CONFIG.MASK_MAX_FEATHER_PX,
  );
  const blendPadding = Math.max(
    feather,
    Math.round(Math.min(person.width, person.height) * PERSON_PATCH_CONFIG.MASK_PERSON_PADDING_RATIO),
  );
  const halfWidth = person.width / 2;
  const halfHeight = person.height / 2;
  const centerX = person.left + halfWidth;
  const centerY = person.top + halfHeight;
  // This outer ellipse creates rounded body-like shoulders/corners. The core
  // rectangle is still filled separately, as required, even where its corner
  // falls outside the ellipse's curved transition.
  const outerRadiusX = halfWidth + blendPadding;
  const outerRadiusY = halfHeight + blendPadding;
  const mask = Buffer.alloc(width * height);

  for (let y = 0; y < height; y++) {
    const py = y + 0.5;
    const dy = py - centerY;
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      if (px >= person.left && px < personRight && py >= person.top && py < personBottom) {
        mask[rowOffset + x] = 255;
        continue;
      }

      const dx = px - centerX;
      const radialDistance = Math.hypot(dx, dy);
      if (radialDistance === 0) continue;
      const cos = Math.abs(dx) / radialDistance;
      const sin = Math.abs(dy) / radialDistance;
      const toInnerRect = Math.min(
        cos > 0 ? halfWidth / cos : Number.POSITIVE_INFINITY,
        sin > 0 ? halfHeight / sin : Number.POSITIVE_INFINITY,
      );
      const toOuterEllipse = 1 / Math.sqrt(
        (cos * cos) / (outerRadiusX * outerRadiusX)
        + (sin * sin) / (outerRadiusY * outerRadiusY),
      );
      if (radialDistance >= toOuterEllipse || toOuterEllipse <= toInnerRect) continue;
      const progress = (radialDistance - toInnerRect) / (toOuterEllipse - toInnerRect);
      mask[rowOffset + x] = Math.round(255 * (1 - smoothstep(progress)));
    }
  }

  return mask;
}

function buildAllowedEditMask(plan: PersonPatchPlan, personMask: Buffer): Buffer {
  const mask = Buffer.from(personMask);
  const { width } = plan.contextCrop;
  for (const protectedRect of plan.protectedInContext) {
    const right = protectedRect.left + protectedRect.width;
    const bottom = protectedRect.top + protectedRect.height;
    for (let y = protectedRect.top; y < bottom; y++) {
      const rowOffset = y * width;
      mask.fill(0, rowOffset + protectedRect.left, rowOffset + right);
    }
  }
  return mask;
}

export function buildPatchGeometryDirective(plan: PersonPatchPlan): string {
  const { contextCrop, personInContext, fullWidth, fullHeight } = plan;
  const percent = (value: number, total: number) => (value / total * 100).toFixed(1);
  const personRight = personInContext.left + personInContext.width;
  const personBottom = personInContext.top + personInContext.height;
  return `PROGRAMMATIC PERSON-PATCH MODE (hard constraint): IMAGE 1 is a CONTEXT CROP at x=${contextCrop.left}, y=${contextCrop.top}, width=${contextCrop.width}, height=${contextCrop.height} from an original ${fullWidth}x${fullHeight} reference. The surrounding pixels are context only and are not permission to edit them. Within this cropped IMAGE 1, the visible person bounds are left=${percent(personInContext.left, contextCrop.width)}%, top=${percent(personInContext.top, contextCrop.height)}%, right=${percent(personRight, contextCrop.width)}%, bottom=${percent(personBottom, contextCrop.height)}%. These are the only position percentages that apply to the cropped IMAGE 1; any full-slide/full-canvas coordinates elsewhere are context only and must not be applied to this crop. Replace only that person at those exact local bounds. Preserve the exact pose, framing, scale, perspective, camera angle, lighting, and shadows. Do not render, rewrite, move, add, remove, redesign, or reinterpret anything surrounding the person. Return the complete context crop at exactly the same dimensions and framing.`;
}

export function removeFullFrameGeometry(bodyPose: string): string {
  return bodyPose
    .split(/\r?\n/)
    .filter(line => !/FRAME OCCUPANCY & POSITION:|PERSON BOUNDS:/i.test(line))
    .join("\n")
    .trim();
}

interface GeometryMetrics {
  centerShift: { x: number; y: number };
  scaleRatio: { x: number; y: number };
  iou: number;
}

function measureGeometry(expected: PixelRect, actual: PixelRect): GeometryMetrics {
  const expectedCenterX = expected.left + expected.width / 2;
  const expectedCenterY = expected.top + expected.height / 2;
  const actualCenterX = actual.left + actual.width / 2;
  const actualCenterY = actual.top + actual.height / 2;
  return {
    centerShift: {
      x: Math.abs(actualCenterX - expectedCenterX) / expected.width,
      y: Math.abs(actualCenterY - expectedCenterY) / expected.height,
    },
    scaleRatio: {
      x: actual.width / expected.width,
      y: actual.height / expected.height,
    },
    iou: intersectionOverUnion(expected, actual),
  };
}

export function validateGeneratedPersonRegion(plan: PersonPatchPlan, generatedRegion: PersonRegion): string | null {
  const expected = plan.personInContext;
  const actual = normalizedToPixels(
    generatedRegion.bounds,
    plan.contextCrop.width,
    plan.contextCrop.height,
  );
  const metrics = measureGeometry(expected, actual);

  if (
    metrics.centerShift.x > PERSON_PATCH_CONFIG.MAX_CENTER_SHIFT
    || metrics.centerShift.y > PERSON_PATCH_CONFIG.MAX_CENTER_SHIFT
    || metrics.scaleRatio.x < PERSON_PATCH_CONFIG.MIN_SCALE_RATIO
    || metrics.scaleRatio.x > PERSON_PATCH_CONFIG.MAX_SCALE_RATIO
    || metrics.scaleRatio.y < PERSON_PATCH_CONFIG.MIN_SCALE_RATIO
    || metrics.scaleRatio.y > PERSON_PATCH_CONFIG.MAX_SCALE_RATIO
    || metrics.iou < PERSON_PATCH_CONFIG.MIN_IOU
  ) {
    return `generated person geometry is too extreme to auto-align (dx=${metrics.centerShift.x.toFixed(2)}, dy=${metrics.centerShift.y.toFixed(2)}, sx=${metrics.scaleRatio.x.toFixed(2)}, sy=${metrics.scaleRatio.y.toFixed(2)}, iou=${metrics.iou.toFixed(2)})`;
  }
  return null;
}

function validateAlignedGeometry(metrics: GeometryMetrics): string | null {
  if (
    metrics.centerShift.x > PERSON_PATCH_CONFIG.MAX_RESIDUAL_CENTER_SHIFT
    || metrics.centerShift.y > PERSON_PATCH_CONFIG.MAX_RESIDUAL_CENTER_SHIFT
    || metrics.scaleRatio.x < PERSON_PATCH_CONFIG.MIN_RESIDUAL_SCALE_RATIO
    || metrics.scaleRatio.x > PERSON_PATCH_CONFIG.MAX_RESIDUAL_SCALE_RATIO
    || metrics.scaleRatio.y < PERSON_PATCH_CONFIG.MIN_RESIDUAL_SCALE_RATIO
    || metrics.scaleRatio.y > PERSON_PATCH_CONFIG.MAX_RESIDUAL_SCALE_RATIO
    || metrics.iou < PERSON_PATCH_CONFIG.MIN_RESIDUAL_IOU
  ) {
    return `auto-aligned person geometry is still out of tolerance (dx=${metrics.centerShift.x.toFixed(2)}, dy=${metrics.centerShift.y.toFixed(2)}, sx=${metrics.scaleRatio.x.toFixed(2)}, sy=${metrics.scaleRatio.y.toFixed(2)}, iou=${metrics.iou.toFixed(2)})`;
  }
  return null;
}

async function verifyPixelIntegrity(
  plan: PersonPatchPlan,
  finalBuffer: Buffer,
  allowedEditMask: Buffer,
): Promise<string | null> {
  const sharp = (await import("sharp")).default;
  const [originalRaw, finalRaw] = await Promise.all([
    sharp(plan.original, { failOn: "error" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(finalBuffer, { failOn: "error" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (
    originalRaw.info.width !== plan.fullWidth
    || originalRaw.info.height !== plan.fullHeight
    || finalRaw.info.width !== plan.fullWidth
    || finalRaw.info.height !== plan.fullHeight
    || originalRaw.info.channels !== finalRaw.info.channels
  ) {
    return "pixel-integrity check found changed canvas dimensions or channels";
  }

  const channels = originalRaw.info.channels;
  const crop = plan.contextCrop;
  const epsilon = PERSON_PATCH_CONFIG.PIXEL_INTEGRITY_EPSILON;
  let changedPixels = 0;
  let maxDifference = 0;
  for (let y = 0; y < plan.fullHeight; y++) {
    const localY = y - crop.top;
    const insideCropY = localY >= 0 && localY < crop.height;
    for (let x = 0; x < plan.fullWidth; x++) {
      const localX = x - crop.left;
      const editable = insideCropY
        && localX >= 0
        && localX < crop.width
        && allowedEditMask[localY * crop.width + localX] > 0;
      if (editable) continue;

      const offset = (y * plan.fullWidth + x) * channels;
      let pixelChanged = false;
      for (let channel = 0; channel < channels; channel++) {
        const difference = Math.abs(originalRaw.data[offset + channel] - finalRaw.data[offset + channel]);
        if (difference > epsilon) {
          pixelChanged = true;
          maxDifference = Math.max(maxDifference, difference);
        }
      }
      if (pixelChanged) changedPixels++;
    }
  }

  return changedPixels > 0
    ? `pixel-integrity check failed outside edit mask (${changedPixels} pixels, max channel diff ${maxDifference})`
    : null;
}

export async function compositePersonPatch(
  plan: PersonPatchPlan,
  generatedImage: Buffer,
  generatedPersonRegion: PersonRegion,
): Promise<PersonPatchComposite> {
  try {
    const sharp = (await import("sharp")).default;
    const crop = plan.contextCrop;
    const expected = plan.personInContext;
    const integerGeometry = [
      plan.fullWidth, plan.fullHeight,
      crop.left, crop.top, crop.width, crop.height,
      expected.left, expected.top, expected.width, expected.height,
    ].every(Number.isInteger);
    const cropIsValid = crop.left >= 0
      && crop.top >= 0
      && crop.width > 0
      && crop.height > 0
      && crop.left + crop.width <= plan.fullWidth
      && crop.top + crop.height <= plan.fullHeight;
    const personIsValid = expected.left >= 0
      && expected.top >= 0
      && expected.width > 0
      && expected.height > 0
      && expected.left + expected.width <= crop.width
      && expected.top + expected.height <= crop.height;
    if (!integerGeometry || !cropIsValid || !personIsValid) {
      return { buffer: null, reason: "person-patch plan geometry is invalid" };
    }

    const originalMetadata = await sharp(plan.original, { failOn: "error" }).metadata();
    if (originalMetadata.width !== plan.fullWidth || originalMetadata.height !== plan.fullHeight) {
      return { buffer: null, reason: "person-patch original dimensions changed" };
    }

    const normalizedGenerated = await sharp(generatedImage, { failOn: "error" })
      .rotate()
      .png()
      .toBuffer({ resolveWithObject: true });
    const generatedWidth = normalizedGenerated.info.width;
    const generatedHeight = normalizedGenerated.info.height;
    if (!generatedWidth || !generatedHeight || generatedWidth < 64 || generatedHeight < 64) {
      return { buffer: null, reason: "generated patch dimensions are too small" };
    }
    const expectedAspect = crop.width / crop.height;
    const actualAspect = generatedWidth / generatedHeight;
    const aspectDrift = Math.abs(actualAspect / expectedAspect - 1);
    if (aspectDrift > PERSON_PATCH_CONFIG.MAX_GENERATED_ASPECT_DRIFT) {
      return { buffer: null, reason: `generated patch aspect ratio drifted by ${(aspectDrift * 100).toFixed(1)}%` };
    }
    if (normalizedGenerated.info.channels === 4) {
      const alpha = (await sharp(normalizedGenerated.data).stats()).channels[3];
      if (alpha && alpha.min < 255) {
        return { buffer: null, reason: "generated patch contains transparent pixels" };
      }
    }

    // Normalize the model output into context-crop coordinates first. From
    // here onward the vision bbox, source bbox, mask, and transform all share
    // the same coordinate system.
    const normalizedPatch = await sharp(normalizedGenerated.data)
      .resize({
        width: crop.width,
        height: crop.height,
        fit: "fill",
      })
      .removeAlpha()
      .png()
      .toBuffer();

    const generatedBBox = normalizedToPixels(generatedPersonRegion.bounds, crop.width, crop.height);
    const before = measureGeometry(expected, generatedBBox);
    const diagnosticsBase = {
      originalBBox: plan.personInOriginal,
      expandedBBox: plan.expandedContext,
      generatedBBox,
      iou: before.iou,
      centerShift: before.centerShift,
      scaleRatio: before.scaleRatio,
    };
    const geometryError = validateGeneratedPersonRegion(plan, generatedPersonRegion);
    if (geometryError) return { buffer: null, reason: geometryError, diagnostics: diagnosticsBase };

    const correctionScaleX = expected.width / generatedBBox.width;
    const correctionScaleY = expected.height / generatedBBox.height;
    const nonUniformity = Math.max(correctionScaleX, correctionScaleY) / Math.min(correctionScaleX, correctionScaleY);
    if (nonUniformity > PERSON_PATCH_CONFIG.MAX_NON_UNIFORM_CORRECTION) {
      return {
        buffer: null,
        reason: `generated pose would require excessive non-uniform correction (${nonUniformity.toFixed(2)}x)`,
        diagnostics: diagnosticsBase,
      };
    }

    const scaledWidth = Math.max(1, Math.round(crop.width * correctionScaleX));
    const scaledHeight = Math.max(1, Math.round(crop.height * correctionScaleY));
    const appliedScaleX = scaledWidth / crop.width;
    const appliedScaleY = scaledHeight / crop.height;
    const scaledPatch = await sharp(normalizedPatch)
      .resize({ width: scaledWidth, height: scaledHeight, fit: "fill" })
      .png()
      .toBuffer();

    // Output pixel (0,0) samples this location in the scaled generation. A
    // negative source origin becomes original-context padding; a positive one
    // becomes extraction. In both cases the generated bbox maps onto expected.
    const sourceLeft = Math.round(generatedBBox.left * appliedScaleX - expected.left);
    const sourceTop = Math.round(generatedBBox.top * appliedScaleY - expected.top);
    const extractLeft = Math.max(0, sourceLeft);
    const extractTop = Math.max(0, sourceTop);
    const destinationLeft = Math.max(0, -sourceLeft);
    const destinationTop = Math.max(0, -sourceTop);
    const extractWidth = Math.min(scaledWidth - extractLeft, crop.width - destinationLeft);
    const extractHeight = Math.min(scaledHeight - extractTop, crop.height - destinationTop);
    if (extractWidth <= 0 || extractHeight <= 0) {
      return { buffer: null, reason: "auto-alignment moved the generated patch outside the context crop", diagnostics: diagnosticsBase };
    }
    // When correctionScale shrinks the patch (the generated person came out
    // larger than expected — a documented recurring failure mode), the scaled
    // source can end up smaller than the context crop in one or both
    // dimensions. Extracting/compositing then leaves a gap that would fall
    // back to `alignedPatch`'s base layer — which is `plan.cropImage`, i.e.
    // the ORIGINAL person's pixels. If that gap overlaps the mandatory
    // always-opaque person core, the final composite would silently mix the
    // old identity back in, exactly the half-old/half-new defect this
    // pipeline exists to prevent. Reject and let the retry loop try again
    // rather than ship a partially-original person.
    const coveredRight = destinationLeft + extractWidth;
    const coveredBottom = destinationTop + extractHeight;
    const personFullyCovered = destinationLeft <= expected.left
      && destinationTop <= expected.top
      && coveredRight >= expected.left + expected.width
      && coveredBottom >= expected.top + expected.height;
    if (!personFullyCovered) {
      return {
        buffer: null,
        reason: "auto-alignment could not fully cover the source-person region with generated pixels",
        diagnostics: diagnosticsBase,
      };
    }

    const transformedFragment = await sharp(scaledPatch)
      .extract({ left: extractLeft, top: extractTop, width: extractWidth, height: extractHeight })
      .png()
      .toBuffer();
    const alignedPatch = await sharp(plan.cropImage)
      .composite([{ input: transformedFragment, left: destinationLeft, top: destinationTop }])
      .removeAlpha()
      .png()
      .toBuffer();
    const alignedBBox: PixelRect = {
      left: generatedBBox.left * appliedScaleX - sourceLeft,
      top: generatedBBox.top * appliedScaleY - sourceTop,
      width: generatedBBox.width * appliedScaleX,
      height: generatedBBox.height * appliedScaleY,
    };
    const after = measureGeometry(expected, alignedBBox);
    const diagnostics: PersonPatchDiagnostics = {
      ...diagnosticsBase,
      alignedBBox,
      alignedIou: after.iou,
      alignedCenterShift: after.centerShift,
      appliedScale: { x: appliedScaleX, y: appliedScaleY },
    };
    const alignedGeometryError = validateAlignedGeometry(after);
    if (alignedGeometryError) {
      return { buffer: null, reason: alignedGeometryError, diagnostics };
    }

    const personMask = buildPersonPatchMask(plan);
    const maskedPatch = await sharp(alignedPatch)
      .joinChannel(personMask, {
        raw: { width: crop.width, height: crop.height, channels: 1 },
      })
      .png()
      .toBuffer();

    // Apply the complete person mask first. Protected overlay rectangles are
    // intentionally not holes in this mask: their exact original pixels are
    // re-stamped unconditionally in a separate, final composite operation.
    let buffer = await sharp(plan.original)
      .composite([{
        input: maskedPatch,
        left: crop.left,
        top: crop.top,
        blend: "over",
      }])
      .png()
      .toBuffer();

    if (plan.protectedInContext.length > 0) {
      const protectedRestamps = await Promise.all(plan.protectedInContext.map(async rect => ({
        input: await sharp(plan.cropImage).extract(rect).png().toBuffer(),
        left: crop.left + rect.left,
        top: crop.top + rect.top,
      })));
      buffer = await sharp(buffer).composite(protectedRestamps).png().toBuffer();
    }

    const finalMetadata = await sharp(buffer, { failOn: "error" }).metadata();
    if (finalMetadata.width !== plan.fullWidth || finalMetadata.height !== plan.fullHeight) {
      return { buffer: null, reason: "person-patch composite changed canvas dimensions", diagnostics };
    }
    const allowedEditMask = buildAllowedEditMask(plan, personMask);
    const integrityError = await verifyPixelIntegrity(plan, buffer, allowedEditMask);
    if (integrityError) return { buffer: null, reason: integrityError, diagnostics };

    return { buffer, diagnostics };
  } catch (error) {
    return {
      buffer: null,
      reason: `image composite failed: ${error instanceof Error ? error.message : "unknown error"}`,
    };
  }
}
