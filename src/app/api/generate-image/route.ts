import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { checkAndDeductCredit, isCreditError, limitReachedResponse, finalizeGeneration } from "../../lib/credits";

const SIZE_MAP_OPENAI: Record<string, "1024x1024" | "1536x1024" | "1024x1536"> = {
  square:    "1024x1024",
  landscape: "1536x1024",
  portrait:  "1024x1536",
};

const SIZE_MAP_FAL: Record<string, { width: number; height: number }> = {
  square:    { width: 1024, height: 1024 },
  landscape: { width: 1344, height: 768 },
  portrait:  { width: 768,  height: 1344 },
};

const GEMINI_ASPECT: Record<string, string> = {
  square:    "1:1",
  landscape: "16:9",
  portrait:  "9:16",
};

export async function POST(req: NextRequest) {
  let generationId: string | undefined;
  try {
    const {
      prompt,
      size = "landscape",
      quality = "medium",
      apiKey,
      imageProvider = "openai",
      imageModel,
    } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt é obrigatório." }, { status: 400 });
    }

    // Every image call — including BYOK — consumes a plan credit, same
    // policy as generate-criativo. This route previously had no auth or
    // quota check at all: anyone who found the URL could call it for free,
    // and the Gemini branch falls back to WevyFlow's own server-side key.
    const creditResult = await checkAndDeductCredit("image", prompt.trim());
    if (isCreditError(creditResult)) {
      return NextResponse.json({ error: creditResult.error }, { status: creditResult.status });
    }
    if (!creditResult.allowed) {
      return limitReachedResponse(creditResult) as NextResponse;
    }
    generationId = creditResult.generationId;
    const failWithCredit = async (error: string, status: number) => {
      await finalizeGeneration(generationId!, false, error);
      return NextResponse.json({ error }, { status });
    };

    const byok = apiKey && apiKey.length > 10 ? apiKey : null;
    const key = byok ?? (imageProvider === "gemini" ? (process.env.GOOGLE_AI_API_KEY ?? null) : null);

    // ── Gemini 3 Pro Image (Nano Banana) path ────────────────────
    if (imageProvider === "gemini") {
      if (!key) {
        return failWithCredit("Chave Google AI Studio não configurada. Adicione em Configurações > IA de Imagem.", 400);
      }
      try {
        const client = new GoogleGenAI({ apiKey: key });
        const model = imageModel || "gemini-2.5-flash-image";
        const aspectRatio = GEMINI_ASPECT[size] ?? "16:9";

        const response = await client.models.generateContent({
          model,
          contents: prompt.trim(),
          config: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio },
          },
        });

        let b64 = "";
        let mimeType = "image/png";
        const parts = response.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            b64 = part.inlineData.data;
            mimeType = part.inlineData.mimeType ?? "image/png";
            break;
          }
        }

        if (!b64) {
          return failWithCredit("Imagem não retornada pelo Gemini.", 500);
        }
        await finalizeGeneration(generationId, true);
        return NextResponse.json({ b64, mimeType });
      } catch (e: unknown) {
        const msg = String((e as Error)?.message ?? "");
        console.error("[generate-image gemini]", msg);
        if (msg.includes("401") || msg.includes("API_KEY") || msg.includes("invalid")) {
          return failWithCredit("API Key Google inválida ou expirada.", 401);
        }
        if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("rate") || msg.includes("too_many_requests")) {
          return failWithCredit("Cota Google insuficiente. Ative billing em aistudio.google.com ou troque o modelo para Gemini 2.5 Flash Image em Configurações > IA de Imagem.", 429);
        }
        if (msg.includes("safety") || msg.includes("block") || msg.includes("SAFETY")) {
          return failWithCredit("Prompt bloqueado pela política do Google. Tente reformular.", 400);
        }
        if (msg.includes("not found") || msg.includes("404") || msg.includes("MODEL")) {
          return failWithCredit("Modelo Gemini não disponível para esta chave. Verifique o acesso.", 400);
        }
        return failWithCredit("Erro ao gerar imagem com Gemini.", 500);
      }
    }

    // ── Fal.ai path ──────────────────────────────────────────────
    if (imageProvider === "fal") {
      if (!key) {
        return failWithCredit("Chave Fal.ai não configurada. Adicione em Configurações > IA de Imagem.", 400);
      }
      const model = imageModel || "fal-ai/flux-pro/v1.1";
      const dims = SIZE_MAP_FAL[size] ?? SIZE_MAP_FAL.landscape;

      const falRes = await fetch(`https://fal.run/${model}`, {
        method: "POST",
        headers: {
          "Authorization": `Key ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          image_size: dims,
          num_images: 1,
          sync_mode: true,
        }),
      });

      if (!falRes.ok) {
        const errText = await falRes.text().catch(() => "");
        if (falRes.status === 401 || falRes.status === 403) {
          return failWithCredit("API Key Fal.ai inválida ou expirada.", 401);
        }
        if (falRes.status === 429) {
          return failWithCredit("Limite de requisições Fal.ai atingido. Aguarde alguns segundos.", 429);
        }
        console.error("[generate-image fal]", falRes.status, errText);
        return failWithCredit("Erro ao gerar imagem com Fal.ai.", 500);
      }

      const falData = await falRes.json();
      const imageUrl = falData?.images?.[0]?.url;
      if (!imageUrl) {
        return failWithCredit("Imagem não retornada pelo Fal.ai.", 500);
      }

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        return failWithCredit("Falha ao baixar imagem do Fal.ai.", 500);
      }
      const imgBuffer = await imgRes.arrayBuffer();
      const b64 = Buffer.from(imgBuffer).toString("base64");
      const contentType = imgRes.headers.get("content-type") || "image/jpeg";

      await finalizeGeneration(generationId, true);
      return NextResponse.json({ b64, mimeType: contentType });
    }

    // ── OpenAI path ──────────────────────────────────────────────
    const openaiKey = key;
    if (!openaiKey) {
      return failWithCredit("Chave OpenAI não configurada. Adicione em Configurações > IA de Imagem.", 400);
    }

    const openai = new OpenAI({ apiKey: openaiKey });
    const response = await openai.images.generate({
      model: imageModel || "gpt-image-2",
      prompt: prompt.trim(),
      size: SIZE_MAP_OPENAI[size] ?? "1536x1024",
      quality: quality as "high" | "medium" | "low",
      n: 1,
    });

    type ImageItem = { b64_json?: string | null; url?: string | null };
    const item = (response.data as ImageItem[] | undefined)?.[0];
    let b64 = item?.b64_json ?? undefined;

    if (!b64 && item?.url) {
      const imgRes = await fetch(item.url);
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        b64 = Buffer.from(buf).toString("base64");
      }
    }

    if (!b64) {
      return failWithCredit("Imagem não retornada pela API.", 500);
    }

    await finalizeGeneration(generationId, true);
    return NextResponse.json({ b64, mimeType: "image/png" });
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? "");
    if (generationId) await finalizeGeneration(generationId, false, msg);
    if (msg.includes("401") || msg.includes("Incorrect API key")) return NextResponse.json({ error: "API Key inválida ou expirada." }, { status: 401 });
    if (msg.includes("402") || msg.includes("billing") || msg.includes("credit") || msg.includes("insufficient")) return NextResponse.json({ error: "Saldo insuficiente. Adicione créditos." }, { status: 402 });
    if (msg.includes("429") || msg.includes("rate limit")) return NextResponse.json({ error: "Limite de requisições atingido. Aguarde alguns segundos." }, { status: 429 });
    if (msg.includes("content_policy") || msg.includes("safety")) return NextResponse.json({ error: "Prompt bloqueado pela política de conteúdo. Tente reformular." }, { status: 400 });
    console.error("[generate-image]", e);
    return NextResponse.json({ error: "Erro ao gerar imagem. Tente novamente." }, { status: 500 });
  }
}
