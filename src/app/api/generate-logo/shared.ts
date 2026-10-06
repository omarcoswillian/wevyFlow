import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { generateOpenAIImage } from "../../lib/openai-image";
import { BRIEFING_LIMITS } from "@/app/lib/launch-briefing";

export interface BrandDNA {
  name: string;
  niche: string;
  tagline: string;
  personality: {
    moderno: number;
    premium: number;
    minimalista: number;
    racional: number;
  };
  voiceTones: string[];
  visualStyle: "dark-premium" | "light-clean" | "luxury" | "tech" | "vibrant" | "organic";
  primaryColor: string;
  logoType: "wordmark" | "lettermark" | "combination" | "symbol";
  variant: "dark" | "light";
  /** "Marcas que você admira" — free-text brand names from the wizard's
   * reference step. Purely stylistic steering (buildLogoPrompt below never
   * asks the model to copy anyone's actual mark). */
  referenceBrands?: string;
}

/** The 4 creative directions a KV batch generates one of each from (Rodada 3
 * will call generateLogoCandidate once per direction) — layered as prompt
 * emphasis only, never contradicting logoType (e.g. "geometrica" on a
 * wordmark still has no icon, just geometric letterform precision). */
export type LogoVariationDirection = "tipografica" | "geometrica" | "minimalista" | "expressiva";

const VALID_DIRECTIONS = new Set<LogoVariationDirection>(["tipografica", "geometrica", "minimalista", "expressiva"]);

export function isLogoVariationDirection(value: unknown): value is LogoVariationDirection {
  return typeof value === "string" && VALID_DIRECTIONS.has(value as LogoVariationDirection);
}

const VARIATION_DIRECTION_DESCRIPTORS: Record<LogoVariationDirection, string> = {
  tipografica: "Lean into refined, editorial-grade custom typography and letterform craftsmanship above everything else.",
  geometrica: "Lean into precise geometric construction — structured proportions, clean grid-like precision, mathematical balance.",
  minimalista: "Lean into extreme minimalism — strip every non-essential element, maximum restraint, premium negative space.",
  expressiva: "Lean into bold contemporary expressiveness — confident energy, distinctive personality, memorable visual impact.",
};

/** "tipografica" ("lean into typography/letterform craftsmanship") directly
 * contradicts logoType='symbol' ("NO text" — see buildLogoPrompt below), so
 * that one direction gets a symbol-safe rewording (compositional/editorial
 * balance in the abstract mark, no lettering). The other 3 directions are
 * plain style adjectives that never mention text/icons either way, so they
 * apply unmodified to every logoType — achado de revisão do Codex. */
function pickDirectionDescriptor(direction: LogoVariationDirection, logoType: BrandDNA["logoType"]): string {
  if (direction === "tipografica" && logoType === "symbol") {
    return "Lean into refined, editorial-grade compositional balance and negative-space craftsmanship within the abstract mark — no lettering, no wordmark.";
  }
  return VARIATION_DIRECTION_DESCRIPTORS[direction];
}

const PERSONALITY_DESCRIPTORS: Record<string, [string, string]> = {
  moderno:     ["timeless, classic, heritage", "contemporary, forward-thinking"],
  premium:     ["accessible, popular, democratic", "ultra-premium, exclusive, aspirational"],
  minimalista: ["bold, complex, expressive", "minimal, refined, restrained"],
  racional:    ["emotional, intuitive, human", "rational, systematic, precise"],
};

const VISUAL_STYLE_MAP: Record<BrandDNA["visualStyle"], string> = {
  "dark-premium": "Dark luxury aesthetic. Deep blacks, refined light-toned mark",
  "light-clean":  "Clean white space. Elegant minimalism. Pure white background",
  "luxury":       "Ultra-premium refinement. Think Chanel, Hermès, Rolls-Royce caliber",
  "tech":         "Digital precision. Clean geometry. Tech startup meets design excellence",
  "vibrant":      "Bold energy. Saturated color. High visual impact",
  "organic":      "Warm, natural, human. Earthy and approachable",
};

function interpolate(value: number, low: string, high: string): string {
  if (value <= 2) return low;
  if (value >= 4) return high;
  return `${low}, ${high}`;
}

/** `hasReferenceImages` softens the color/background instructions from a
 * hard requirement into a fallback — without this, a literal "Primary
 * brand color: #3b82f6" plus an explicit "#0a0a0a background" reliably won
 * beat a vague "reproduce their aesthetic" note tacked onto the end of the
 * prompt (achado do dono: anexou a referência dourada/creme de "A Carreira
 * de Ouro" e recebeu de volta um wordmark azul sobre preto — a cor e o
 * fundo explícitos, escolhidos por padrão no wizard sem relação nenhuma com
 * a referência, simplesmente venceram). Quando há referência, o hex/fundo
 * viram "só use isso se a imagem não deixar claro o que fazer" em vez de
 * uma instrução fechada — e generateWithGemini reforça isso de novo perto
 * das próprias imagens (attention/recência ajuda o modelo a não ignorar). */
export function buildLogoPrompt(dna: BrandDNA, direction?: LogoVariationDirection, hasReferenceImages?: boolean): string {
  const { name, niche, tagline, personality, voiceTones, visualStyle, primaryColor, logoType, variant, referenceBrands } = dna;

  const personalityParts = (Object.keys(personality) as Array<keyof typeof personality>).map((axis) => {
    const [low, high] = PERSONALITY_DESCRIPTORS[axis];
    return interpolate(personality[axis], low, high);
  });

  const voiceContext = voiceTones.length > 0
    ? `Brand voice: ${voiceTones.join(", ")}.`
    : "";

  const styleDirection = VISUAL_STYLE_MAP[visualStyle];

  const fallbackBg = variant === "dark" ? "#0a0a0a" : "#ffffff";
  const colorAndBackgroundNote = hasReferenceImages
    ? `Color, background and composition: derive the actual palette, background tone, surface material (paper, foil, gradient, texture, etc.) and overall compositional feel directly from the attached reference images — that is the real source of truth for how this mark should look. Only fall back to ${primaryColor} on a ${fallbackBg} background if the references are inconclusive about color. Isolated logo, centered composition, no drop shadows.`
    : `Primary brand color: ${primaryColor}. ${fallbackBg} background. Isolated logo, centered composition, no drop shadows, no gradients unless intentional.`;

  let logoTypeInstruction: string;
  switch (logoType) {
    case "wordmark":
      logoTypeInstruction = `The brand name '${name}' rendered with exceptional custom typography. No icons. Pure letterform excellence. Consider custom ligatures, thoughtful kerning, subtle modifications that give personality.`;
      break;
    case "lettermark":
      logoTypeInstruction = `Monogram of the initials of '${name}'. Sophisticated lettermark — letters may interlock, overlap, or form geometric composition. Works as favicon, stamp, or seal.`;
      break;
    case "combination":
      logoTypeInstruction = `Symbol/icon paired with brand name '${name}'. Symbol must be a simple, memorable geometric or abstract shape. Icon and wordmark feel like they belong together.`;
      break;
    case "symbol":
      logoTypeInstruction = `Standalone abstract/geometric mark — NO text. Simple (3-5 elements max), scalable, memorable. Conceptually connects to the niche '${niche}'.`;
      break;
  }

  /* `dna.tagline` is actually the wizard's free-text "Instruções extras"
   * field (KvGerarCanvas.tsx) — arbitrary client guidance like "quero algo
   * mais dourado, com textura de papel", not an actual brand tagline to
   * display. Framing it as `The brand tagline is: "X"` made image models
   * render that whole sentence as literal on-canvas copy (or, worse,
   * hallucinate an unrelated invented tagline/name instead of obeying it) —
   * achado ao investigar KV com subtítulo = prompt bruto do usuário. */
  const taglineNote = tagline.trim()
    ? ` Additional guidance from the client: "${tagline.trim()}" — use this only to steer style, material, color or mood; never render this sentence itself as visible text on the design.`
    : "";
  const directionNote = direction ? pickDirectionDescriptor(direction, logoType) : "";
  const referenceBrandsNote = referenceBrands?.trim()
    ? `Aesthetic references the client admires: ${referenceBrands.trim()}. Let their level of visual sophistication, restraint and design language inform this mark closely — this is a named list of brands, not an attached image, so lean on the mood and craft quality they're known for rather than attempting to reproduce their specific trademarked symbol from memory.`
    : "";

  const parts = [
    `Professional logo design for '${name}', a brand in the ${niche} space.${taglineNote}`,
    `Brand personality: ${personalityParts.join(", ")}.`,
    voiceContext,
    `Visual direction: ${styleDirection}.`,
    referenceBrandsNote,
    colorAndBackgroundNote,
    logoTypeInstruction,
    directionNote,
    "This should look like the output of a top-tier branding agency. Craft quality, not template quality.",
  ].filter(Boolean);

  return parts.join(" ");
}

