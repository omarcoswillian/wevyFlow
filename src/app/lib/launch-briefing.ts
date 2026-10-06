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
  /** Parallel array to referenceImages — the "origin key" of each entry
   * (a Biblioteca slide's path, or "upload:<name>:<size>:<mtime>" for a
   * raw file upload), same length/order, same truncation. referenceImages
   * itself only ever holds resized data URLs with no memory of where they
   * came from, so a UI can't tell "is this specific Biblioteca thumbnail
   * currently an active reference?" just by inspecting it — a separate,
   * client-only "added" flag drifted from the truth the moment the 4-image
   * cap silently dropped an older entry (achado do dono: a Biblioteca
   * mostrava "todas adicionadas" com 7 checks enquanto o banco tinha ZERO
   * referências salvas). This field makes that check exact and always in
   * sync with what's actually persisted, never a separate bookkeeping
   * array that can desync. */
  referenceImageSources: string[];
  referenceBrands: string;
  /** Regras visuais da marca em texto livre (estilo de foto, o que evitar,
   * clima). Entra como regra obrigatória nas gerações de imagem. */
  brandRules: string;
  logoUrl: string;
  /** Fotos reais (da pessoa/produto), enviadas por upload — NUNCA geradas
   * por IA. Diferente de referenceImages (que são só influência de estilo
   * pro Nano Banana), estas são passadas ao Nano Banana no mockup de
   * aplicação da KV (generateMockupCandidate, generate-logo/shared.ts) como
   * a pessoa/produto real a preservar exatamente como fotografado — a mesma
   * foto reaproveitada depois pelos criativos/carrossel, em vez de uma
   * pessoa inventada a cada geração (pedido do dono: "afinal é bom pra
   * fazermos os criativos, mockups de aplicação"). */
  applicationPhotos: string[];
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
  brandRules: 1500,
  logoUrl: 2000,
  primaryColor: 32,
  secondaryColor: 32,
  fontChoice: 60,
  stylePreset: 60,
  // 10 cobre um brand book inteiro (a referência "A Carreira de Ouro" tem 7
  // peças: capa, paleta, tipografia, logo em 2 versões, texturas, mockup) —
  // pedido do dono: "quero todas as telas", não só as mais recentes até
  // truncar. O teto por-imagem (MAX_REFERENCE_IMAGE_BYTES, em
  // generate-logo/shared.ts) é fixo, não derivado deste número, de propósito.
  maxReferenceImages: 10,
  // Menor que maxReferenceImages de propósito: são fotos curadas pra
  // mockup (uma hero-shot já basta pra maioria dos lançamentos), não um
  // moodboard — e cada uma soma no mesmo orçamento de bytes que
  // referenceImages já usa.
  maxApplicationPhotos: 2,
  // ~4MB — mostly bounded by referenceImages (base64). Precisa caber até
  // maxReferenceImages(10) imagens reais + as fotos de aplicação sem
  // rejeitar o PATCH inteiro; na prática cada imagem já sai bem menor que
  // isso (resizeImageFromUrl/resizeImageFile limitam a 1024px + JPEG .85
  // antes de virar data URL), este é só o teto de segurança. Fica abaixo de
  // propósito do limite de ~4.5MB de corpo de requisição do runtime
  // serverless do Vercel (PATCH /api/launches/[id] roda como Node.js
  // serverless function, não Server Action — o bodySizeLimit de
  // next.config.ts não vale aqui).
  maxTotalRequestBytes: 4_000_000,
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
    referenceImageSources: [],
    referenceBrands: "",
    brandRules: "",
    logoUrl: "",
    applicationPhotos: [],
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
  "referenceBrands", "brandRules", "logoUrl", "primaryColor", "secondaryColor", "fontChoice",
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

  const validReferenceImages = Array.isArray(b.referenceImages) && b.referenceImages.every((v) => typeof v === "string")
    ? b.referenceImages
    : undefined;
  if (b.referenceImages !== undefined) {
    if (!validReferenceImages) {
      errors.push({ field: "referenceImages", message: "referenceImages deve ser uma lista de textos (data URLs)." });
    } else if (validReferenceImages.length > BRIEFING_LIMITS.maxReferenceImages) {
      errors.push({
        field: "referenceImages",
        message: `Máximo de ${BRIEFING_LIMITS.maxReferenceImages} imagens de referência.`,
      });
    }
  }

  const validReferenceImageSources = Array.isArray(b.referenceImageSources) && b.referenceImageSources.every((v) => typeof v === "string")
    ? b.referenceImageSources
    : undefined;
  if (b.referenceImageSources !== undefined) {
    if (!validReferenceImageSources) {
      errors.push({ field: "referenceImageSources", message: "referenceImageSources deve ser uma lista de textos." });
    } else if (validReferenceImageSources.length > BRIEFING_LIMITS.maxReferenceImages) {
      errors.push({
        field: "referenceImageSources",
        message: `Máximo de ${BRIEFING_LIMITS.maxReferenceImages} imagens de referência.`,
      });
    } else if (validReferenceImages && validReferenceImages.length !== validReferenceImageSources.length) {
      errors.push({
        field: "referenceImageSources",
        message: "referenceImageSources deve ter o mesmo tamanho de referenceImages.",
      });
    }
  }

  if (b.applicationPhotos !== undefined) {
    if (!Array.isArray(b.applicationPhotos) || b.applicationPhotos.some((v) => typeof v !== "string")) {
      errors.push({ field: "applicationPhotos", message: "applicationPhotos deve ser uma lista de textos (data URLs)." });
    } else if (b.applicationPhotos.length > BRIEFING_LIMITS.maxApplicationPhotos) {
      errors.push({
        field: "applicationPhotos",
        message: `Máximo de ${BRIEFING_LIMITS.maxApplicationPhotos} fotos de aplicação.`,
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
