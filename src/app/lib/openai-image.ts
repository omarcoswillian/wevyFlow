import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { DEFAULT_IMAGE_MODELS } from "./image-ai-provider";

/**
 * Shared OpenAI image generation/edit used by the routes that always run on
 * WevyFlow's own server key (Carrossel: generate-design, generate-design-bleed).
 *
 * The API only offers three canvas sizes (1024x1024, 1536x1024, 1024x1536),
 * while the product needs 4:5, 9:16, 16:9 and arbitrary stitched carousel
 * widths. Asking the model for the nearest canvas and stretching the result
 * would distort every pixel, so instead:
 *   - with a `template` image: the template is letterboxed (black bars) onto
 *     the canvas, and the exact content rectangle is cropped back out of the
 *     result — the output has the template's own aspect ratio;
 *   - without a template: the nearest canvas is generated and center-cropped
 *     to the requested `aspect`.
 */

type CanvasSize = "1024x1024" | "1536x1024" | "1024x1536";

const CANVASES: Array<{ size: CanvasSize; w: number; h: number }> = [
  { size: "1024x1024", w: 1024, h: 1024 },
  { size: "1536x1024", w: 1536, h: 1024 },
  { size: "1024x1536", w: 1024, h: 1536 },
];

// Below this relative drift between the wanted aspect and the canvas aspect,
// letterboxing is skipped and the tiny difference is cropped instead.
const LETTERBOX_DRIFT = 0.02;

const REQUEST_TIMEOUT_MS = 105_000;

export class OpenAIImageError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "OpenAIImageError";
    this.status = status;
  }
}

/** The client can still send a Gemini/Fal model id (persisted in localStorage
 *  from before) — only ever forward an OpenAI image model to OpenAI. */
export function resolveOpenAIImageModel(model?: string | null): string {
  return model && model.startsWith("gpt-image") ? model : DEFAULT_IMAGE_MODELS.openai;
}

/** The app's 1K/2K/4K knob (a Gemini concept) mapped to OpenAI's quality tiers. */
export function openAIQualityFromTier(tier?: string | null): "medium" | "high" {
  return tier === "1K" ? "medium" : "high";
}

function pickCanvas(aspect: number) {
  return CANVASES.reduce((best, c) =>
    Math.abs(Math.log(c.w / c.h / aspect)) < Math.abs(Math.log(best.w / best.h / aspect)) ? c : best,
  );
}

function dataUrlToBuffer(dataUrl: string): Buffer {
  const comma = dataUrl.indexOf(",");
  return Buffer.from(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl, "base64");
}

export interface GenerateOpenAIImageParams {
  prompt: string;
  /** Data URL of the image being edited; the output keeps its aspect ratio. */
  template?: string;
  /** Extra data URLs passed through as-is (e.g. an identity/avatar reference). */
  references?: string[];
  /** Wanted output width/height — only used when there is no template. */
  aspect?: number;
  model?: string | null;
  quality?: "low" | "medium" | "high";
  /** BYOK key; defaults to the server's OPENAI_API_KEY. */
  apiKey?: string;
}

