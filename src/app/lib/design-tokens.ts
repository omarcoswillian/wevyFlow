/** Single source of truth for WevyFlow design tokens.
 * Used by both CSS (base-css.ts) and AI system prompts (generate/refine routes).
 */
export const TOKENS = {
  colors: {
    // brand
    brand: {
      primary:   "#a78bfa",
      secondary: "#6366f1",
      accent:    "#ec4899",
    },
    // backgrounds
    bg:      "#09090b",
    surface: "#111113",
    elevated:"#18181b",
    card:    "#1E1E1E",
    border:  "rgba(255,255,255,0.07)",
    // text
    text:    "#fafafa",
    muted:   "#a1a1aa",
    subtle:  "#71717a",
    // semantic
    success: "#10b981",
    warning: "#f59e0b",
    error:   "#f43f5e",
    info:    "#3b82f6",
    // legacy (kept for AI prompt compat)
    cta:     "#a78bfa",
    ctaHover:"#9061f9",
  },
  typography: {
    heading:         "Sora",
    body:            "Inter",
    mono:            "JetBrains Mono",
    headingDesktop:  "45px",
    headingMobile:   "28px",
    headingWeight:   600,
    bodySize:        "16px",
    bodyWeight:      400,
    lineHeight:      1.7,
  },
  spacing: {
    sectionPy: "80px",
  },
  radius: {
    sm:   "4px",
    md:   "8px",
    lg:   "12px",
    xl:   "16px",
    card: "12px",
    button:"8px",
    full: "9999px",
  },
  shadows: {
    sm:   "0 1px 3px rgba(0,0,0,0.4)",
    md:   "0 4px 16px rgba(0,0,0,0.5)",
    lg:   "0 8px 32px rgba(0,0,0,0.6)",
    glow: "0 0 20px rgba(167,139,250,0.25)",
  },
  transitions: {
    fast:   "150ms ease",
    base:   "200ms ease",
    slow:   "300ms ease",
  },
  zIndex: {
    sidebar:  100,
    dropdown: 200,
    overlay:  300,
    modal:    400,
    toast:    500,
  },
} as const;

/** Pre-formatted prompt snippet — paste into any system prompt */
export const DESIGN_TOKENS_PROMPT = `DESIGN TOKENS PADRAO:
- H1: ${TOKENS.typography.heading}, ${TOKENS.typography.headingDesktop}/${TOKENS.typography.headingMobile} mobile, weight ${TOKENS.typography.headingWeight}
- Body: ${TOKENS.typography.body}, ${TOKENS.typography.bodySize}, weight ${TOKENS.typography.bodyWeight}, line-height ${TOKENS.typography.lineHeight}
- Brand: primary ${TOKENS.colors.brand.primary}, secondary ${TOKENS.colors.brand.secondary}, accent ${TOKENS.colors.brand.accent}
- CTA: bg ${TOKENS.colors.brand.primary}, texto branco, min-height 52px, radius ${TOKENS.radius.button}, hover glow roxo
- Cores: bg ${TOKENS.colors.bg}, surface ${TOKENS.colors.surface}, elevated ${TOKENS.colors.elevated}, texto ${TOKENS.colors.text}, secundario ${TOKENS.colors.muted}
- Secoes: py ${TOKENS.spacing.sectionPy} desktop, alternando bg ${TOKENS.colors.bg} e ${TOKENS.colors.surface}
- Cards: bg ${TOKENS.colors.card}, border ${TOKENS.colors.border}, radius ${TOKENS.radius.card}, hover translateY(-2px)
- Contraste minimo 4.5:1. Texto sobre dark SEMPRE ${TOKENS.colors.text} ou ${TOKENS.colors.muted} (nunca abaixo)
- Sombra glow: ${TOKENS.shadows.glow}`;
