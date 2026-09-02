export type StrategyId = "classico" | "meteorico" | "semente" | "pago-vsl" | "perpetuo";
export type AssetType = "page" | "criativo";
export type AssetStatus = "pending" | "generating" | "done" | "error";
export type WizardStep = 1 | 2 | 3;

export type PageKind =
  | "lp-vendas"
  | "lp-captura"
  | "obrigado"
  | "checkout"
  | "vsl"
  | "webinar";

export type CreativoFormat =
  | "thumb-yt"
  | "capa-yt"
  | "stories"
  | "feed-quadrado"
  | "feed-retrato"
  | "banner-google"
  | "email"
  | "banner-checkout"
  | "pdf-ebook"
  | "capa-formulario";

export interface StrategyAsset {
  id: string;
  label: string;
  description: string;
  type: AssetType;
  pageKind?: PageKind;
  format?: CreativoFormat;
}

export interface LaunchStrategy {
  id: StrategyId;
  label: string;
  tagline: string;
  description: string;
  assets: StrategyAsset[];
  bestFor: string;
}

export interface BrandInfo {
  productName: string;
  niche: string;
  targetAudience: string;
  transformation: string;
  primaryColor: string;
  secondaryColor: string;
  fontChoice: string;
  stylePreset: string;
  logoUrl?: string;
  // Copy framework fields (PROMPT #02)
  mecanismo?: string;   // unique mechanism — why this works when everything else failed
  preco?: string;       // price + anchor (e.g. "R$997 — de R$2.997")
  provas?: string;      // social proof — results, numbers, testimonial snippets
  // Visual reference fields
  referenceImages?: string[];  // base64 data URLs, max 4 imagens
  referenceBrands?: string;    // ex: "Nike, Apple, Headspace"
}

export interface KitAssetInstance {
  assetId: string;
  status: AssetStatus;
  generatedCode?: string;
  generatedUrl?: string;
  projectPageId?: string;
  error?: string;
}

/* ── Brand Identity / KV types ──────────────────────────── */

export type IdentityStatus = "generating" | "draft" | "approved";

export interface BrandColor {
  name: string;
  hex: string;
  usage: "primary" | "secondary" | "accent" | "light" | "dark";
}

export interface BrandFont {
  name: string;        // e.g. "Playfair Display"
  googleFont: string;  // e.g. "Playfair+Display:wght@400;700"
  usage: "display" | "body";
}

export interface BrandLogo {
  type: "wordmark" | "wordmark-accent" | "lettermark";
  text: string;
  accentText?: string;
  fontFamily: string;
  fontWeight: string;
  accentFontWeight?: string;
  accentItalic?: boolean;
  letterSpacing: string;
  textTransform?: "uppercase" | "none";
  mainColor: string;
  accentColor?: string;
  subtext?: string;
  subtextSpacing?: string;
  decorativeStyle?: "flanking-lines" | "rule-below" | "geo-mark" | "gradient-line" | "none";
}

export interface BrandIdentity {
  status: IdentityStatus;
  concept: string;
  words: string[];
  colors: BrandColor[];
  fonts: BrandFont[];
  logo: BrandLogo;
  svgLogo?: string;
  createdAt: string;
  approvedAt?: string;
}

/* ── Email sequences ─────────────────────────────────────── */

export type EmailSequenceType = "cpl" | "vendas" | "recuperacao";

export interface EmailItem {
  subject: string;
  subject_b?: string;
  subject_c?: string;
  preview: string;
  preview_b?: string;
  body: string;
  cta?: string;
  cta_b?: string;
  ps?: string;
}

export type EmailSequences = Record<EmailSequenceType, EmailItem[]>;

/* ── Kit ─────────────────────────────────────────────────── */

export interface LaunchKit {
  id: string;
  strategyId: StrategyId;
  brandInfo: BrandInfo;
  brandIdentity?: BrandIdentity;
  assets: KitAssetInstance[];
  emailSequences?: EmailSequences;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WizardState {
  step: WizardStep;
  brandInfo: Partial<BrandInfo>;
  selectedStrategy: StrategyId | null;
}
