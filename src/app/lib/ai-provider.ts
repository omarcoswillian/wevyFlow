/**
 * Shared AI provider types and metadata (client + server safe).
 * No SDK imports here — keep it importable by client components.
 */

export type AIProvider = "anthropic" | "openai" | "openrouter";

export interface ProviderMeta {
  label: string;
  description: string;
  keyPlaceholder: string;
  keyPrefix: string;
  docsUrl: string;
  color: string;
}

export const PROVIDER_META: Record<AIProvider, ProviderMeta> = {
  anthropic: {
    label: "Anthropic",
    description: "Claude Sonnet / Opus / Haiku",
    keyPlaceholder: "sk-ant-api03-...",
    keyPrefix: "sk-ant-",
    docsUrl: "https://console.anthropic.com/settings/keys",
    color: "#d97706",
  },
  openai: {
    label: "OpenAI",
    description: "GPT-4o / GPT-4o Mini / o3",
    keyPlaceholder: "sk-proj-...",
    keyPrefix: "sk-",
    docsUrl: "https://platform.openai.com/api-keys",
    color: "#10a37f",
  },
  openrouter: {
    label: "OpenRouter",
    description: "Claude · GPT · Gemini · Llama · Grok",
    keyPlaceholder: "sk-or-v1-...",
    keyPrefix: "sk-or-",
    docsUrl: "https://openrouter.ai/keys",
    color: "#6366f1",
  },
};

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
  openrouter: "anthropic/claude-sonnet-4-5",
};

export const MODEL_OPTIONS: Record<AIProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 — recomendado" },
    { id: "claude-opus-4-7", label: "Claude Opus 4.7 — melhor qualidade" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — mais rápido" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o — recomendado" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini — mais barato" },
    { id: "o3-mini", label: "o3-mini — raciocínio" },
  ],
  openrouter: [
    { id: "anthropic/claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { id: "openai/gpt-4o", label: "GPT-4o" },
    { id: "google/gemini-pro-1.5", label: "Gemini Pro 1.5" },
    { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
    { id: "x-ai/grok-2-1212", label: "Grok 2" },
    { id: "mistralai/mistral-large-2411", label: "Mistral Large" },
  ],
};

/** Detect likely provider from key format */
export function detectProvider(key: string): AIProvider {
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-or-")) return "openrouter";
  if (key.startsWith("sk-")) return "openai";
  return "anthropic";
}

export const STORAGE_KEY_KEY = "wevyflow_byok_key";
export const STORAGE_PROVIDER_KEY = "wevyflow_byok_provider";
export const STORAGE_MODEL_KEY = "wevyflow_byok_model";