export class LogoGenerationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LogoGenerationError";
    this.status = status;
  }
}

const VALID_PROVIDERS = new Set(["openai", "gemini", "fal"]);
const VISUAL_STYLES = new Set(Object.keys(VISUAL_STYLE_MAP));
const LOGO_TYPES = new Set<BrandDNA["logoType"]>(["wordmark", "lettermark", "combination", "symbol"]);
const VARIANTS = new Set<BrandDNA["variant"]>(["dark", "light"]);
const PERSONALITY_KEYS = ["moderno", "premium", "minimalista", "racional"] as const;

/** Normalizes/validates an untrusted `dna` payload before it ever reaches
 * buildLogoPrompt — without this, a shape like `{ name: "x" }` (the route
 * only ever validated `dna.name`) crashes buildLogoPrompt with a raw
 * TypeError (`Object.keys(undefined)`, `voiceTones.length`, `tagline.trim()`)
 * that used to only get caught by the route's own top-level catch-all.
 * That's not good enough for a function meant to be called directly by a
 * future batch worker with no such catch-all of its own — achado de revisão
 * do Codex. `name` and `logoType` are load-bearing for which prompt gets
 * built, so those are rejected outright; the rest are cosmetic adjectives,
 * so a missing/invalid value there gets a neutral default instead of a 400. */
function validateBrandDNA(dna: unknown): BrandDNA {
  if (typeof dna !== "object" || dna === null) {
    throw new LogoGenerationError("DNA da marca inválido.", 400);
  }
  const d = dna as Record<string, unknown>;

  const name = typeof d.name === "string" ? d.name.trim() : "";
  if (!name) throw new LogoGenerationError("O nome da marca é obrigatório.", 400);

  if (!LOGO_TYPES.has(d.logoType as BrandDNA["logoType"])) {
    throw new LogoGenerationError("Tipo de logo inválido.", 400);
  }
  const logoType = d.logoType as BrandDNA["logoType"];

  const personalityInput = typeof d.personality === "object" && d.personality !== null
    ? (d.personality as Record<string, unknown>)
    : {};
  const personality = {} as BrandDNA["personality"];
  for (const key of PERSONALITY_KEYS) {
    const value = personalityInput[key];
    personality[key] = typeof value === "number" && Number.isFinite(value) ? value : 3;
  }

  return {
    name,
    niche: typeof d.niche === "string" ? d.niche : "",
    tagline: typeof d.tagline === "string" ? d.tagline : "",
    personality,
    voiceTones: Array.isArray(d.voiceTones) && d.voiceTones.every((v) => typeof v === "string")
      ? (d.voiceTones as string[])
      : [],
    visualStyle: VISUAL_STYLES.has(d.visualStyle as string) ? (d.visualStyle as BrandDNA["visualStyle"]) : "light-clean",
    primaryColor: typeof d.primaryColor === "string" && d.primaryColor.trim() ? d.primaryColor : "#111111",
    logoType,
    variant: VARIANTS.has(d.variant as BrandDNA["variant"]) ? (d.variant as BrandDNA["variant"]) : "dark",
    referenceBrands: typeof d.referenceBrands === "string" && d.referenceBrands.trim() ? d.referenceBrands.trim() : undefined,
  };
}

/** Bumped when buildLogoPrompt's template logic changes in a way that would
 * alter output for existing candidates — persisted alongside a KV batch's
 * generation_config so a retry can (eventually) detect/handle a version
 * mismatch instead of silently reproducing a different prompt than its
 * batch siblings. Not enforced anywhere yet — just recorded. */
export const LOGO_PROMPT_VERSION = "v5";

const LOGO_DEFAULT_MODELS: Record<"openai" | "gemini" | "fal", string> = {
  openai: "gpt-image-2",
  gemini: "gemini-3-pro-image-preview",
  fal: "fal-ai/flux-pro/v1.1",
};

/** Resolves the model that will actually be used for a provider — exported
 * so a caller (the KV batch route) can persist the RESOLVED value instead
 * of a possibly-null "use whatever the default is" placeholder. Without
 * this, a retry running after a deploy that changed LOGO_DEFAULT_MODELS
 * would silently use a different model than its batch siblings did (achado
 * de revisão do Codex). */
export function resolveLogoImageModel(imageProvider: "openai" | "gemini" | "fal", imageModel?: string | null): string {
  return imageModel || LOGO_DEFAULT_MODELS[imageProvider];
}

export interface GenerateLogoCandidateInput {
  dna: unknown;
  direction?: unknown;
  apiKey?: string | null;
  imageProvider?: unknown;
  imageModel?: string;
  /** Base64 data URLs (see BRIEFING_LIMITS.maxReferenceImages) — only
   * honored by the Gemini path today (see referencesUsed on the result). */
  referenceImages?: unknown;
}

export interface GenerateLogoCandidateResult {
  b64: string;
  mimeType: string;
  prompt: string;
  /** True only when reference images were actually attached to the request
   * sent to the provider — false for fal (unsupported for this
   * operation) even when referenceImages was non-empty, so a caller doesn't
   * silently assume they were used. */
  referencesUsed: boolean;
}

