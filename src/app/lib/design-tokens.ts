/** Single source of truth for WevyFlow design tokens.
 * Used by both CSS (base-css.ts) and AI system prompts (generate/refine routes).
 */
export const TOKENS = {
  colors: {
    bg: "#0C0C0C",
    surface: "#161616",
    card: "#1E1E1E",
    text: "#F5F5F5",
    muted: "#999",
    cta: "#FF5C00",
    ctaHover: "#E04E00",
    border: "rgba(255,255,255,0.08)",
  },
  typography: {
    heading: "Montserrat",
    body: "DM Sans",
    headingDesktop: "45px",
    headingMobile: "28px",
    headingWeight: 600,
    bodySize: "16px",
    bodyWeight: 400,
    lineHeight: 1.7,
  },
  spacing: {
    sectionPy: "80px",
  },
  radius: {
    card: "12px",
    button: "6px",
  },
} as const;

/** Pre-formatted prompt snippet — paste into any system prompt */
export const DESIGN_TOKENS_PROMPT = `DESIGN TOKENS PADRÃO:
- H1: ${TOKENS.typography.heading}, ${TOKENS.typography.headingDesktop}/${TOKENS.typography.headingMobile} mobile, weight ${TOKENS.typography.headingWeight}
- Body: ${TOKENS.typography.body}, ${TOKENS.typography.bodySize}, weight ${TOKENS.typography.bodyWeight}, line-height ${TOKENS.typography.lineHeight}
- CTA: bg ${TOKENS.colors.cta}, texto branco uppercase, min-height 52px, radius ${TOKENS.radius.button}, hover glow laranja
- Cores: bg ${TOKENS.colors.bg}, surface ${TOKENS.colors.surface}, card ${TOKENS.colors.card}, texto ${TOKENS.colors.text}, secundario ${TOKENS.colors.muted}
- Seções: py ${TOKENS.spacing.sectionPy} desktop, alternando bg ${TOKENS.colors.bg} e ${TOKENS.colors.surface}
- Cards: bg ${TOKENS.colors.card}, border ${TOKENS.colors.border}, radius ${TOKENS.radius.card}, hover translateY(-2px)
- Contraste mínimo 4.5:1. Texto sobre dark SEMPRE ${TOKENS.colors.text} ou ${TOKENS.colors.muted} (nunca abaixo)`;
