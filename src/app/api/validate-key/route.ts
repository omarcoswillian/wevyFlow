import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const { apiKey, provider } = await req.json() as { apiKey?: string; provider?: string };

    if (!apiKey || apiKey.length < 20) {
      return Response.json({ ok: false, error: "Chave inválida." }, { status: 400 });
    }

    if (provider === "anthropic") {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      });
      return Response.json({ ok: true });
    }

    if (provider === "openai") {
      const client = new OpenAI({ apiKey });
      await client.models.list();
      return Response.json({ ok: true });
    }

    if (provider === "openrouter") {
      const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) return Response.json({ ok: false, error: "Chave OpenRouter inválida." }, { status: 401 });
      return Response.json({ ok: true });
    }

    if (provider === "gemini") {
      const client = new GoogleGenAI({ apiKey });
      await client.models.list();
      return Response.json({ ok: true });
    }

    // Provedor desconhecido — aceita sem validar
    return Response.json({ ok: true });
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? "");
    if (
      msg.includes("401") || msg.includes("403") ||
      msg.includes("invalid") || msg.includes("Incorrect API key") ||
      msg.includes("API_KEY") || msg.includes("authentication")
    ) {
      return Response.json({ ok: false, error: "Chave inválida ou sem permissão." }, { status: 401 });
    }
    if (msg.includes("402") || msg.includes("billing") || msg.includes("credit") || msg.includes("insufficient")) {
      return Response.json({ ok: false, error: "Chave válida, mas sem saldo." }, { status: 402 });
    }
    if (msg.includes("429") || msg.includes("rate")) {
      // Rate limit means the key is valid
      return Response.json({ ok: true });
    }
    return Response.json({ ok: false, error: "Erro ao validar chave. Tente novamente." }, { status: 500 });
  }
}