const ALLOWED_REFERENCE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
// Per-image cap — a fixed budget for a single image in one request to the
// provider, deliberately NOT derived from maxTotalRequestBytes/maxReferenceImages
// (that division would silently shrink this every time maxReferenceImages
// goes up, punishing single-image quality for a limit about how many
// references a briefing can hold — two different budgets that happen to
// share a constants file).
const MAX_REFERENCE_IMAGE_BYTES = 500_000;
// Standard base64 alphabet + optional padding — rejects garbage like "!!!"
// that the envelope regex alone (data:mime;base64,<anything>) would accept.
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** Parses+validates one reference image data URL — envelope, MIME allow-list,
 * base64 alphabet/padding, and size. Throws (never silently drops it) — a
 * request that pays for 4 references shouldn't quietly send 2 of them to the
 * provider with `referencesUsed: true` implying all 4 were used, and a
 * syntactically-invalid base64 payload shouldn't reach the provider at all
 * (achados de revisão do Codex). */
function parseImageDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) throw new LogoGenerationError("Uma das imagens de referência está em um formato inválido.", 400);
  const [, mimeType, data] = match;
  if (!ALLOWED_REFERENCE_MIME_TYPES.has(mimeType)) {
    throw new LogoGenerationError(`Formato de imagem de referência não suportado: ${mimeType}.`, 400);
  }
  if (!BASE64_RE.test(data) || data.length % 4 !== 0) {
    throw new LogoGenerationError("Uma das imagens de referência tem conteúdo base64 inválido.", 400);
  }
  const approxBytes = Math.floor((data.length * 3) / 4);
  if (approxBytes > MAX_REFERENCE_IMAGE_BYTES) {
    throw new LogoGenerationError("Uma das imagens de referência excede o tamanho máximo permitido.", 400);
  }
  return { mimeType, data };
}

export interface ValidatedLogoInput {
  dna: BrandDNA;
  imageProvider: "openai" | "gemini" | "fal";
  direction?: LogoVariationDirection;
  /** Already format/MIME/base64/size-validated — safe to pass straight into
   * generateWithGemini without re-checking. */
  referenceImages: string[];
}

type RawGenerateLogoInput = Pick<GenerateLogoCandidateInput, "dna" | "imageProvider" | "direction" | "referenceImages">;

/** The single validation pass for a logo/KV generation request — dna shape,
 * provider, direction, and reference images. Exported so a caller (the
 * route) can run it BEFORE spending a credit, not just inside
 * generateLogoCandidate's own try block: validating only after
 * checkAndDeductCredit already ran would charge (and then have to refund) a
 * credit for a request that was never going to succeed (achado de revisão
 * do Codex). generateLogoCandidate also calls this itself, so the contract
 * ("every input error is a LogoGenerationError") holds for a caller — like
 * the future batch worker — that skips the route's own pre-check. */
export function validateGenerateLogoInput(raw: RawGenerateLogoInput): ValidatedLogoInput {
  const dna = validateBrandDNA(raw.dna);

  const imageProviderRaw = raw.imageProvider ?? "openai";
  if (typeof imageProviderRaw !== "string" || !VALID_PROVIDERS.has(imageProviderRaw)) {
    throw new LogoGenerationError(`Provedor de imagem inválido: ${String(imageProviderRaw)}.`, 400);
  }
  const imageProvider = imageProviderRaw as ValidatedLogoInput["imageProvider"];

  let direction: LogoVariationDirection | undefined;
  if (raw.direction !== undefined) {
    if (!isLogoVariationDirection(raw.direction)) {
      throw new LogoGenerationError(`Direção de variação inválida: ${String(raw.direction)}.`, 400);
    }
    direction = raw.direction;
  }

  const referenceImagesRaw = raw.referenceImages ?? [];
  if (!Array.isArray(referenceImagesRaw) || referenceImagesRaw.some((v) => typeof v !== "string")) {
    throw new LogoGenerationError("referenceImages deve ser uma lista de textos (data URLs).", 400);
  }
  if (referenceImagesRaw.length > BRIEFING_LIMITS.maxReferenceImages) {
    throw new LogoGenerationError(`No máximo ${BRIEFING_LIMITS.maxReferenceImages} imagens de referência são permitidas.`, 400);
  }
  // Validated eagerly here (throws on the first bad one) regardless of
  // provider — a malformed reference is a bad request whether or not the
  // chosen provider ends up using it.
  const referenceImages: string[] = referenceImagesRaw as string[];
  referenceImages.forEach(parseImageDataUrl);

  return { dna, imageProvider, direction, referenceImages };
}

const REFERENCE_FIDELITY_NOTE = "  CRITICAL: The attached images define this brand's actual visual DNA — extract their real color palette, background tone, material/texture (paper, foil, gradient, etc.) and overall composition style, and replicate them as closely and faithfully as possible in the new mark. Where any earlier instruction about color, background or style conflicts with what these images show, the images win — treat close visual fidelity to the reference as the goal, not just loose inspiration. The brand name and logo type given above are the only fixed constraints: render THIS brand's own name/initials (not the reference's), in the logo type already specified — everything else (palette, texture, layout, typographic feel, ornamentation, mood) should closely match the reference.";

async function generateWithGemini(
  key: string,
  prompt: string,
  imageModel: string | undefined,
  referenceImages: string[]
): Promise<GenerateLogoCandidateResult> {
  try {
    const client = new GoogleGenAI({ apiKey: key });
    const model = resolveLogoImageModel("gemini", imageModel);

    // parseImageDataUrl throws on the first invalid reference instead of
    // filtering it out — see its docstring.
    const referenceParts = referenceImages.map(parseImageDataUrl).map((part) => ({ inlineData: part }));

    // Repetido perto das próprias imagens (não só uma vez lá em cima no
    // prompt, via buildLogoPrompt's colorAndBackgroundNote) — reforço
    // deliberado: um hex/fundo específico dito só uma vez, longe das
    // imagens, historicamente vencia uma nota vaga de "reproduza a
    // estética" (achado do dono, ver comentário em buildLogoPrompt).
    const referenceNote = referenceParts.length > 0 ? REFERENCE_FIDELITY_NOTE : "";

    const result = await client.models.generateContent({
      model,
      contents: [{
        role: "user",
        parts: [{ text: `${prompt} Aspect ratio: 1:1.${referenceNote}` }, ...referenceParts],
      }],
      config: { responseModalities: ["IMAGE"] },
    });

    let b64 = "";
    let mimeType = "image/png";
    const candidates = result.candidates ?? [];
    for (const candidate of candidates) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.inlineData?.data) {
          b64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType ?? "image/png";
          break;
        }
      }
      if (b64) break;
    }

    if (!b64) throw new LogoGenerationError("Logo não retornado pelo Gemini.", 500);
    return { b64, mimeType, prompt, referencesUsed: referenceParts.length > 0 };
  } catch (e: unknown) {
    if (e instanceof LogoGenerationError) throw e;
    const msg = String((e as Error)?.message ?? "");
    if (msg.includes("401") || msg.includes("API_KEY") || msg.includes("invalid")) {
      throw new LogoGenerationError("API Key Google inválida ou expirada.", 401);
    }
    if (msg.includes("429") || msg.includes("quota") || msg.includes("rate")) {
      throw new LogoGenerationError("Limite de requisições Google atingido. Aguarde.", 429);
    }
    if (msg.includes("safety") || msg.includes("block")) {
      throw new LogoGenerationError("Prompt bloqueado pela política do Google. Tente reformular.", 400);
    }
    console.error("[generate-logo gemini]", e);
    throw new LogoGenerationError("Erro ao gerar logo com Gemini.", 500);
  }
}

