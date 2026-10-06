import { META_GRAPH_BASE, MetaAdsApiError } from "@/lib/meta-ads/server";
import type { createServiceClient } from "@/lib/supabase/service";

type Service = ReturnType<typeof createServiceClient>;

/** Mídia dos anúncios da Meta: o servidor baixa (nunca o navegador) e guarda uma
 * cópia no nosso Storage, porque as URLs da CDN da Meta expiram e não têm CORS. */

const ALLOWED_HOST_SUFFIXES = [".fbcdn.net", ".facebook.com", ".fbsbx.com", ".cdninstagram.com", ".instagram.com"];
export const MAX_IMAGE_BYTES = 10_000_000;
/** Vídeo vai inline pra IA, então fica bem abaixo do limite de ~100 MB do corpo. */
export const MAX_VIDEO_BYTES = 20_000_000;
export const MAX_VIDEO_SECONDS = 60;

export function isAllowedMetaMediaUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && ALLOWED_HOST_SUFFIXES.some((s) => u.hostname.endsWith(s));
  } catch {
    return false;
  }
}

async function downloadLimited(url: string, maxBytes: number, accept: "image" | "video"): Promise<{ buffer: Buffer; contentType: string }> {
  // Só hosts da Meta e sem seguir redirect: o campo vem da API, mas não é motivo pra
  // o servidor buscar qualquer endereço.
  if (!isAllowedMetaMediaUrl(url)) throw new MetaAdsApiError("Endereço de mídia não permitido.", 400);
  const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new MetaAdsApiError("Não foi possível baixar a mídia do anúncio (o link pode ter expirado).", 502);
  const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!contentType.startsWith(`${accept}/`)) throw new MetaAdsApiError("A mídia do anúncio não está no formato esperado.", 502);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new MetaAdsApiError("A mídia do anúncio é grande demais para analisar.", 413);

  const reader = res.body?.getReader();
  if (!reader) throw new MetaAdsApiError("Não foi possível ler a mídia do anúncio.", 502);
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      throw new MetaAdsApiError("A mídia do anúncio é grande demais para analisar.", 413);
    }
    chunks.push(value);
  }
  return { buffer: Buffer.concat(chunks), contentType };
}

export interface AdRow {
  external_id: string | null;
  media_type: "image" | "video" | "unknown";
  video_id: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  media_path: string | null;
}

const BUCKET = "ai-images";

export function publicUrlFor(service: Service, path: string): string {
  return service.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function graphGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${META_GRAPH_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { code?: number } };
  if (json.error?.code === 190) throw new MetaAdsApiError("A conexão com o Meta Ads expirou — reconecte a conta.", 401);
  if (!res.ok || json.error) throw new MetaAdsApiError("A Meta não devolveu a mídia deste anúncio.", 502);
  return json;
}

/** Garante uma imagem (a própria imagem do anúncio, ou o quadro de capa do
 * vídeo) guardada no nosso Storage e devolve a URL pública dela. */
export async function ensureAdStill(service: Service, userId: string, ad: AdRow, token: string): Promise<{ url: string; path: string; buffer: Buffer; contentType: string }> {
  if (!ad.external_id) throw new MetaAdsApiError("Anúncio sem identificador da Meta.", 400);

  if (ad.media_path) {
    const { data } = await service.storage.from(BUCKET).download(ad.media_path);
    if (data) {
      return { url: publicUrlFor(service, ad.media_path), path: ad.media_path, buffer: Buffer.from(await data.arrayBuffer()), contentType: data.type || "image/jpeg" };
    }
    // Arquivo sumiu do Storage: baixa de novo da Meta.
  }

  let sourceUrl = ad.image_url ?? ad.thumbnail_url;
  if (ad.media_type === "video" && ad.video_id) {
    // Capa do vídeo em resolução melhor que a miniatura da lista.
    try {
      const v = await graphGet<{ picture?: string }>(`${ad.video_id}?fields=picture`, token);
      if (v.picture) sourceUrl = v.picture;
    } catch (e) {
      if (e instanceof MetaAdsApiError && e.status === 401) throw e;
    }
  }
  if (!sourceUrl) throw new MetaAdsApiError("Este anúncio não tem imagem disponível.", 404);

  const { buffer, contentType } = await downloadLimited(sourceUrl, MAX_IMAGE_BYTES, "image");
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const path = `${userId}/ads/${ad.external_id}.${ext}`;
  const { error } = await service.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true });
  if (error) throw new MetaAdsApiError("Não foi possível guardar a imagem do anúncio.", 500);
  await service.from("ad_watch_creatives").update({ media_path: path }).eq("user_id", userId).eq("source", "meta_ads_api").eq("external_id", ad.external_id);
  return { url: publicUrlFor(service, path), path, buffer, contentType };
}

/** Arquivo do vídeo, só se couber nos limites (curto e leve). Retorna null
 * quando não dá, e quem chama assume análise parcial pela capa. */
export async function fetchAdVideo(videoId: string, token: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  try {
    const v = await graphGet<{ source?: string; length?: number }>(`${videoId}?fields=source,length`, token);
    if (!v.source || (v.length ?? 0) > MAX_VIDEO_SECONDS) return null;
    return await downloadLimited(v.source, MAX_VIDEO_BYTES, "video");
  } catch (e) {
    if (e instanceof MetaAdsApiError && e.status === 401) throw e;
    return null;
  }
}

/** Apaga as cópias de mídia de anúncios de um usuário (desconexão/exclusão de dados). */
export async function deleteAdMedia(service: Service, userId: string): Promise<void> {
  const folder = `${userId}/ads`;
  const { data } = await service.storage.from(BUCKET).list(folder, { limit: 1000 });
  if (data?.length) await service.storage.from(BUCKET).remove(data.map((f) => `${folder}/${f.name}`));
}
