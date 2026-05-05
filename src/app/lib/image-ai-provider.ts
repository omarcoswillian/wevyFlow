/**
 * Image AI provider types and metadata.
 * Independent from text AI provider — user can mix Anthropic (text) + Gemini (image).
 */

export type ImageProvider = "gemini" | "openai" | "fal";

export interface ImageProviderMeta {
  label: string;
  description: string;
  keyPlaceholder: string;
  docsUrl: string;
  color: string;
}

export const IMAGE_PROVIDER_META: Record<ImageProvider, ImageProviderMeta> = {
  gemini: {
    label: "Google Gemini",
    description: "Gemini 3 Pro Image · Nano Banana Pro",
    keyPlaceholder: "AIza...",
    docsUrl: "https://aistudio.google.com/apikey",
    color: "#4285f4",
  },
  openai: {
    label: "OpenAI",
    description: "GPT-Image-2 · gpt-image-2",
    keyPlaceholder: "sk-proj-...",
    docsUrl: "https://platform.openai.com/api-keys",
    color: "#10a37f",
  },
  fal: {
    label: "Fal.ai",
    description: "Flux Pro · Dev · Schnell",
    keyPlaceholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:xxxx",
    docsUrl: "https://fal.ai/dashboard/keys",
    color: "#7c3aed",
  },
};

export const IMAGE_MODEL_OPTIONS: Record<ImageProvider, { id: string; label: string; note?: string }[]> = {
  gemini: [
    { id: "gemini-3-pro-image-preview",    label: "Gemini 3 Pro Image",        note: "Recomendado · Nano Banana" },
    { id: "gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image",   note: "Rápido" },
    { id: "gemini-2.5-flash-image",        label: "Gemini 2.5 Flash Image",    note: "Alternativo" },
    { id: "imagen-4.0-generate-001",       label: "Imagen 4",                  note: "Alta qualidade · Requer billing" },
    { id: "imagen-4.0-ultra-generate-001", label: "Imagen 4 Ultra",            note: "Máxima qualidade · Requer billing" },
  ],
  openai: [
    { id: "gpt-image-2", label: "GPT-Image-2", note: "Alta qualidade" },
  ],
  fal: [
    { id: "fal-ai/flux-pro/v1.1", label: "Flux Pro 1.1", note: "Melhor qualidade" },
    { id: "fal-ai/flux-pro",      label: "Flux Pro",     note: "Ótima qualidade" },
    { id: "fal-ai/flux-dev",      label: "Flux Dev",     note: "Bom custo-benefício" },
    { id: "fal-ai/flux-schnell",  label: "Flux Schnell", note: "Rápido e barato" },
  ],
};

export const DEFAULT_IMAGE_MODELS: Record<ImageProvider, string> = {
  gemini: "gemini-3-pro-image-preview",
  openai: "gpt-image-2",
  fal: "fal-ai/flux-pro/v1.1",
};

export const IMAGE_STORAGE_KEY      = "wf_img_key";
export const IMAGE_STORAGE_PROVIDER = "wf_img_provider";
export const IMAGE_STORAGE_MODEL    = "wf_img_model";
