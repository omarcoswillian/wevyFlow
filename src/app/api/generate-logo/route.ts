import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

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

export function buildLogoPrompt(dna: BrandDNA): string {
  const { name, niche, tagline, personality, voiceTones, visualStyle, primaryColor, logoType, variant } = dna;

  const personalityParts = (Object.keys(personality) as Array<keyof typeof personality>).map((axis) => {
    const [low, high] = PERSONALITY_DESCRIPTORS[axis];
    return interpolate(personality[axis], low, high);
  });

  const voiceContext = voiceTones.length > 0
    ? `Brand voice: ${voiceTones.join(", ")}.`
    : "";

  const styleDirection = VISUAL_STYLE_MAP[visualStyle];

  const background = variant === "dark" ? "#0a0a0a background" : "#ffffff background";

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

  const taglineNote = tagline.trim() ? ` The brand tagline is: "${tagline.trim()}".` : "";

  const parts = [
    `Professional logo design for '${name}', a brand in the ${niche} space.${taglineNote}`,
    `Brand personality: ${personalityParts.join(", ")}.`,
    voiceContext,
    `Visual direction: ${styleDirection}.`,
    `Primary brand color: ${primaryColor}.`,
    `${background}. Isolated logo, centered composition, no drop shadows, no gradients unless intentional.`,
    logoTypeInstruction,
    "This should look like the output of a top-tier branding agency. Craft quality, not template quality.",
  ].filter(Boolean);

  return parts.join(" ");
}

export async function POST(req: NextRequest) {
  try {
    const {
      dna,
      apiKey,
      imageProvider = "openai",
      imageModel,
    } = await req.json();

    if (!dna?.name?.trim()) {
      return NextResponse.json({ error: "O nome da marca é obrigatório." }, { status: 400 });
    }

    const prompt = buildLogoPrompt(dna as BrandDNA);
    const byok = apiKey && apiKey.length > 10 ? apiKey : null;
    const key = byok ?? (imageProvider === "gemini" ? (process.env.GOOGLE_AI_API_KEY ?? null) : null);

    // ── Gemini 3 Pro Image (Nano Banana Pro) path ─────────────────
    if (imageProvider === "gemini") {
      if (!key) {
        return NextResponse.json(
          { error: "Chave Google AI Studio não configurada. Adicione em Configurações > IA de Imagem." },
          { status: 400 }
        );
      }
      try {
        const client = new GoogleGenAI({ apiKey: key });
        const model = imageModel || "gemini-3-pro-image-preview";

        const result = await client.models.generateContent({
          model,
          contents: [{ role: "user", parts: [{ text: `${prompt} Aspect ratio: 1:1.` }] }],
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

        if (!b64) {
          return NextResponse.json({ error: "Logo não retornado pelo Gemini." }, { status: 500 });
        }
        return NextResponse.json({ b64, mimeType, prompt });
      } catch (e: unknown) {
        const msg = String((e as Error)?.message ?? "");
        if (msg.includes("401") || msg.includes("API_KEY") || msg.includes("invalid")) {
          return NextResponse.json({ error: "API Key Google inválida ou expirada." }, { status: 401 });
        }
        if (msg.includes("429") || msg.includes("quota") || msg.includes("rate")) {
          return NextResponse.json({ error: "Limite de requisições Google atingido. Aguarde." }, { status: 429 });
        }
        if (msg.includes("safety") || msg.includes("block")) {
          return NextResponse.json({ error: "Prompt bloqueado pela política do Google. Tente reformular." }, { status: 400 });
        }
        console.error("[generate-logo gemini]", e);
        return NextResponse.json({ error: "Erro ao gerar logo com Gemini." }, { status: 500 });
      }
    }

    // ── Fal.ai path ──────────────────────────────────────────────
    if (imageProvider === "fal") {
      if (!key) {
        return NextResponse.json(
          { error: "Chave Fal.ai não configurada. Adicione em Configurações > IA de Imagem." },
          { status: 400 }
        );
      }
      const model = imageModel || "fal-ai/flux-pro/v1.1";

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
          return NextResponse.json({ error: "API Key Fal.ai inválida ou expirada." }, { status: 401 });
        }
        if (falRes.status === 429) {
          return NextResponse.json({ error: "Limite de requisições Fal.ai atingido. Aguarde alguns segundos." }, { status: 429 });
        }
        console.error("[generate-logo fal]", falRes.status, errText);
        return NextResponse.json({ error: "Erro ao gerar logo com Fal.ai." }, { status: 500 });
      }

      const falData = await falRes.json();
      const imageUrl = falData?.images?.[0]?.url;
      if (!imageUrl) {
        return NextResponse.json({ error: "Imagem não retornada pelo Fal.ai." }, { status: 500 });
      }

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return NextResponse.json({ error: "Falha ao baixar imagem do Fal.ai." }, { status: 500 });
      }
      const imgBuffer = await imgRes.arrayBuffer();
      const b64 = Buffer.from(imgBuffer).toString("base64");
      const contentType = imgRes.headers.get("content-type") || "image/jpeg";

      return NextResponse.json({ b64, mimeType: contentType, prompt });
    }

    // ── OpenAI path ──────────────────────────────────────────────
    // Require explicit BYOK — never fall back to server key for image generation
    const openaiKey = key;
    if (!openaiKey) {
      return NextResponse.json(
        { error: "Chave OpenAI não configurada. Adicione em Configurações > IA de Imagem." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: openaiKey });
    const response = await openai.images.generate({
      model: imageModel || "gpt-image-1",
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
      if (!imgRes.ok) return NextResponse.json({ error: "Falha ao baixar imagem gerada." }, { status: 500 });
      const buf = await imgRes.arrayBuffer();
      b64 = Buffer.from(buf).toString("base64");
    }

    if (!b64) {
      return NextResponse.json({ error: "Imagem não retornada pela API." }, { status: 500 });
    }

    return NextResponse.json({ b64, mimeType: "image/png", prompt });
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? "");
    if (msg.includes("401") || msg.includes("Incorrect API key")) return NextResponse.json({ error: "API Key inválida ou expirada." }, { status: 401 });
    if (msg.includes("402") || msg.includes("billing") || msg.includes("credit") || msg.includes("insufficient")) return NextResponse.json({ error: "Saldo insuficiente. Adicione créditos." }, { status: 402 });
    if (msg.includes("429") || msg.includes("rate limit")) return NextResponse.json({ error: "Limite de requisições atingido. Aguarde alguns segundos." }, { status: 429 });
    if (msg.includes("content_policy") || msg.includes("safety")) return NextResponse.json({ error: "Prompt bloqueado pela política de conteúdo. Tente reformular." }, { status: 400 });
    const detail = String((e as Error)?.message ?? "");
    console.error("[generate-logo]", detail || e);
    return NextResponse.json({ error: `Erro ao gerar logo: ${detail || "erro desconhecido"}` }, { status: 500 });
  }
}
