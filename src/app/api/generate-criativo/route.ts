import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { GoogleGenAI } from "@google/genai";
import { checkAndDeductCredit, isCreditError, limitReachedResponse, finalizeGeneration } from "../../lib/credits";

export type CriativoFormat =
  | "youtube-thumbnail"
  | "whatsapp"
  | "banner-horizontal"
  | "feed-retrato"
  | "feed-quadrado"
  | "stories";

const FORMAT_CONFIG: Record<CriativoFormat, { sizeOpenAI: string; sizeFal: { width: number; height: number }; platform: string; instructions: string }> = {
  "youtube-thumbnail": {
    sizeOpenAI: "1536x1024",
    sizeFal: { width: 1280, height: 720 },
    platform: "YouTube",
    instructions: "YouTube thumbnail format (16:9). Bold, high-contrast text. Eye-catching composition designed to maximize click-through rate. Large readable headline text prominently centered or upper area.",
  },
  "whatsapp": {
    sizeOpenAI: "1024x1024",
    sizeFal: { width: 1024, height: 1024 },
    platform: "WhatsApp",
    instructions: "Square format for WhatsApp broadcast or status. Clean, clear messaging. Mobile-optimized. Strong visual hierarchy with headline text easy to read on small screens.",
  },
  "banner-horizontal": {
    sizeOpenAI: "1536x1024",
    sizeFal: { width: 1216, height: 640 },
    platform: "Meta Ads / Google Display",
    instructions: "Horizontal banner for digital ads (Facebook, Instagram, Google Display). Clear visual hierarchy: headline left or center, CTA badge prominent, product/offer image on right side.",
  },
  "feed-retrato": {
    sizeOpenAI: "1024x1536",
    sizeFal: { width: 832, height: 1040 },
    platform: "Instagram Feed",
    instructions: "Portrait feed post format (4:5 ratio). Dominant vertical composition. Scroll-stopping visual. Headline in upper third, supporting info in middle, CTA near bottom.",
  },
  "feed-quadrado": {
    sizeOpenAI: "1024x1024",
    sizeFal: { width: 1024, height: 1024 },
    platform: "Instagram / Facebook Feed",
    instructions: "Square feed post. Balanced composition. Central visual element with headline overlay. Professional and polished for organic social media.",
  },
  "stories": {
    sizeOpenAI: "1024x1536",
    sizeFal: { width: 576, height: 1024 },
    platform: "Instagram Stories",
    instructions: "Vertical Stories format (9:16). Full-bleed visual. Text in safe zones (top 15% and bottom 15% avoid). Bold headline center or upper area. Strong CTA near bottom. Mobile-first, immersive design.",
  },
};

const FASE_CONTEXT: Record<string, string> = {
  aquecimento: "Campaign phase: AWARENESS/WARMING. Build curiosity and desire. No hard sell yet. Energy: inspiring, intriguing.",
  lancamento:  "Campaign phase: LAUNCH. Excitement and announcement energy. Product revealed. Energy: celebratory, high energy.",
  urgencia:    "Campaign phase: URGENCY. Limited time or spots. Scarcity messaging. Energy: intense, action-driven.",
  encerramento:"Campaign phase: CLOSING. Last chance. Final call. Energy: urgent, emotional, decisive.",
};

const ESTILO_CONTEXT: Record<string, string> = {
  minimal:      "Visual style: minimalist, clean, lots of white/dark space, elegant typography, subtle.",
  bold:         "Visual style: bold, high contrast, impactful, strong colors, large typography, punchy.",
  professional: "Visual style: professional, corporate, trustworthy, clean lines, business-appropriate.",
  colorful:     "Visual style: vibrant, colorful, energetic, multiple colors, playful and attention-grabbing.",
};

