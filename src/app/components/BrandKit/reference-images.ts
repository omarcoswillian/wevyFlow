/** Shared resize/encode helpers for anything that becomes a KV reference
 * image — used both by "usar como referência" (Biblioteca/Gerados, source is
 * a URL) and by uploading a file directly in the Gerar wizard (source is a
 * File). Single implementation so every reference ends up capped the same
 * way regardless of where it came from, and so BRIEFING_LIMITS.
 * maxTotalRequestBytes (the whole-briefing PATCH cap, not just this field)
 * never gets blown by a raw upload — see launch-briefing.ts. */

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.85;

function bitmapToDataUrl(bitmap: ImageBitmap): string {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Falha ao processar a imagem.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

/** Fetches an image (same-origin static path or a public Storage URL),
 * downscales it, and returns a base64 JPEG data URL. */
export async function resizeImageFromUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Não foi possível carregar essa imagem.");
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    return bitmapToDataUrl(bitmap);
  } finally {
    bitmap.close();
  }
}

/** Same downscale/encode, starting from a local File (drag-drop or file
 * picker) instead of a URL. */
export async function resizeImageFile(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    return bitmapToDataUrl(bitmap);
  } finally {
    bitmap.close();
  }
}
