import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

type Part = { text?: string };

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Faça login para continuar." }, { status: 401 });
    }

    const { image } = await request.json() as { image?: string };
    const match = image?.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
    if (!match) {
      return Response.json({ error: "Imagem inválida." }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Chave Google AI nao configurada." }, { status: 400 });
    }

    const client = new GoogleGenAI({ apiKey });
    const result = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{
        role: "user",
        parts: [
          {
            text: "Does this image contain a clearly visible human person (a face and/or body)? Reply with exactly one word: YES or NO.",
          },
          { inlineData: { mimeType: match[1], data: match[2] } },
        ],
      }],
      config: {
        temperature: 0,
        maxOutputTokens: 5,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const answer = ((result.candidates?.[0]?.content?.parts ?? []) as Part[])
      .map(part => part.text ?? "")
      .join(" ")
      .trim()
      .toUpperCase();
    const decisions = answer.match(/\b(?:YES|NO)\b/g) ?? [];
    const hasPerson = decisions.length === 1 ? decisions[0] === "YES" : true;

    return Response.json({ hasPerson });
  } catch (error) {
    console.error("[detect-person]", error);
    return Response.json({ error: "Erro ao detectar pessoa." }, { status: 500 });
  }
}