function buildPrompt(
  format: CriativoFormat,
  produto: string, headline: string, cta: string,
  cor: string, estilo: string, fase: string,
  chatInstruction?: string,
): string {
  const config = FORMAT_CONFIG[format];
  const parts = [
    `Create a professional digital marketing creative for ${config.platform}.`,
    config.instructions,
    produto   ? `Product/Offer: ${produto}` : "",
    headline  ? `Main headline text to display prominently in the image: "${headline}"` : "",
    cta       ? `CTA button or badge text: "${cta}"` : "",
    cor       ? `Primary color scheme: ${cor}` : "",
    ESTILO_CONTEXT[estilo] ?? "",
    FASE_CONTEXT[fase] ?? "",
    chatInstruction ? `Additional instruction: ${chatInstruction}` : "",
    "High quality, production-ready marketing creative. Text must be clearly legible. No blurry or distorted text. Professional graphic design quality.",
  ];
  return parts.filter(Boolean).join(" ");
}

async function runGeneration(params: {
  imageProvider: string;
  imageModel?: string;
  key: string | null;
  byok: string | null;
  format: CriativoFormat;
  prompt: string;
  referenceBase64?: string;
  quality: string;
  config: (typeof FORMAT_CONFIG)[CriativoFormat];
}): Promise<{ b64: string; mimeType: string }> {
  const { imageProvider, imageModel, key, format, prompt, referenceBase64, quality, config } = params;

  // ── Gemini path ──────────────────────────────────────────────
  if (imageProvider === "gemini") {
    if (!key) throw Object.assign(new Error("Chave Google AI Studio não configurada. Adicione em Configurações > IA de Imagem."), { status: 400 });

    const client = new GoogleGenAI({ apiKey: key });
    const model = imageModel || "gemini-3-pro-image-preview";

    const aspectMap: Record<string, string> = {
      "stories": "9:16", "feed-retrato": "9:16",
      "feed-quadrado": "1:1", "whatsapp": "1:1",
      "youtube-thumbnail": "16:9", "banner-horizontal": "16:9",
    };
    const aspectRatio = aspectMap[format] ?? "1:1";
    const promptWithAspect = `${prompt} Aspect ratio: ${aspectRatio}.`;

    const interaction = await client.interactions.create({
      model,
      input: promptWithAspect,
      response_modalities: ["image"],
      stream: false,
    });

    let b64 = "";
    let mimeType = "image/png";
    const outputs = (interaction as { outputs?: { type: string; data?: string; mime_type?: string }[] })?.outputs ?? [];
    for (const out of outputs) {
      if (out.type === "image" && out.data) {
        b64 = out.data;
        mimeType = out.mime_type ?? "image/png";
        break;
      }
    }

    if (!b64) throw new Error("Imagem não retornada pelo Gemini.");
    return { b64, mimeType };
  }

  // ── Fal.ai path ──────────────────────────────────────────────
  if (imageProvider === "fal") {
    if (referenceBase64) throw Object.assign(new Error("Edição com imagem de referência não é suportada com Fal.ai. Use OpenAI."), { status: 400 });
    if (!key) throw Object.assign(new Error("Chave Fal.ai não configurada. Adicione em Configurações > IA de Imagem."), { status: 400 });

    const model = imageModel || "fal-ai/flux-pro/v1.1";
    const falRes = await fetch(`https://fal.run/${model}`, {
      method: "POST",
      headers: { "Authorization": `Key ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, image_size: config.sizeFal, num_images: 1, sync_mode: true }),
    });

    if (!falRes.ok) {
      const errText = await falRes.text().catch(() => "");
      console.error("[generate-criativo fal]", falRes.status, errText);
      if (falRes.status === 401 || falRes.status === 403) throw Object.assign(new Error("API Key Fal.ai inválida ou expirada."), { status: 401 });
      if (falRes.status === 429) throw Object.assign(new Error("Limite de requisições Fal.ai atingido."), { status: 429 });
      throw new Error("Erro ao gerar criativo com Fal.ai.");
    }

    const falData = await falRes.json();
    const imageUrl = falData?.images?.[0]?.url;
    if (!imageUrl) throw new Error("Imagem não retornada pelo Fal.ai.");

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("Falha ao baixar imagem do Fal.ai.");

    const imgBuffer = await imgRes.arrayBuffer();
    const b64 = Buffer.from(imgBuffer).toString("base64");
    const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
    return { b64, mimeType };
  }

  // ── OpenAI path ──────────────────────────────────────────────
  if (!key) throw Object.assign(new Error("Chave OpenAI não configurada. Adicione em Configurações > IA de Imagem."), { status: 400 });

  const openai = new OpenAI({ apiKey: key });
  let b64: string | null | undefined;

  if (referenceBase64) {
    const [meta, b64data] = String(referenceBase64).split(",");
    const mimeMatch = meta.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
    const ext = mimeType.split("/")[1] ?? "png";
    const imageBuffer = Buffer.from(b64data ?? referenceBase64, "base64");
    const imageFile = await toFile(imageBuffer, `reference.${ext}`, { type: mimeType });

    const response = await openai.images.edit({
      model: imageModel || "gpt-image-1",
      image: imageFile,
      prompt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      size: config.sizeOpenAI as any,
      quality: quality as "high" | "medium" | "low",
      n: 1,
    });
    b64 = response.data?.[0]?.b64_json;
  } else {
    const response = await openai.images.generate({
      model: imageModel || "gpt-image-1",
      prompt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      size: config.sizeOpenAI as any,
      quality: quality as "high" | "medium" | "low",
      n: 1,
    });
    b64 = response.data?.[0]?.b64_json;
  }

  if (!b64) throw new Error("Imagem não retornada.");
  return { b64, mimeType: "image/png" };
}

export async function POST(req: NextRequest) {
  const {
    format,
    produto = "",
    headline = "",
    cta = "",
    cor = "",
    estilo = "bold",
    fase = "lancamento",
    quality = "high",
    apiKey,
    referenceBase64,
    chatInstruction,
    imageProvider = "openai",
    imageModel,
  } = await req.json();

  const hasBrief = headline?.trim() || produto?.trim();
  const hasChat  = chatInstruction?.trim();
  if (!hasBrief && !hasChat) {
    return NextResponse.json({ error: "Preencha o Brief ou descreva o criativo no chat." }, { status: 400 });
  }
  if (!FORMAT_CONFIG[format as CriativoFormat]) {
    return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
  }

  const creditResult = await checkAndDeductCredit("criativo_html", produto || headline || "");
  if (isCreditError(creditResult)) {
    return NextResponse.json({ error: creditResult.error }, { status: creditResult.status });
  }
  if (!creditResult.allowed) {
    return limitReachedResponse(creditResult) as NextResponse;
  }
  const { generationId } = creditResult;

  const byok = apiKey && apiKey.length > 10 ? apiKey : null;
  const key = byok ?? (imageProvider === "gemini" ? (process.env.GOOGLE_AI_API_KEY ?? null) : null);
  const criativoFormat = format as CriativoFormat;
  const config = FORMAT_CONFIG[criativoFormat];
  const prompt = buildPrompt(criativoFormat, produto, headline, cta, cor, estilo, fase, chatInstruction);

  try {
    const { b64, mimeType } = await runGeneration({
      imageProvider, imageModel, key, byok, format: criativoFormat,
      prompt, referenceBase64, quality, config,
    });
    await finalizeGeneration(generationId, true);
    return NextResponse.json({ b64, mimeType, prompt });
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? "");
    await finalizeGeneration(generationId, false, msg);

    console.error("[generate-criativo]", msg);

    const httpStatus = (e as { status?: number })?.status;
    if (httpStatus) return NextResponse.json({ error: msg }, { status: httpStatus });

    if (msg.includes("401") || msg.includes("API_KEY") || msg.includes("invalid") || msg.includes("Incorrect API key")) {
      return NextResponse.json({ error: "API Key inválida ou expirada." }, { status: 401 });
    }
    if (msg.includes("402") || msg.includes("billing") || msg.includes("credit")) {
      return NextResponse.json({ error: "Saldo insuficiente." }, { status: 402 });
    }
    if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate")) {
      return NextResponse.json({ error: "Cota esgotada. Aguarde alguns segundos." }, { status: 429 });
    }
    if (msg.includes("safety") || msg.includes("block") || msg.includes("SAFETY") || msg.includes("content_policy")) {
      return NextResponse.json({ error: "Prompt bloqueado. Reformule." }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao gerar criativo." }, { status: 500 });
  }
}
