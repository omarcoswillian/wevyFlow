// Single canonical shape for a Lançamento's briefing — what the Home page,
// the onboarding wizard and the LaunchWizard all read from and write to.
// No server-only imports here: this module is also used from client
// components before anything gets persisted.
import type { BrandInfo, StrategyId } from "./types-kit";
import { LAUNCH_STRATEGIES } from "./launch-strategies";

/** The server-side source of truth for "is this a real strategy id" — used
 * both to gate activation and to reject an unknown id outright, instead of
 * silently accepting e.g. "nao-existe" (see launches review item 5). */
export function isValidStrategyId(id: unknown): id is StrategyId {
  return typeof id === "string" && LAUNCH_STRATEGIES.some((s) => s.id === id);
}

export const BRIEFING_SCHEMA_VERSION = 1;

export interface LaunchBriefing {
  schemaVersion: number;
  description: string; // full free-text description as typed on the Home prompt
  productName: string;
  niche: string;
  targetAudience: string;
  transformation: string;
  mecanismo: string;
  preco: string;
  provas: string;
  launchType: string; // e.g. "Perpétuo", "Meteórico" — the Home's own vocabulary, distinct from StrategyId
  referenceUrl: string;
  copyDocument: string;
  primaryColor: string;
  secondaryColor: string;
  fontChoice: string;
  stylePreset: string;
  referenceImages: string[];
  referenceBrands: string;
  logoUrl: string;
}

// Explicit, generous-but-bounded limits — reject with a validation error
// instead of silently truncating anything the user typed.
export const BRIEFING_LIMITS = {
  description: 4000,
  productName: 200,
  niche: 200,
  targetAudience: 400,
  transformation: 2000,
  mecanismo: 2000,
  preco: 200,
  provas: 4000,
  launchType: 60,
  referenceUrl: 2000,
  copyDocument: 20000,
  referenceBrands: 400,
  logoUrl: 2000,
  primaryColor: 32,
  secondaryColor: 32,
  fontChoice: 60,
  stylePreset: 60,
  maxReferenceImages: 4,
  maxTotalRequestBytes: 2_000_000, // ~2MB — mostly bounded by referenceImages (base64)
};

export function emptyBriefing(): LaunchBriefing {
  return {
    schemaVersion: BRIEFING_SCHEMA_VERSION,
    description: "",
    productName: "",
    niche: "",
    targetAudience: "",
    transformation: "",
    mecanismo: "",
    preco: "",
    provas: "",
    launchType: "",
    referenceUrl: "",
    copyDocument: "",
    primaryColor: "#a78bfa",
    secondaryColor: "#6366f1",
    fontChoice: "sora",
    stylePreset: "dark-premium",
    referenceImages: [],
    referenceBrands: "",
    logoUrl: "",
  };
}

/** Merge a partial patch on top of an existing briefing without ever
 * dropping `description` just because other fields got filled in later. */
export function mergeBriefing(
  base: LaunchBriefing,
  patch: Partial<LaunchBriefing>
): LaunchBriefing {
  return { ...base, ...patch, schemaVersion: BRIEFING_SCHEMA_VERSION };
}

export interface BriefingValidationError {
  field: string;
  message: string;
}

const STRING_FIELDS = [
  "description", "productName", "niche", "targetAudience", "transformation",
  "mecanismo", "preco", "provas", "launchType", "referenceUrl", "copyDocument",
  "referenceBrands", "logoUrl", "primaryColor", "secondaryColor", "fontChoice",
  "stylePreset",
] as const satisfies readonly (keyof LaunchBriefing)[];

/** Client-side + server-side shared validation. Server validation is the
 * one that's actually enforced (see requireLaunch/save_launch); this is
 * also called client-side purely to drive UI, never trusted alone.
 *
 * Rejects wrong-typed fields outright instead of silently ignoring them —
 * a prior version only checked `.length` when a field happened to already
 * be a string, so e.g. `productName: 42` passed validation and then threw
 * an unhandled exception downstream (see launches review item 5). */
