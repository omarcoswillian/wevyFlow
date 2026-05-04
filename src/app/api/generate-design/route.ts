import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";

const ASPECT_MAP: Record<string, string> = {
  "1:1":   "1:1",
  "4:5":   "4:5",
  "9:16":  "9:16",
  "16:9":  "16:9",
};

function stripDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const [meta, data] = dataUrl.split(",");
  const match = meta.match(/:(.*?);/);
  return { mimeType: match?.[1] ?? "image/jpeg", data: data ?? "" };
}

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const {
      prompt,
      referenceImages,
      avatarImages,
      format = "9:16",
      imageModel,
    } = await req.json() as {
      prompt: string;
      referenceImages?: string[];
      avatarImages?: string[];
      format?: string;
      imageModel?: string;
    };

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt obrigatorio." }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Chave Google AI nao configurada." }, { status: 400 });
    }

    const client = new GoogleGenAI({ apiKey });
    const model = imageModel || "gemini-2.5-flash-image";
    const aspectRatio = ASPECT_MAP[format] ?? "9:16";
    const fullPrompt = `${prompt.trim()} Aspect ratio: ${aspectRatio}.`;

    const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [
      { text: fullPrompt },
    ];

    // Add reference images (each as inlineData)
    for (const imgDataUrl of (referenceImages ?? [])) {
      if (!imgDataUrl) continue;
      if (imgDataUrl.startsWith("data:")) {
        const { mimeType, data } = stripDataUrl(imgDataUrl);
        parts.push({ inlineData: { mimeType, data } });
      }
    }

    // Add avatar images
    for (const avDataUrl of (avatarImages ?? [])) {
      if (!avDataUrl) continue;
      if (avDataUrl.startsWith("data:")) {
        const { mimeType, data } = stripDataUrl(avDataUrl);
        parts.push({ inlineData: { mimeType, data } });
      }
    }

    const hasImages = parts.length > 1;

    let b64 = "";
    let mimeType = "image/png";

    if (hasImages) {
      // Multimodal: use generateContent with IMAGE response modality
      const result = await client.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: { responseModalities: [Modality.IMAGE] },
      });

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
    } else {
      // Text-only: use interactions.create (proven to work)
      const interaction = await client.interactions.create({
        model,
        input: fullPrompt,
        response_modalities: ["image"],
        stream: false,
      });

      const outputs = (interaction as { outputs?: { type: string; data?: string; mime_type?: string }[] })?.outputs ?? [];
      for (const out of outputs) {
        if (out.type === "image" && out.data) {
          b64 = out.data;
          mimeType = out.mime_type ?? "image/png";
          break;
        }
      }
    }

    if (!b64) {
      return NextResponse.json({ error: "Imagem nao retornada pelo modelo." }, { status: 500 });
    }

    return NextResponse.json({ b64, mimeType });
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? "");
    console.error("[generate-design]", msg);

    if (msg.includes("401") || msg.includes("API_KEY") || msg.includes("invalid")) {
      return NextResponse.json({ error: "API Key Google invalida ou expirada." }, { status: 401 });
    }
    if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
      return NextResponse.json({ error: "Cota Google insuficiente. Verifique billing em aistudio.google.com." }, { status: 429 });
    }
    if (msg.includes("safety") || msg.includes("SAFETY") || msg.includes("block")) {
      return NextResponse.json({ error: "Prompt bloqueado pelo Google. Reformule a instrucao." }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao gerar imagem." }, { status: 500 });
  }
}
