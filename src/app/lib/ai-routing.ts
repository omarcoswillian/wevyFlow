/**
 * Roteamento central de IA por TAREFA — decide qual modelo faz o quê.
 * Sem imports de SDK (seguro pra client e server).
 *
 * Divisão atual:
 *   copy / brand / html   -> Claude
 *   light                 -> Claude Haiku (tarefas simples e baratas)
 *   face                  -> OpenAI gpt-image-2 (rosto fiel à referência)
 *   text_in_image         -> OpenAI gpt-image-2 (texto legível dentro da arte)
 *
 * Face e texto: teste cego de 2026-10-05 (8 casos reais, mesmo brief nos dois
 * modelos, ordem A/B sorteada): OpenAI venceu rosto 7x1, texto 8x0, qualidade
 * geral 6x1. Gemini foi ~5x mais rápido (18s vs 77-113s) — continua disponível
 * por AI_IMAGE_PROVIDER_FACE=gemini quando a velocidade importar mais.
 *
 * Qualquer modelo pode ser trocado SEM mexer em código, por variável de
 * ambiente (ex.: pra testar um modelo novo só em copy):
 *   AI_MODEL_COPY=claude-sonnet-5-5
 *   AI_IMAGE_PROVIDER_FACE=gemini   AI_IMAGE_MODEL_FACE=gemini-3-pro-image-preview
 *
 * A chave/modelo que o próprio usuário configurou (BYOK) sempre vence a rota. */

import type { ImageProvider } from "./image-ai-provider";

export type TextTask = "copy" | "brand" | "html" | "light";
export type ImageTask = "face" | "text_in_image";

const TEXT_MODELS: Record<TextTask, string> = {
  copy: "claude-sonnet-4-6",
  brand: "claude-sonnet-4-6",
  html: "claude-sonnet-4-6",
  light: "claude-haiku-4-5-20251001",
};

const IMAGE_ROUTES: Record<ImageTask, { provider: ImageProvider; model: string }> = {
  face: { provider: "openai", model: "gpt-image-2" },
  text_in_image: { provider: "openai", model: "gpt-image-2" },
};

const IMAGE_PROVIDERS: ImageProvider[] = ["gemini", "openai", "fal"];

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

/** Modelo de texto (Anthropic) da tarefa, com override por AI_MODEL_<TAREFA>. */
export function textModelFor(task: TextTask): string {
  return env(`AI_MODEL_${task.toUpperCase()}`) ?? TEXT_MODELS[task];
}

/** Provedor + modelo de imagem da tarefa, com override por env. */
export function imageRouteFor(task: ImageTask): { provider: ImageProvider; model: string } {
  const base = IMAGE_ROUTES[task];
  const provider = env(`AI_IMAGE_PROVIDER_${task.toUpperCase()}`) as ImageProvider | undefined;
  const validProvider = provider && IMAGE_PROVIDERS.includes(provider) ? provider : base.provider;
  // Se o provedor foi trocado por env, o modelo padrão da rota não vale mais.
  const model = env(`AI_IMAGE_MODEL_${task.toUpperCase()}`) ?? (validProvider === base.provider ? base.model : "");
  return { provider: validProvider, model };
}
