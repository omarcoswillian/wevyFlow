import { validateKey, parseApiError } from "../../lib/ai-client";
import { AIProvider } from "../../lib/ai-provider";

export async function POST(request: Request) {
  const { apiKey, provider, model } = await request.json();

  if (!apiKey || typeof apiKey !== "string" || apiKey.length < 20) {
    return Response.json({ error: "Chave inválida. Verifique se copiou corretamente." }, { status: 400 });
  }

  const resolvedProvider = (provider as AIProvider) || "anthropic";

  try {
    await validateKey(resolvedProvider, apiKey);
    return Response.json({ ok: true, provider: resolvedProvider, model });
  } catch (e: unknown) {
    const { status, message } = parseApiError(e, resolvedProvider);
    return Response.json({ error: message }, { status });
  }
}