export function validateBriefing(b: Partial<Record<keyof LaunchBriefing, unknown>>): BriefingValidationError[] {
  const errors: BriefingValidationError[] = [];

  for (const field of STRING_FIELDS) {
    const value = b[field];
    if (value === undefined) continue;
    if (typeof value !== "string") {
      errors.push({ field, message: `${field} deve ser um texto.` });
      continue;
    }
    const limit = BRIEFING_LIMITS[field] as number;
    if (value.length > limit) {
      errors.push({ field, message: `${field} excede o limite de ${limit} caracteres.` });
    }
  }

  if (b.referenceImages !== undefined) {
    if (!Array.isArray(b.referenceImages) || b.referenceImages.some((v) => typeof v !== "string")) {
      errors.push({ field: "referenceImages", message: "referenceImages deve ser uma lista de textos (data URLs)." });
    } else if (b.referenceImages.length > BRIEFING_LIMITS.maxReferenceImages) {
      errors.push({
        field: "referenceImages",
        message: `Máximo de ${BRIEFING_LIMITS.maxReferenceImages} imagens de referência.`,
      });
    }
  }

  if (b.schemaVersion !== undefined && typeof b.schemaVersion !== "number") {
    errors.push({ field: "schemaVersion", message: "schemaVersion deve ser um número." });
  }

  const approxBytes = JSON.stringify(b).length;
  if (approxBytes > BRIEFING_LIMITS.maxTotalRequestBytes) {
    errors.push({ field: "_root", message: "Briefing excede o tamanho máximo permitido." });
  }

  return errors;
}

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** Minimum fields required to activate a launch (leave draft) and to
 * generate anything from it. Mirrors the DB CHECK constraint in
 * launch_kits_active_requires_briefing — keep both in sync.
 *
 * Guards field types explicitly (not `b.productName?.trim()`, which only
 * guards null/undefined — a wrong-typed value like `productName: 42` would
 * still throw calling `.trim()` on a number) and rejects any strategyId
 * that isn't one of the known LAUNCH_STRATEGIES ids (see review item 5). */
export function isBriefingActivatable(
  b: Partial<Record<keyof LaunchBriefing, unknown>>,
  strategyId: unknown
): boolean {
  return !!(
    isNonEmptyString(b.productName) &&
    isNonEmptyString(b.niche) &&
    isNonEmptyString(b.targetAudience) &&
    isNonEmptyString(b.transformation) &&
    isValidStrategyId(strategyId)
  );
}

/** Projection used for the (legacy) `brand_info` column / anywhere the app
 * still expects the older BrandInfo shape (e.g. prompt builders). Briefing
 * stays canonical — this is a read-only derived view, never edited back. */
export function toBrandInfo(b: LaunchBriefing): BrandInfo {
  const referenceImages = Array.isArray(b.referenceImages) ? b.referenceImages : [];
  return {
    productName: b.productName,
    niche: b.niche,
    targetAudience: b.targetAudience,
    transformation: b.transformation,
    primaryColor: b.primaryColor,
    secondaryColor: b.secondaryColor,
    fontChoice: b.fontChoice,
    stylePreset: b.stylePreset,
    logoUrl: b.logoUrl || undefined,
    mecanismo: b.mecanismo || undefined,
    preco: b.preco || undefined,
    provas: b.provas || undefined,
    referenceImages: referenceImages.length ? referenceImages : undefined,
    referenceBrands: b.referenceBrands || undefined,
  };
}

/** Inverse-ish helper for pre-filling a briefing from the older
 * Partial<BrandInfo> prefill shape still used in a couple of call sites. */
export function briefingFromBrandInfoPatch(
  patch: Partial<BrandInfo> & { description?: string; launchType?: string; referenceUrl?: string; copyDocument?: string }
): Partial<LaunchBriefing> {
  return {
    description: patch.description,
    productName: patch.productName,
    niche: patch.niche,
    targetAudience: patch.targetAudience,
    transformation: patch.transformation,
    mecanismo: patch.mecanismo,
    preco: patch.preco,
    provas: patch.provas,
    launchType: patch.launchType,
    referenceUrl: patch.referenceUrl,
    copyDocument: patch.copyDocument,
    primaryColor: patch.primaryColor,
    secondaryColor: patch.secondaryColor,
    fontChoice: patch.fontChoice,
    stylePreset: patch.stylePreset,
    referenceImages: patch.referenceImages,
    referenceBrands: patch.referenceBrands,
    logoUrl: patch.logoUrl,
  };
}
