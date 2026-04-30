import { resolveConfig, callOnce, parseApiError } from "../../lib/ai-client";
import { checkAndDeductCredit, isCreditError, limitReachedResponse, finalizeGeneration } from "../../lib/credits";
import type { BrandInfo, BrandIdentity, BrandLogo } from "../../lib/types-kit";

export const maxDuration = 90;

const SVG_SYSTEM = `You are a professional SVG logo designer. Generate ONLY valid SVG code — no markdown, no code fences, no explanations. The first character must be "<".`;

function buildSvgPrompt(b: BrandInfo, identity: BrandIdentity): string {
  const primary = identity.colors.find(c => c.usage === "primary")?.hex || b.primaryColor || "#a78bfa";
  const accent  = identity.colors.find(c => c.usage === "accent")?.hex  || primary;
  const dark    = identity.colors.find(c => c.usage === "dark")?.hex    || "#0a0a0a";
  const display = identity.fonts.find(f => f.usage === "display");
  const body    = identity.fonts.find(f => f.usage === "body");
  const fontName = display?.name || "Sora";
  const bodyFont = body?.name || "Inter";
  const googleParam = [
    display?.googleFont || `${fontName.replace(/ /g,"+")}:wght@400;700`,
    body?.googleFont    || `${bodyFont.replace(/ /g,"+")}:wght@300;400`,
  ].join("&family=");
  const { logo } = identity;
  const subtext = logo.subtext || "";
  const style   = b.stylePreset || "dark-premium";
  const onDark  = style !== "light-clean";
  const textColor   = onDark ? "#ffffff" : dark;
  const accentColor = accent;

  const logoInstructions: Record<string, string> = {
    "wordmark": `Display the full name "${logo.text}" as a single bold text element. Use font-weight 700, letter-spacing around -0.02em to -0.04em. One color only: ${textColor}.`,
    "wordmark-accent": `Split the name into two visual parts. Part 1 "${logo.text.replace(logo.accentText || "", "").trim()}" in bold font-weight 700, color ${textColor}. Part 2 "${logo.accentText || ""}" in light font-weight 300 or italic, color ${accentColor}. Both on the same baseline or slightly offset.`,
    "lettermark": `Show only the initials of "${logo.text}" in very large type (font-size 80-100). Bold, centered, with a subtle geometric frame or underline in ${accentColor}.`,
  };
  const logoInst = logoInstructions[logo.type] || logoInstructions["wordmark"];

  const styleHint: Record<string, string> = {
    "dark-premium": "Refined, minimal. Use thin decorative lines (1-2px) in the accent color as flanking elements. Spacing is generous.",
    "light-clean": "Airy and clean. Minimal decoration. Let the typography breathe.",
    "luxury": "Ultra-refined. Optional thin horizontal rule below the name in gold/accent. Generous letter-spacing.",
    "neon-tech": "Digital precision. Optional small geometric square or hexagon element in accent color.",
    "glassmorphism": "Modern geometric. Optional small abstract dot cluster or grid pattern in accent.",
    "brutalist": "Maximum impact. Consider ALL CAPS with very wide or very tight tracking. Bold shapes.",
  };
  const hint = styleHint[style] || styleHint["dark-premium"];

  return `Create a professional SVG wordmark logo.

BRAND: ${b.productName}
STYLE: ${style} — ${hint}
LOGO TYPE: ${logoInst}
${subtext ? `TAGLINE: Display "${subtext}" below the name in uppercase, font-size 10-12, letter-spacing 0.2em, color ${textColor} at 40% opacity (add opacity="0.4" to the element).` : "NO tagline needed."}

REQUIRED SVG STRUCTURE:
<svg width="480" height="200" viewBox="0 0 480 200" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>@import url('https://fonts.googleapis.com/css2?family=${googleParam}&display=swap');</style>
  </defs>
  <!-- ALL text elements use text-anchor="middle" x="240" -->
  <!-- Main name: y around 95-105 depending on whether tagline exists -->
  <!-- Tagline: y around 125-135 -->
  <!-- Decorative elements: max 2 simple shapes (line, circle, rect) -->
</svg>

RULES:
— Background: none (transparent)
— All text: text-anchor="middle" x="240"
— Font families: "${fontName}, sans-serif" for headings, "${bodyFont}, sans-serif" for tagline
— Font sizes: main name 48-64px, tagline 10px
— No external images, no <image> tags, no complex paths
— Max 12 total SVG child elements
— Output ONLY the SVG, nothing else`;
}

function sanitizeSvg(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=/gi, " data-removed=")
    .replace(/javascript:/gi, "");
}

const SYSTEM = `You are a senior brand strategist and visual identity designer specializing in premium digital brands for the Brazilian market.

Generate a complete visual identity system. Return ONLY a valid JSON object — no markdown, no code fences, no comments. First character must be "{".`;

