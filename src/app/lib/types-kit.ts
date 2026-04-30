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
  | "email";

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
}

export interface BrandIdentity {
  status: IdentityStatus;
  concept: string;
  words: string[];
  colors: BrandColor[];
  fonts: BrandFont[];
  logo: BrandLogo;
  createdAt: string;
  approvedAt?: string;
}

/* ── Kit ─────────────────────────────────────────────────── */

export interface LaunchKit {
  id: string;
  strategyId: StrategyId;
  brandInfo: BrandInfo;
  brandIdentity?: BrandIdentity;
  assets: KitAssetInstance[];
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WizardState {
  step: WizardStep;
  brandInfo: Partial<BrandInfo>;
  selectedStrategy: StrategyId | null;
}