export async function generateOpenAIImage(params: GenerateOpenAIImageParams): Promise<{ b64: string; mimeType: "image/png" }> {
  const apiKey = params.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIImageError("Chave OpenAI não configurada no servidor (OPENAI_API_KEY).", 400);

  const sharp = (await import("sharp")).default;
  const openai = new OpenAI({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
  const model = resolveOpenAIImageModel(params.model);
  const quality = params.quality ?? "high";
  const references = params.references ?? [];

  const toPng = async (dataUrl: string) =>
    sharp(dataUrlToBuffer(dataUrl), { failOn: "error" }).rotate().png().toBuffer();

  let response: Awaited<ReturnType<typeof openai.images.generate>>;
  // Content rectangle inside the canvas (fractions 0..1) to crop back out.
  let crop = { left: 0, top: 0, width: 1, height: 1 };

  if (params.template) {
    const primary = await sharp(dataUrlToBuffer(params.template), { failOn: "error" }).rotate().png().toBuffer({ resolveWithObject: true });
    const refW = primary.info.width;
    const refH = primary.info.height;
    const canvas = pickCanvas(refW / refH);

    // Fit the reference inside the canvas, centered, on black bars.
    const scale = Math.min(canvas.w / refW, canvas.h / refH);
    const fitW = Math.round(refW * scale);
    const fitH = Math.round(refH * scale);
    const barless = Math.abs(fitW / canvas.w - 1) < LETTERBOX_DRIFT && Math.abs(fitH / canvas.h - 1) < LETTERBOX_DRIFT;
    const left = barless ? 0 : Math.round((canvas.w - fitW) / 2);
    const top = barless ? 0 : Math.round((canvas.h - fitH) / 2);
    const contentW = barless ? canvas.w : fitW;
    const contentH = barless ? canvas.h : fitH;

    const resized = await sharp(primary.data).resize({ width: contentW, height: contentH, fit: "fill" }).png().toBuffer();
    const canvasPng = barless
      ? resized
      : await sharp({ create: { width: canvas.w, height: canvas.h, channels: 3, background: { r: 0, g: 0, b: 0 } } })
          .composite([{ input: resized, left, top }])
          .png()
          .toBuffer();
    crop = { left: left / canvas.w, top: top / canvas.h, width: contentW / canvas.w, height: contentH / canvas.h };

    const files = [await toFile(canvasPng, "image1.png", { type: "image/png" })];
    for (let i = 0; i < references.length; i++) {
      files.push(await toFile(await toPng(references[i]), `image${i + 2}.png`, { type: "image/png" }));
    }

    const barNote = barless
      ? ""
      : "\n\nIMAGE 1 is letterboxed: any solid black bars along its edges are padding that will be discarded. Keep those bars solid black and untouched, and keep all scene content inside the non-black area.";
    response = await openai.images.edit({
      model,
      image: files,
      prompt: params.prompt + barNote,
      size: canvas.size,
      quality,
      n: 1,
    });
  } else {
    const aspect = params.aspect ?? 1;
    const canvas = pickCanvas(aspect);
    if (references.length > 0) {
      const files = await Promise.all(references.map(async (ref, i) => toFile(await toPng(ref), `image${i + 1}.png`, { type: "image/png" })));
      response = await openai.images.edit({ model, image: files, prompt: params.prompt, size: canvas.size, quality, n: 1 });
    } else {
      response = await openai.images.generate({ model, prompt: params.prompt, size: canvas.size, quality, n: 1 });
    }

    const canvasAspect = canvas.w / canvas.h;
    if (Math.abs(canvasAspect / aspect - 1) >= LETTERBOX_DRIFT) {
      crop = canvasAspect > aspect
        ? { left: (1 - aspect / canvasAspect) / 2, top: 0, width: aspect / canvasAspect, height: 1 }
        : { left: 0, top: (1 - canvasAspect / aspect) / 2, width: 1, height: canvasAspect / aspect };
    }
  }

  const item = response.data?.[0];
  let raw = item?.b64_json ? Buffer.from(item.b64_json, "base64") : null;
  if (!raw && item?.url) {
    const img = await fetch(item.url);
    if (img.ok) raw = Buffer.from(await img.arrayBuffer());
  }
  if (!raw) throw new OpenAIImageError("Imagem não retornada pela OpenAI.", 500);

  const isFullFrame = crop.left === 0 && crop.top === 0 && crop.width === 1 && crop.height === 1;
  if (isFullFrame) return { b64: raw.toString("base64"), mimeType: "image/png" };

  const outMeta = await sharp(raw, { failOn: "error" }).metadata();
  const outW = outMeta.width ?? 0;
  const outH = outMeta.height ?? 0;
  if (!outW || !outH) throw new OpenAIImageError("Imagem inválida retornada pela OpenAI.", 500);
  const region = {
    left: Math.max(0, Math.round(crop.left * outW)),
    top: Math.max(0, Math.round(crop.top * outH)),
    width: Math.min(outW, Math.round(crop.width * outW)),
    height: Math.min(outH, Math.round(crop.height * outH)),
  };
  region.width = Math.min(region.width, outW - region.left);
  region.height = Math.min(region.height, outH - region.top);
  const cropped = await sharp(raw, { failOn: "error" }).extract(region).png().toBuffer();
  return { b64: cropped.toString("base64"), mimeType: "image/png" };
}

/** Maps an error thrown by generateOpenAIImage (or the OpenAI SDK) to the
 *  user-facing message/status the routes return. Null when it isn't an OpenAI error. */
export function mapOpenAIImageError(e: unknown): { error: string; status: number } | null {
  if (e instanceof OpenAIImageError) return { error: e.message, status: e.status };
  if (!(e instanceof OpenAI.APIError)) return null;
  const status = e.status ?? 500;
  const msg = String(e.message ?? "");
  if (e.code === "moderation_blocked" || e.code === "content_policy_violation" || /safety system|content.?policy/i.test(msg)) {
    return { error: "Geração bloqueada pela OpenAI. Tente reformular o prompt ou usar imagens diferentes.", status: 400 };
  }
  if (status === 401) return { error: "Chave OpenAI do servidor inválida ou expirada.", status: 401 };
  if (e.code === "billing_hard_limit_reached" || e.code === "insufficient_quota") {
    return { error: "Saldo OpenAI insuficiente. Adicione créditos em platform.openai.com.", status: 402 };
  }
  if (status === 403) return { error: "Organização OpenAI sem acesso a este modelo de imagem (pode exigir verificação da organização).", status: 403 };
  if (status === 429) return { error: "Limite de requisições OpenAI atingido. Aguarde alguns segundos.", status: 429 };
  if (status >= 500) return { error: "OpenAI sobrecarregada. Tente novamente em alguns segundos.", status: 503 };
  return { error: `Requisição inválida: ${msg.slice(0, 200)}`, status: 400 };
}