function buildPrompt(b: BrandInfo): string {
  return `Create a complete visual brand identity for:

Product: ${b.productName}
Niche: ${b.niche}
Target Audience: ${b.targetAudience}
Transformation: ${b.transformation}
${b.mecanismo ? `Unique Mechanism: ${b.mecanismo}` : ""}
Style Direction: ${b.stylePreset || "dark-premium"}
Client's Color Suggestion — Primary: ${b.primaryColor}, Secondary: ${b.secondaryColor}

Return this exact JSON (remove optional fields if not needed):
{
  "concept": "2-3 sentences brand positioning in Portuguese — essence, differentiation, emotional promise",
  "words": ["Palavra1", "Palavra2", "Palavra3", "Palavra4", "Palavra5"],
  "colors": [
    { "name": "Nome", "hex": "#rrggbb", "usage": "primary" },
    { "name": "Nome", "hex": "#rrggbb", "usage": "secondary" },
    { "name": "Nome", "hex": "#rrggbb", "usage": "accent" },
    { "name": "Nome", "hex": "#rrggbb", "usage": "dark" },
    { "name": "Nome", "hex": "#rrggbb", "usage": "light" }
  ],
  "fonts": [
    { "name": "Display Font Name", "googleFont": "Font+Name:wght@400;700", "usage": "display" },
    { "name": "Body Font Name", "googleFont": "Font+Name:wght@400;500", "usage": "body" }
  ],
  "logo": {
    "type": "wordmark-accent",
    "text": "${b.productName}",
    "accentText": "part of name styled differently (optional)",
    "fontFamily": "Same as display font name above",
    "fontWeight": "700",
    "accentFontWeight": "400",
    "accentItalic": true,
    "letterSpacing": "-0.03em",
    "textTransform": "none",
    "mainColor": "#hex from palette",
    "accentColor": "#hex from palette",
    "subtext": "short descriptor max 28 chars (optional)",
    "subtextSpacing": "0.18em"
  }
}

RULES:
— words: exactly 5 personality keywords in Portuguese (adjectives or nouns)
— colors: exactly 5, each usage type once; refine the client's color suggestion but keep the spirit
— fonts: REAL Google Fonts — bold choices that match the brand personality. Examples:
  display: "Cormorant Garamond", "Playfair Display", "Syne", "Bebas Neue", "Space Grotesk", "DM Serif Display", "Fraunces", "Cabinet Grotesk", "Plus Jakarta Sans", "Barlow Condensed"
  body: "DM Sans", "Sora", "Inter", "Outfit", "Plus Jakarta Sans", "Nunito Sans"
  NEVER use: Unbounded, Roboto, Arial, system-ui
— logo.type: "wordmark" (plain), "wordmark-accent" (part styled differently), "lettermark" (initials only)
— logo.accentText must be a substring found inside logo.text; omit if none needed
— logo.fontFamily must exactly match fonts[0].name
— letterSpacing: -0.05em (very tight) to 0.12em (widely spaced) — choose what fits the style
— subtext: optional brand tagline or descriptor, max 28 chars, ALL CAPS style

Style reference by direction:
— dark-premium: refined, deep blacks, use the primary color as accent; go for a distinctive serif or geometric sans
— light-clean: crisp whites, airy; prefer humanist sans or elegant serif
— luxury: deep jewel tones or true black + gold/warm accents; refined serif always
— neon-tech: dark bg, electric accent; bold geometric sans
— glassmorphism: deep blue/purple tones; modern geometric sans
— brutalist: stark B&W; ultra-bold condensed or wide display

ALL strings in Portuguese where applicable (concept, words, subtext).`;
}

function fallbackLogo(productName: string, primaryColor: string): BrandLogo {
  return {
    type: "wordmark",
    text: productName,
    fontFamily: "Sora",
    fontWeight: "700",
    letterSpacing: "-0.03em",
    textTransform: "none",
    mainColor: primaryColor || "#ffffff",
  };
}

export async function POST(request: Request) {
  const { brandInfo } = await request.json() as { brandInfo: BrandInfo };

  if (!brandInfo?.productName) {
    return Response.json({ error: "brandInfo.productName obrigatório" }, { status: 400 });
  }

  const creditResult = await checkAndDeductCredit("brand_identity", brandInfo.productName);
  if (isCreditError(creditResult)) {
    return Response.json({ error: creditResult.error }, { status: creditResult.status });
  }
  if (!creditResult.allowed) {
    return limitReachedResponse(creditResult);
  }
  const generationId = creditResult.generationId;

  const aiConfig = resolveConfig(undefined, undefined, undefined);

  try {
    const raw = await callOnce(aiConfig, SYSTEM, buildPrompt(brandInfo), 2048);

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Resposta inválida — JSON não encontrado.");

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate accentText is actually inside text
    if (parsed.logo?.accentText && !String(parsed.logo.text).includes(parsed.logo.accentText)) {
      parsed.logo.accentText = undefined;
      parsed.logo.accentColor = undefined;
      parsed.logo.accentFontWeight = undefined;
      parsed.logo.accentItalic = undefined;
      parsed.logo.type = "wordmark";
    }

    const identity: BrandIdentity = {
      status: "draft",
      concept: String(parsed.concept || ""),
      words: Array.isArray(parsed.words) ? parsed.words.slice(0, 7).map(String) : [],
      colors: Array.isArray(parsed.colors) ? parsed.colors.slice(0, 6) : [],
      fonts: Array.isArray(parsed.fonts) ? parsed.fonts.slice(0, 3) : [],
      logo: parsed.logo || fallbackLogo(brandInfo.productName, brandInfo.primaryColor),
      createdAt: new Date().toISOString(),
    };

    try {
      const svgRaw = await callOnce(aiConfig, SVG_SYSTEM, buildSvgPrompt(brandInfo, identity), 2000);
      const svgMatch = svgRaw.match(/<svg[\s\S]*?<\/svg>/i);
      if (svgMatch) identity.svgLogo = sanitizeSvg(svgMatch[0]);
    } catch { /* non-blocking — CSS fallback still works */ }

    await finalizeGeneration(generationId, true);
    return Response.json(identity);
  } catch (e: unknown) {
    console.error("[brand-identity] error:", e);
    const { status, message } = parseApiError(e, aiConfig.provider);
    await finalizeGeneration(generationId, false, message);
    return Response.json({ error: message }, { status });
  }
}
