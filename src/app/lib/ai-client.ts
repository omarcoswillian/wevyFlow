/**
 * Server-only AI client abstraction.
 * Wraps Anthropic and OpenAI SDKs into a unified streaming interface.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { AIProvider, DEFAULT_MODELS } from "./ai-provider";

const _serverAnthropic = new Anthropic(); // uses ANTHROPIC_API_KEY env

function anthropicClient(apiKey: string) {
  return new Anthropic({ apiKey });
}

function openaiClient(apiKey: string, provider: "openai" | "openrouter") {
  return new OpenAI({
    apiKey,
    baseURL: provider === "openrouter" ? "https://openrouter.ai/api/v1" : undefined,
    defaultHeaders: provider === "openrouter"
      ? { "HTTP-Referer": "https://wevyflow.com", "X-Title": "WevyFlow" }
      : undefined,
  });
}

export interface AICallConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

/** Resolve config: use user key if provided, else fall back to server Anthropic key */
export function resolveConfig(apiKey?: string, provider?: string, model?: string): AICallConfig {
  if (apiKey && apiKey.length > 20) {
    const p = (provider as AIProvider) || "anthropic";
    return { provider: p, apiKey, model: model || DEFAULT_MODELS[p] };
  }
  return {
    provider: "anthropic",
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-sonnet-4-6",
  };
}

/** One-shot text call (non-streaming) */
export async function callOnce(
  config: AICallConfig,
  system: string,
  userMsg: string,
  maxTokens = 512
): Promise<string> {
  const model = config.model || DEFAULT_MODELS[config.provider];

  if (config.provider === "anthropic") {
    const res = await anthropicClient(config.apiKey).messages.create({
      model,
      max_tokens: maxTokens,
      // Cache system prompt so repeat calls (compose + personalize chain) hit cache
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMsg }],
    });
    return res.content[0].type === "text" ? res.content[0].text : "";
  }

  const res = await openaiClient(config.apiKey, config.provider as "openai" | "openrouter")
    .chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg },
      ],
    });
  return res.choices[0]?.message?.content ?? "";
}

/** Start a streaming response — returns AsyncIterable<string> chunks */
export async function startStream(
  config: AICallConfig,
  system: string,
  userMsg: string,
  maxTokens = 32000,
  images?: { base64: string; name: string }[]
): Promise<AsyncIterable<string>> {
  const model = config.model || DEFAULT_MODELS[config.provider];

  if (config.provider === "anthropic") {
    // Build content with optional images
    let content: Anthropic.MessageParam["content"] = userMsg;
    if (images && images.length > 0) {
      content = [
        { type: "text", text: userMsg },
        ...images.map((img) => {
          const [meta, data] = img.base64.split(",");
          const mediaType = (meta.match(/:(.*?);/) || [])[1] as
            | "image/jpeg" | "image/png" | "image/gif" | "image/webp";
          return { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data } };
        }),
      ];
    }

    const stream = await anthropicClient(config.apiKey).messages.create({
      model,
      max_tokens: maxTokens,
      stream: true,
      // Cache system prompt — repeated refinements on same session hit cache (~80% cost reduction)
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    });

    return (async function* () {
      for await (const chunk of stream as AsyncIterable<Anthropic.RawMessageStreamEvent>) {
        if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
          yield chunk.delta.text;
        }
      }
    })();
  }

  // OpenAI / OpenRouter
  const oaiMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: userMsg },
  ];

  const stream = await openaiClient(config.apiKey, config.provider as "openai" | "openrouter")
    .chat.completions.create({
      model,
      max_tokens: Math.min(maxTokens, 16384), // OpenAI max output
      stream: true,
      messages: oaiMessages,
    });

  return (async function* () {
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) yield text;
    }
  })();
}

/** Check if a key+provider is functional (throws on failure) */
export async function validateKey(provider: AIProvider, apiKey: string): Promise<void> {
  const model = DEFAULT_MODELS[provider];

  if (provider === "anthropic") {
    await anthropicClient(apiKey).messages.create({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "." }],
    });
    return;
  }

  await openaiClient(apiKey, provider as "openai" | "openrouter")
    .chat.completions.create({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "." }],
    });
}

/** Convert streaming iterable into a Web ReadableStream for Response */
export function iterableToReadable(gen: AsyncIterable<string>): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of gen) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

const BILLING_URLS: Record<string, string> = {
  anthropic: "console.anthropic.com/settings/keys",
  openai: "platform.openai.com/settings/billing",
  openrouter: "openrouter.ai/credits",
};

/** Human-readable error from API exceptions */
export function parseApiError(e: unknown, provider?: string): { status: number; message: string } {
  const msg = String((e as Error)?.message ?? "");
  if (msg.includes("credit") || msg.includes("billing") || msg.includes("402") || msg.includes("insufficient")) {
    const url = provider ? BILLING_URLS[provider] : null;
    const detail = url ? ` Adicione em ${url}` : " Adicione créditos no painel do provedor.";
    return { status: 402, message: `Saldo insuficiente.${detail}` };
  }
  if (msg.includes("401") || msg.includes("invalid x-api-key") || msg.includes("Incorrect API key")) {
    return { status: 401, message: "API Key inválida ou expirada. Verifique e reconecte." };
  }
  if (msg.includes("404") || msg.includes("model not found") || msg.includes("does not exist")) {
    return { status: 404, message: "Modelo não encontrado. Verifique se o nome está correto." };
  }
  if (msg.includes("rate limit") || msg.includes("429")) {
    return { status: 429, message: "Limite de requisições atingido. Aguarde alguns segundos." };
  }
  return { status: 503, message: "Erro ao conectar com a IA. Tente novamente." };
}
