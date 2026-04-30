import { resolveConfig, callOnce, parseApiError } from "../../lib/ai-client";
import { createClient } from "@/lib/supabase/server";
import type { BrandInfo, BrandIdentity, BrandLogo } from "../../lib/types-kit";

export const maxDuration = 60;

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
  const { brandInfo, apiKey, aiProvider, aiModel } = await request.json() as {
    brandInfo: BrandInfo;
    apiKey?: string;
    aiProvider?: string;
    aiModel?: string;
  };

  if (!brandInfo?.productName) {
    return Response.json({ error: "brandInfo.productName obrigatório" }, { status: 400 });
  }

  if (!apiKey) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return Response.json({ error: "Faça login para gerar identidade visual." }, { status: 401 });
    } catch { /* non-blocking */ }
  }

  const aiConfig = resolveConfig(apiKey, aiProvider, aiModel);

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

    return Response.json(identity);
  } catch (e: unknown) {
    console.error("[brand-identity] error:", e);
    const { status, message } = parseApiError(e, aiConfig.provider);
    return Response.json({ error: message }, { status });
  }
}
