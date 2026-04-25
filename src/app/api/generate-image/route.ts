import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SIZE_MAP: Record<string, "1024x1024" | "1536x1024" | "1024x1536"> = {
  square: "1024x1024",
  landscape: "1536x1024",
  portrait: "1024x1536",
};

export async function POST(req: NextRequest) {
  try {
    const { prompt, size = "landscape", quality = "medium", apiKey } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt é obrigatório." }, { status: 400 });
    }

    const key = apiKey && apiKey.length > 20 ? apiKey : process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Chave OpenAI não configurada. Adicione sua chave em Configurações > BYOK ou defina OPENAI_API_KEY no servidor." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: key });

    const response = await openai.images.generate({
      model: "gpt-image-2",
      prompt: prompt.trim(),
      size: SIZE_MAP[size] ?? "1536x1024",
      quality: quality as "high" | "medium" | "low",
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "Imagem não retornada pela API." }, { status: 500 });
    }

    return NextResponse.json({ b64, mimeType: "image/png" });
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? "");
    if (msg.includes("401") || msg.includes("Incorrect API key")) {
      return NextResponse.json({ error: "API Key OpenAI inválida ou expirada." }, { status: 401 });
    }
    if (msg.includes("402") || msg.includes("billing") || msg.includes("credit") || msg.includes("insufficient")) {
      return NextResponse.json({ error: "Saldo OpenAI insuficiente. Adicione créditos em platform.openai.com." }, { status: 402 });
    }
    if (msg.includes("429") || msg.includes("rate limit")) {
      return NextResponse.json({ error: "Limite de requisições atingido. Aguarde alguns segundos." }, { status: 429 });
    }
    if (msg.includes("content_policy") || msg.includes("safety")) {
      return NextResponse.json({ error: "Prompt bloqueado pela política de conteúdo da OpenAI. Tente reformular." }, { status: 400 });
    }
    console.error("[generate-image]", e);
    return NextResponse.json({ error: "Erro ao gerar imagem. Tente novamente." }, { status: 500 });
  }
}