async function generateWithFal(
  key: string,
  prompt: string,
  imageModel: string | undefined
): Promise<GenerateLogoCandidateResult> {
  const model = resolveLogoImageModel("fal", imageModel);

  const falRes = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: {
      "Authorization": `Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: { width: 1024, height: 1024 },
      num_images: 1,
      sync_mode: true,
    }),
  });

  if (!falRes.ok) {
    const errText = await falRes.text().catch(() => "");
    if (falRes.status === 401 || falRes.status === 403) {
      throw new LogoGenerationError("API Key Fal.ai inválida ou expirada.", 401);
    }
    if (falRes.status === 429) {
      throw new LogoGenerationError("Limite de requisições Fal.ai atingido. Aguarde alguns segundos.", 429);
    }
    console.error("[generate-logo fal]", falRes.status, errText);
    throw new LogoGenerationError("Erro ao gerar logo com Fal.ai.", 500);
  }

  const falData = await falRes.json();
  const imageUrl = falData?.images?.[0]?.url;
  if (!imageUrl) throw new LogoGenerationError("Imagem não retornada pelo Fal.ai.", 500);

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new LogoGenerationError("Falha ao baixar imagem do Fal.ai.", 500);
  const imgBuffer = await imgRes.arrayBuffer();
  const b64 = Buffer.from(imgBuffer).toString("base64");
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";

  return { b64, mimeType: contentType, prompt, referencesUsed: false };
}

async function generateWithOpenAI(
  key: string,
  prompt: string,
  imageModel: string | undefined,
  referenceImages: string[]
): Promise<GenerateLogoCandidateResult> {
  // With brand references the request becomes an image edit (multi-image
  // input) so the mark can follow the reference's real palette/texture, same
  // as the Gemini path — plain generation can't see them.
  if (referenceImages.length > 0) {
    const { b64, mimeType } = await generateOpenAIImage({
      apiKey: key,
      prompt: `${prompt}${REFERENCE_FIDELITY_NOTE}`,
      references: referenceImages,
      aspect: 1,
      model: resolveLogoImageModel("openai", imageModel),
    });
    return { b64, mimeType, prompt, referencesUsed: true };
  }

  const openai = new OpenAI({ apiKey: key });
  const response = await openai.images.generate({
    model: resolveLogoImageModel("openai", imageModel),
    prompt,
    size: "1024x1024",
    quality: "high" as const,
    n: 1,
  });

  type ImageItem = { b64_json?: string | null; url?: string | null };
  const item = (response.data as ImageItem[] | undefined)?.[0];
  let b64 = item?.b64_json ?? undefined;

  // Fallback: some model versions return a URL instead of base64
  if (!b64 && item?.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new LogoGenerationError("Falha ao baixar imagem gerada.", 500);
    const buf = await imgRes.arrayBuffer();
    b64 = Buffer.from(buf).toString("base64");
  }

  if (!b64) throw new LogoGenerationError("Imagem não retornada pela API.", 500);
  return { b64, mimeType: "image/png", prompt, referencesUsed: false };
}

/** Generates exactly one logo/KV image via the requested provider — the unit
 * of work a batch (Rodada 3) will call once per candidate. Every failure
 * mode (missing key, provider error, unexpected exception) surfaces as a
 * LogoGenerationError with a user-facing message + HTTP status, never a
 * bare thrown Error, so callers can map it 1:1 to a response or to a
 * launch_assets error_message without re-deriving the mapping. */
/** Resolves which key actually gets used for a provider — BYOK if long
 * enough to be real, else WevyFlow's own server key (Gemini only; OpenAI/Fal
 * always require BYOK). Exported so a caller (the KV batch route) can check
 * "is there a usable key at all" ONCE before reserving credits for 4
 * candidates that would otherwise all fail on the same missing-key error. */
export function resolveLogoApiKey(imageProvider: "openai" | "gemini" | "fal", apiKey?: string | null): string | null {
  const byok = apiKey && apiKey.length > 10 ? apiKey : null;
  return byok ?? (imageProvider === "gemini" ? (process.env.GOOGLE_AI_API_KEY ?? null) : imageProvider === "openai" ? (process.env.OPENAI_API_KEY ?? null) : null);
}

/** Dispatcha pra o provedor certo + normaliza qualquer erro pra um
 * LogoGenerationError com mensagem/status já amigáveis — extraído de
 * generateLogoCandidate pra ser reaproveitado por qualquer outra peça
 * gerada por IA (Rodada D: textura) sem duplicar o mapeamento de erros
 * nem a lógica de resolução de chave por provedor. O nome ainda menciona
 * "logo" só por histórico do arquivo — não há nada logo-específico aqui. */
async function dispatchImageGeneration(
  imageProvider: "openai" | "gemini" | "fal",
  prompt: string,
  imageModel: string | undefined,
  apiKey: string | null | undefined,
  referenceImages: string[]
): Promise<GenerateLogoCandidateResult> {
  try {
    const key = resolveLogoApiKey(imageProvider, apiKey);

    if (imageProvider === "gemini") {
      if (!key) throw new LogoGenerationError("Chave Google AI Studio não configurada. Adicione em Configurações > IA de Imagem.", 400);
      return await generateWithGemini(key, prompt, imageModel, referenceImages);
    }

    if (imageProvider === "fal") {
      if (!key) throw new LogoGenerationError("Chave Fal.ai não configurada. Adicione em Configurações > IA de Imagem.", 400);
      return await generateWithFal(key, prompt, imageModel);
    }

    // OpenAI path — BYOK when the user saved one, otherwise WevyFlow's own
    // OPENAI_API_KEY (see resolveLogoApiKey).
    if (!key) throw new LogoGenerationError("Chave OpenAI não configurada. Adicione em Configurações > IA de Imagem.", 400);
    return await generateWithOpenAI(key, prompt, imageModel, referenceImages);
  } catch (e: unknown) {
    if (e instanceof LogoGenerationError) throw e;
    const msg = String((e as Error)?.message ?? "");
    if (msg.includes("401") || msg.includes("Incorrect API key")) {
      throw new LogoGenerationError("API Key inválida ou expirada.", 401);
    }
    if (msg.includes("402") || msg.includes("billing") || msg.includes("credit") || msg.includes("insufficient")) {
      throw new LogoGenerationError("Saldo insuficiente. Adicione créditos.", 402);
    }
    if (msg.includes("429") || msg.includes("rate limit")) {
      throw new LogoGenerationError("Limite de requisições atingido. Aguarde alguns segundos.", 429);
    }
    if (msg.includes("content_policy") || msg.includes("safety")) {
      throw new LogoGenerationError("Prompt bloqueado pela política de conteúdo. Tente reformular.", 400);
    }
    console.error("[generate-logo]", msg || e);
    throw new LogoGenerationError(`Erro ao gerar imagem: ${msg || "erro desconhecido"}`, 500);
  }
}

export async function generateLogoCandidate(input: GenerateLogoCandidateInput): Promise<GenerateLogoCandidateResult> {
  const { dna, imageProvider, direction, referenceImages } = validateGenerateLogoInput(input);
  // Só Gemini e OpenAI realmente anexam as imagens de referência (ver
  // GenerateLogoCandidateResult.referencesUsed) — só eles devem amolecer a
  // instrução de cor/fundo; Fal nunca recebe as imagens, então continua com
  // a cor exata que pediu.
  const prompt = buildLogoPrompt(dna, direction, (imageProvider === "gemini" || imageProvider === "openai") && referenceImages.length > 0);
  return dispatchImageGeneration(imageProvider, prompt, input.imageModel, input.apiKey, referenceImages);
}

/** Prompt da peça de textura (Rodada D) — uma imagem de fundo/material pura,
 * condicionada pela paleta e pela especificação de identidade já resolvida
 * (kv-identity.ts), sem logo, sem texto, sem marca — a peça em si é só o
 * material (papel, folha dourada, tecido, gradiente, etc.), pra ser usada
 * como fundo em outras peças do kit. */
export function buildTexturePrompt(colors: { hex: string; usage: string }[], direction?: LogoVariationDirection): string {
  const primary = colors.find((c) => c.usage === "primary")?.hex;
  const secondary = colors.find((c) => c.usage === "secondary")?.hex;
  // "accent" fica de fora de propósito: pode ser só um registro de auditoria
  // de uma cor que a referência visual já substituiu (ver "Cor prevista no
  // briefing" em resolveBrandPalette, kv-identity.ts) — tratá-la como peso
  // igual à primária botava uma cor descartada dominando a textura (achado
  // verificado nesta sessão: logo dourado/creme, mas a textura saía com
  // faixas azuis fortes por causa do accent = cor antiga do briefing).
  const paletteNote = [primary, secondary].filter(Boolean).join(", ");
  const directionNote = direction ? pickDirectionDescriptor(direction, "symbol") : "";

  return [
    "A seamless, abstract brand background texture — pure material/surface, no logo, no text, no people, no icons.",
    paletteNote ? `Color palette to use: ${paletteNote}.` : "",
    "Think premium physical materials: brushed metal, foil, grain paper, fabric weave, subtle gradient, marbling, or a refined geometric pattern — pick whichever best fits the palette and mood below.",
    "Restrained and flat, almost a solid swatch: a single material reads across the whole frame with only subtle tonal variation. Absolutely no feathers, quills, plumes, ribbons, swirls, smoke, or ornamental ink-swoosh flourishes — those read as generic AI clipart, not premium branding material.",
    directionNote,
    "Square composition, edge-to-edge, no vignette, no border, suitable for use as a background behind other brand elements.",
    "This should look like the output of a top-tier branding agency. Craft quality, not template quality.",
  ].filter(Boolean).join(" ");
}

export interface GenerateTextureCandidateInput {
  colors: { hex: string; usage: string }[];
  direction?: LogoVariationDirection;
  imageProvider: "openai" | "gemini" | "fal";
  imageModel?: string;
  apiKey?: string | null;
}

export async function generateTextureCandidate(input: GenerateTextureCandidateInput): Promise<GenerateLogoCandidateResult> {
  const prompt = buildTexturePrompt(input.colors, input.direction);
  return dispatchImageGeneration(input.imageProvider, prompt, input.imageModel, input.apiKey, []);
}

export interface GenerateMockupCandidateInput {
  /** Foto real da pessoa/produto (briefing.applicationPhotos[0]) — o
   * SUJEITO literal do mockup, nunca reinterpretado. */
  photoDataUrl: string;
  /** Imagens de referência visual (briefing.referenceImages) — o MODELO/
   * template a copiar (moldura de celular, cartão de legenda, tipografia),
   * nunca o conteúdo literal delas. Só a primeira é anexada à geração —
   * ver comentário na função sobre por que enviar mais de uma confunde o
   * modelo sobre qual delas manda no layout. */
  styleReferenceImages: string[];
  /** Paleta já resolvida deste kit (identity_spec, kv-identity.ts) — usada
   * pra mandar o modelo usar AS CORES DESTA MARCA, nunca as da referência
   * (achado de revisão do Codex: o prompt antigo mandava copiar a cor da
   * referência, que é de outra marca/exemplo). */
  colors: { hex: string; usage: string }[];
  /** Tipografia já resolvida deste kit — mesma lógica: nome real da fonte
   * desta marca, não "algo parecido com a referência". */
  fonts: { name: string; usage: string }[];
  /** Medidas estruturais já extraídas da referência (analyzeMockupLayoutForReference),
   * congeladas UMA VEZ no lote e reaproveitadas pelos 4 candidatos — ver o
   * comentário no wrapper exportado. `undefined` deixa esta função analisar
   * sozinha (fallback pra chamadores que não pré-computam); `null` explícito
   * significa "já tentou e não tem medida boa", pula a análise de novo. */
  layoutSpec?: MockupLayoutSpec | null;
  productName: string;
  subtitle?: string;
  imageProvider: "openai" | "gemini" | "fal";
  imageModel?: string;
  apiKey?: string | null;
}

export interface MockupLayoutBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Medidas estruturais extraídas da referência ANTES de gerar — mesma ideia
 * de `analyzeSceneForSwap`/`buildFrameOccupancyDirective` que já funciona
 * nos Criativos (`generate-design/shared.ts`): usar um modelo de
 * texto/visão barato pra medir a referência em números concretos primeiro,
 * em vez de confiar numa única geração livre pra "perceber" as proporções
 * certas sozinha. Nunca inclui cor, texto literal ou identidade — só fatos
 * de layout reaproveitáveis por qualquer marca (achado de revisão do Codex,
 * 2ª rodada: pedido do dono foi "quero que seja tão bom quanto o de
 * criativos", e essa etapa de medição é a peça que faltava). */
export interface MockupLayoutSpec {
  aspectRatio: "1:1" | "3:4" | "4:5" | "9:16" | "2:3";
  photo: MockupLayoutBox & { fullBleedEdges: Array<"top" | "left" | "right" | "bottom"> };
  card: MockupLayoutBox & { present: boolean; cornerRadius: number };
  header: "app_chrome" | "editorial_title" | "none";
  highlightPresent: boolean;
  ctaPresent: boolean;
  ctaLabelCase: "uppercase" | "title_case" | "sentence_case";
}

const MOCKUP_LAYOUT_JSON_SCHEMA = {
  type: "object",
  properties: {
    aspectRatio: { type: "string", enum: ["1:1", "3:4", "4:5", "9:16", "2:3"] },
    photo: {
      type: "object",
      properties: {
        left: { type: "number" }, top: { type: "number" }, right: { type: "number" }, bottom: { type: "number" },
        fullBleedEdges: { type: "array", items: { type: "string", enum: ["top", "left", "right", "bottom"] } },
      },
      required: ["left", "top", "right", "bottom", "fullBleedEdges"],
    },
    card: {
      type: "object",
      properties: {
        present: { type: "boolean" },
        left: { type: "number" }, top: { type: "number" }, right: { type: "number" }, bottom: { type: "number" },
        cornerRadius: { type: "number" },
      },
      required: ["present", "left", "top", "right", "bottom", "cornerRadius"],
    },
    header: { type: "string", enum: ["app_chrome", "editorial_title", "none"] },
    highlightPresent: { type: "boolean" },
    ctaPresent: { type: "boolean" },
    ctaLabelCase: { type: "string", enum: ["uppercase", "title_case", "sentence_case"] },
  },
  required: ["aspectRatio", "photo", "card", "header", "highlightPresent", "ctaPresent", "ctaLabelCase"],
};

const MOCKUP_LAYOUT_ANALYSIS_PROMPT = `You are a technical layout-measurement system, not a designer or writer.
Analyze the attached image and extract ONLY its reusable structural layout, so a completely different brand can reproduce the same layout with its own content.

CONTENT FIREWALL — never do this:
- Do not transcribe or quote any visible text.
- Do not name, describe or identify the person, product or brand.
- Do not report any color (hex or name) — this schema has no color field; ignore color entirely.

TEMPLATE SELECTION: if the image is a single finished design, analyze it as-is. If it is a collage or presentation board with multiple mockups, pick exactly ONE representative individual social-post design (the largest, most central one showing a photo plus a caption card) and measure only that one — ignore the rest of the collage.

MEASURE, as integers from 0 to 1000 (percent of the SELECTED design's own width/height, origin at top-left):
- photo: the tight bounding box of the main photographic image area, and which of its edges touch the selected design's own edge exactly (full-bleed).
- card: whether a caption/text card overlaps the photo; its bounding box; and its corner radius (0 = square corners, larger = rounder, as a percent of the card's own shorter side).
- header: "app_chrome" if there is a small top bar with a back arrow, a handle/username placeholder, a menu control, or a confirmation control; "editorial_title" if there is instead a plain spaced brand-name title line with no app-style controls; "none" if neither is present.
- highlightPresent: true only if some text has a solid rectangular marker-style highlight directly behind it.
- ctaPresent: true only if there is a distinct button-shaped call-to-action element.
- ctaLabelCase: if ctaPresent, the button label's letter case; otherwise "uppercase".
- aspectRatio: the closest of "1:1", "3:4", "4:5", "9:16", "2:3" to the SELECTED design's own aspect ratio.

Return ONLY JSON matching the schema. Give your best estimate for every field rather than omitting one.`;

/** Só analisa — nunca lança. Uma falha aqui (JSON malformado, campo fora
 * do range, etc.) faz o chamador cair de volta pro texto qualitativo
 * antigo ("matching the reference's own proportion"), nunca derruba a
 * geração do mockup por causa de uma etapa que é só um reforço de
 * precisão. */
async function analyzeMockupLayout(client: GoogleGenAI, referenceDataUrl: string): Promise<MockupLayoutSpec | null> {
  try {
    const { mimeType, data } = parseImageDataUrl(referenceDataUrl);
    const result = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [{ text: MOCKUP_LAYOUT_ANALYSIS_PROMPT }, { inlineData: { mimeType, data } }],
      }],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: MOCKUP_LAYOUT_JSON_SCHEMA,
      },
    });
    const raw = (result.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockupLayoutSpec;

    // Nunca confiar cegamente em números de LLM — validação determinística
    // mínima antes de deixar isso virar diretiva "obrigatória" no prompt.
    const inRange = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1000;
    const validBox = (b: MockupLayoutBox | undefined) =>
      !!b && inRange(b.left) && inRange(b.top) && inRange(b.right) && inRange(b.bottom) && b.right > b.left && b.bottom > b.top;
    if (!validBox(parsed.photo) || !validBox(parsed.card) || !inRange(parsed.card?.cornerRadius)) {
      console.warn("[generate-mockup] analyzeMockupLayout returned an invalid box, falling back to qualitative prompt:", raw);
      return null;
    }
    return parsed;
  } catch (e) {
    console.error("[generate-mockup] analyzeMockupLayout failed (non-fatal, falling back to qualitative prompt):", e);
    return null;
  }
}

/** Wrapper exportado — chamado UMA VEZ no batch inteiro (POST
 * /api/kv/batches, achado de revisão do Codex: os 4 candidatos de um lote
 * compartilham a MESMA referência de estilo, então analisá-la 4 vezes
 * separadas — uma por candidato, dentro de generateMockupCandidate — podia
 * fazer cada uma "escolher" um design diferente dentro de uma referência
 * ambígua tipo colagem, deixando os 4 mockups do mesmo kit inconsistentes
 * entre si). O resultado é congelado no generation_config do lote e
 * reaproveitado pelos 4 candidatos, exatamente como já acontece com
 * dna/imageProvider/referenceImages. */
export async function analyzeMockupLayoutForReference(referenceDataUrl: string, apiKey?: string | null): Promise<MockupLayoutSpec | null> {
  const key = resolveLogoApiKey("gemini", apiKey);
  if (!key) return null;
  const client = new GoogleGenAI({ apiKey: key });
  return analyzeMockupLayout(client, referenceDataUrl);
}

/** Mockup de aplicação (pedido do dono: "quero que o nano banana mude a
 * pessoa e mude o título com a mesma fonte... quero que replique a
 * referência"). Diferente de todo outro caminho deste arquivo,
 * generateWithGemini não serve aqui — sua referenceNote diz explicitamente
 * "never copy their literal content (text, people, logos)", o oposto do
 * que este mockup precisa (a foto TEM que ser copiada literalmente; só o
 * template ao redor dela é que deve seguir a referência). Por isso este é
 * o único gerador do arquivo com seu próprio texto de instrução e sua
 * própria chamada ao Gemini em vez de passar por dispatchImageGeneration.
 * Gemini e OpenAI aceitam múltiplas imagens de entrada com papéis diferentes
 * (estilo vs. sujeito real); Fal não. A análise de layout (analyzeMockupLayout)
 * é sempre visão do Gemini, com a chave do servidor quando o provedor é OpenAI. */
export async function generateMockupCandidate(input: GenerateMockupCandidateInput): Promise<GenerateLogoCandidateResult> {
  if (input.imageProvider === "fal") {
    throw new LogoGenerationError("O mockup de aplicação com foto real só está disponível com os provedores OpenAI e Gemini.", 400);
  }
  const key = resolveLogoApiKey(input.imageProvider, input.apiKey);
  if (!key) {
    throw new LogoGenerationError(
      input.imageProvider === "openai"
        ? "Chave OpenAI não configurada. Adicione em Configurações > IA de Imagem."
        : "Chave Google AI Studio não configurada. Adicione em Configurações > IA de Imagem.",
      400
    );
  }

  try {
    const geminiKey = input.imageProvider === "gemini" ? key : resolveLogoApiKey("gemini", null);
    const model = resolveLogoImageModel(input.imageProvider, input.imageModel);

    // Só a PRIMEIRA referência é anexada à geração final — mandar várias
    // fazia o modelo tratá-las com peso igual e diluir qual delas define o
    // layout (achado de revisão do Codex, 2ª rodada). Com uma foto real de
    // aplicação e possivelmente vários exemplos de estilo na Biblioteca,
    // a primeira é a que o usuário escolheu ver com mais destaque no wizard.
    const primaryStylePart = input.styleReferenceImages[0]
      ? { inlineData: parseImageDataUrl(input.styleReferenceImages[0]) }
      : null;
    const photoPart = { inlineData: parseImageDataUrl(input.photoDataUrl) };

    // Etapa de medição ANTES de gerar (pedido do dono: "quero que seja tão
    // bom quanto o de criativos") — mesma técnica de analyzeSceneForSwap
    // nos Criativos: um modelo de texto/visão barato mede a referência em
    // números concretos primeiro, em vez de a geração final ter que
    // "adivinhar" as proporções sozinha numa única tentativa livre. `null`
    // (referência ausente ou análise falhou) cai de volta pro texto
    // qualitativo de sempre — nunca bloqueia a geração.
    const layoutSpec = input.layoutSpec !== undefined
      ? input.layoutSpec
      : (primaryStylePart && geminiKey ? await analyzeMockupLayout(new GoogleGenAI({ apiKey: geminiKey }), input.styleReferenceImages[0]) : null);
    const pct = (v: number) => `${Math.round(v / 10)}%`;
    const describeBox = (b: MockupLayoutBox) =>
      `left=${pct(b.left)} top=${pct(b.top)} right=${pct(b.right)} bottom=${pct(b.bottom)} (width=${pct(b.right - b.left)}, height=${pct(b.bottom - b.top)})`;
    const layoutDirective = layoutSpec ? [
      `MEASURED LAYOUT CONTRACT (percentages of the final canvas, extracted from STYLE REFERENCE — follow these numbers as closely as possible; they are more precise than any qualitative instruction below and take priority over it):`,
      `PHOTO area: ${describeBox(layoutSpec.photo)}. Full-bleed edges: ${layoutSpec.photo.fullBleedEdges.join(", ") || "none"}.`,
      layoutSpec.card.present
        ? `CAPTION CARD area: ${describeBox(layoutSpec.card)}, corner radius ≈ ${pct(layoutSpec.card.cornerRadius)} of the card's shorter side.`
        : `The reference has NO caption card — do not add one; place the marketing copy directly over the photo instead.`,
      `Header style: ${layoutSpec.header === "app_chrome" ? "small app-style top bar (back chevron, a placeholder handle, a menu control, a confirmation control)" : layoutSpec.header === "editorial_title" ? `plain spaced brand-title line reading "${input.productName}", no app controls` : "no header element — omit both variants"}.`,
      `Highlighted key phrase: ${layoutSpec.highlightPresent ? "include exactly one, marker-style rectangle behind the words." : "do not add one."}`,
      `CTA button: ${layoutSpec.ctaPresent ? `include one, label case: ${layoutSpec.ctaLabelCase.replace("_", " ")}.` : "do not add one."}`,
    ].join(" ") : "";

    // Paleta e tipografia REAIS deste kit (identity_spec) — nunca as da
    // referência, que é de outra marca/exemplo. "accent" some da nota de
    // cor pelo mesmo motivo documentado em buildTexturePrompt: pode ser só
    // um registro de auditoria de uma cor já descartada pelo briefing.
    const primaryColor = input.colors.find((c) => c.usage === "primary")?.hex;
    const accentColor = input.colors.find((c) => c.usage === "accent")?.hex ?? input.colors.find((c) => c.usage === "secondary")?.hex;
    const displayFont = input.fonts.find((f) => f.usage === "display")?.name;
    const bodyFont = input.fonts.find((f) => f.usage === "body")?.name;
    const brandTokensNote = [
      primaryColor ? `primary color ${primaryColor}` : "",
      accentColor ? `accent color ${accentColor} (use this for the highlight and/or CTA button, never the reference's own color)` : "",
      displayFont ? `display font in the style of ${displayFont}` : "",
      bodyFont ? `body font in the style of ${bodyFont}` : "",
    ].filter(Boolean).join(", ");

    // Reescrito depois de comparar visualmente a saída com a referência real
    // (feedback do dono: "Não esta igual a referencia, quero que seja igual
    // a referencia") — achado com ajuda do Codex (gpt-5.6-sol) analisando o
    // gap em duas rodadas: (1) o prompt antigo nunca proibia um recorte
    // circular/avatar pra foto e tratava productName como título gigante;
    // (2) o prompt ainda mandava copiar a COR da referência (contradição
    // com usar a paleta desta marca) e forçava highlight/CTA/70-75% fixos
    // mesmo quando a referência não tinha esses elementos nesse formato.
    const referenceInstruction = primaryStylePart
      ? [
          `STYLE REFERENCE is the layout to copy: reproduce its single-post composition, proportions, photo/card relationship, spacing, card geometry, UI chrome (if any) and typographic hierarchy as closely as possible.`,
          `Do NOT copy the STYLE REFERENCE's own colors, brand name, person, product, logo, handle or marketing text — only its structural template. All colors and fonts in the output must come from TARGET BRAND below.`,
          `If STYLE REFERENCE is a collage or presentation board with multiple mockups, do NOT reproduce the collage — extract and reproduce only ONE individual Instagram-post layout from it: a large rectangular photo with a caption card overlapping its lower portion.`,
          `Reproduce an element (app-style top bar, highlight behind a key phrase, CTA button) ONLY if STYLE REFERENCE actually shows that kind of element. Do not invent a highlight or CTA button that has no equivalent in the reference — an absent element should stay absent.`,
        ].join(" ")
      : `No style reference was provided. Use the required layout described below exactly; do not invent an avatar, profile-photo layout, device mockup or collage.`;

    const subtitleNote = input.subtitle ? ` Use "${input.subtitle}" only as supporting context for the message.` : "";
    const text = [
      `TASK: Create exactly ONE finished premium Instagram post creative by compositing the SOURCE PHOTO into the STYLE REFERENCE's layout, using the TARGET BRAND's own colors and fonts.`,
      `INPUT ROLES: ${referenceInstruction}`,
      `SOURCE PHOTO is locked, literal content — treat it as an immutable photographic source plate, not as inspiration.`,
      brandTokensNote ? `TARGET BRAND (use these, never the reference's own colors/fonts): ${brandTokensNote}. These are styling directives only — never print a color hex code or a font name as visible text anywhere in the image.` : "",
      layoutDirective || "",
      layoutSpec
        ? `NON-NEGOTIABLE PHOTO LAYOUT: place the SOURCE PHOTO exactly at the PHOTO area from the LAYOUT CONTRACT above, full-bleed on the edges listed there. The photo must NEVER appear inside a circle, oval, avatar, profile-picture frame, medallion, badge, small inset, floating portrait or decorative cutout, and must never be shrunk into a small shape surrounded by a large solid or gradient background.`
        : `NON-NEGOTIABLE PHOTO LAYOUT: use the SOURCE PHOTO as a large rectangular, full-bleed photographic layer extending edge-to-edge across the full canvas width, matching the STYLE REFERENCE's own proportion between photo and caption card (or roughly the upper two-thirds of the frame if no reference was given). The photo must NEVER appear inside a circle, oval, avatar, profile-picture frame, medallion, badge, small inset, floating portrait or decorative cutout, and must never be shrunk into a small shape surrounded by a large solid or gradient background.`,
      `NON-NEGOTIABLE SUBJECT PRESERVATION: preserve the SOURCE PHOTO literally — same person or product, same identity, facial features, skin, hair, body, clothing, accessories, pose, expression, angle, crop, framing, lighting and colors. Do not redraw, regenerate, beautify, restyle, reinterpret or replace the subject, and do not add a different person. Only uniform scaling and the minimum edge crop needed for the full-bleed placement are allowed. This still applies even if the source photo is abstract, synthetic, low-detail or a placeholder — reproduce that exact supplied image rather than inventing a realistic person.`,
      layoutSpec
        ? `CAPTION CARD: place it exactly at the CAPTION CARD area from the LAYOUT CONTRACT above (when present), with restrained regular-weight body typography at a moderate size — not an oversized editorial headline. Follow the LAYOUT CONTRACT's header style exactly — do not choose between app-chrome and editorial-title yourself.`
        : `CAPTION CARD: reproduce the reference's card placement, overlap, dimensions, padding, corner radius and shadow, with restrained regular-weight body typography at a moderate size — not an oversized editorial headline. When the reference shows an app-style top bar (back chevron, a placeholder handle, "...", "OK"), reproduce it faithfully at the same relative position; when the reference instead uses a spaced brand-title line with no app chrome, use that variant with "${input.productName}" as the brand line instead.`,
      `MARKETING COPY: write one short, natural marketing caption about "${input.productName}" as normal body copy inside the card — never render the product name alone as a giant title.${subtitleNote}${layoutSpec ? " Follow the LAYOUT CONTRACT's highlighted-key-phrase rule above exactly." : " Only if the STYLE REFERENCE shows a highlighted key phrase, emphasize one short key phrase in your caption with a flat rectangular marker-style highlight BEHIND the words."} When a highlight is used, it goes in the TARGET BRAND accent color (the letters stay dark — this is a background highlight, not colored text).`,
      layoutSpec
        ? `CTA: follow the LAYOUT CONTRACT's CTA rule above exactly — when present, match its size, position and corner treatment, filled with the TARGET BRAND accent or primary color.`
        : `CTA: only if the STYLE REFERENCE shows a CTA button, add one matching its size, position and corner treatment, filled with the TARGET BRAND accent or primary color, with a short label in the same case (uppercase/title case) as the reference's button.`,
      `OUTPUT: one flat final Instagram creative${layoutSpec ? ` at aspect ratio ${layoutSpec.aspectRatio}` : ", matching the STYLE REFERENCE's own aspect ratio (portrait or square)"}. Do not output a collage, moodboard, contact sheet, multiple alternatives, device frame, circular portrait, extra logo, or watermark. Visual fidelity to the reference layout and literal preservation of the source photo take priority over creative interpretation.`,
    ].filter(Boolean).join(" ");

    if (input.imageProvider === "openai") {
      const [aw, ah] = (layoutSpec?.aspectRatio ?? "4:5").split(":").map(Number);
      const styleRef = input.styleReferenceImages[0];
      const imageRoles = [
        styleRef ? "IMAGE 1 — STYLE REFERENCE: layout/structure only, never its own colors/content." : "",
        `IMAGE ${styleRef ? 2 : 1} — SOURCE PHOTO: literal content that must appear in the output.`,
      ].filter(Boolean).join("\n");
      const { b64, mimeType } = await generateOpenAIImage({
        apiKey: key,
        prompt: `${text}\n\n${imageRoles}`,
        references: [...(styleRef ? [styleRef] : []), input.photoDataUrl],
        aspect: aw / ah,
        model,
      });
      return { b64, mimeType, prompt: text, referencesUsed: primaryStylePart !== null };
    }

    const client = new GoogleGenAI({ apiKey: key });

    // Partes rotuladas explicitamente em vez de só texto + imagens soltas —
    // achado de revisão do Codex: sem rótulo intercalado, o modelo tinha só
    // a ordem de anexo pra inferir "qual imagem é qual", o que piora quando
    // há mais de uma imagem anexada.
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text }];
    if (primaryStylePart) {
      parts.push({ text: "STYLE REFERENCE — layout/structure only, never its own colors/content:" }, primaryStylePart);
    }
    parts.push({ text: "SOURCE PHOTO — literal content that must appear in the output:" }, photoPart);

    const result = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: layoutSpec?.aspectRatio ?? "4:5", imageSize: "2K" },
      },
    });

    let b64 = "";
    let mimeType = "image/png";
    const candidates = result.candidates ?? [];
    for (const candidate of candidates) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.inlineData?.data) {
          b64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || mimeType;
          break;
        }
      }
      if (b64) break;
    }
    if (!b64) throw new LogoGenerationError("Imagem não retornada pelo Gemini.", 502);

    return { b64, mimeType, prompt: text, referencesUsed: primaryStylePart !== null };
  } catch (e: unknown) {
    if (e instanceof LogoGenerationError) throw e;
    const msg = String((e as Error)?.message ?? "");
    if (msg.includes("401") || msg.includes("API key")) throw new LogoGenerationError("API Key inválida ou expirada.", 401);
    if (msg.includes("429") || msg.includes("rate limit")) throw new LogoGenerationError("Limite de requisições atingido. Aguarde alguns segundos.", 429);
    if (msg.includes("content_policy") || msg.includes("safety")) throw new LogoGenerationError("Prompt bloqueado pela política de conteúdo. Tente reformular.", 400);
    console.error("[generate-mockup]", msg || e);
    throw new LogoGenerationError(`Erro ao gerar mockup: ${msg || "erro desconhecido"}`, 500);
  }
}
