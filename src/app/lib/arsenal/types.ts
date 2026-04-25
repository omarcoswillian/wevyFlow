/**
 * WevyFlow Arsenal — types for the curated catalog of sections and presets.
 *
 * A Section is an atomic, reusable block (hero, FAQ, pricing, etc.).
 * A Preset is a full-page composition (already a mosaic of sections).
 *
 * The compose step picks Sections + Presets to assemble a page.
 * The personalize step swaps slot markers with real copy.
 */

export type SectionKind =
  | "hero"           // above-the-fold opener
  | "urgencia"       // countdown / scarcity bar
  | "para-quem"      // "is this for you?" persona targeting
  | "depoimentos"    // testimonials
  | "oferta"         // price + stack of value
  | "faq"            // questions & answers
  | "cta-final"      // closing call-to-action
  | "cta"            // inline / mid-page CTA
  | "features"       // benefits / what-you-get grid
  | "beneficios"     // benefits grid (alternative)
  | "steps"          // 3/N step process
  | "processo"       // process / method steps
  | "bonus"          // bonuses stack
  | "mentor"         // author / instructor intro
  | "autoridade"     // authority / credentials
  | "garantia"       // guarantee / risk-reversal
  | "social-proof"   // stats / logos / credentials
  | "stats"          // numbers / metrics
  | "pilares"        // pillars / core principles
  | "results"        // results showcase
  | "modules"        // course modules / curriculum
  | "upgrade"        // upsell / upgrade block
  | "manifesto";     // narrative / belief section

export type SectionTheme =
  | "dark"
  | "light"
  | "boutique"       // editorial, curated, mauve/plum palette
  | "minimal"        // Apple-like, airy
  | "tech"           // SaaS-feel, gradients, blue/purple
  | "luxury"         // gold, dark, serifs
  | "cinematic"      // bold imagery, heavy overlays
  | "bege"           // warm neutrals, organic
  | "vibrant";       // saturated accents, playful

export type PageKind =
  | "vendas"         // sales page
  | "captura"        // lead capture
  | "saas"           // SaaS / product
  | "ecommerce"      // store / product listing
  | "blog"           // content / article
  | "quiz"           // funnel / interactive
  | "portfolio"      // showcase / personal
  | "workshop";      // event / live

export interface Section {
  /** Unique id — matches filename base in ready-templates/sections/ */
  id: string;
  /** Human label shown in UI */
  label: string;
  /** Short description for compose context + user preview */
  description: string;
  /** Primary functional kind */
  kind: SectionKind;
  /** Visual/emotional theme tags */
  themes: SectionTheme[];
  /** Page kinds this section commonly fits */
  suits: PageKind[];
  /** File name under src/app/lib/ready-templates/sections/ */
  file: string;
  /** Placeholder keys found inside [INSERIR: ...] markers */
  slots: string[];
  /** True if the section uses [INSERIR: ...] markers — false when copy is hardcoded */
  hasSlots: boolean;
  /** Font stack(s) referenced by this section */
  fonts?: string[];
  /** Primary accent color hex (if opinionated) */
  accent?: string;
}

export interface Preset {
  /** Unique id — matches filename base in ready-templates/ */
  id: string;
  /** Human label */
  label: string;
  /** Short description for compose + resources page */
  description: string;
  /** Which page kind this preset represents */
  kind: PageKind;
  /** Theme tags */
  themes: SectionTheme[];
  /** File name under src/app/lib/ready-templates/ (full-page monolith) */
  file: string;
  /**
   * Ordered list of section kinds contained in the preset — descriptive,
   * used by compose to understand what's inside without parsing the HTML.
   * Will become actual section ids once presets are split (Phase 2).
   */
  sectionOutline: SectionKind[];
  /** True until the preset is split into composable sections */
  monolithic: boolean;
  /** Accent color hex */
  accent?: string;
  /** Primary font stack */
  fonts?: string[];
}
