import { downloadLimited, MAX_IMAGE_BYTES, publicUrlFor } from "@/lib/ads/media";
import type { createServiceClient } from "@/lib/supabase/service";
import { YouTubeApiError } from "./server";

type Service = ReturnType<typeof createServiceClient>;
const BUCKET = "ai-images";

/** Guarda a thumbnail do vídeo no nosso Storage (URL estável e sem CORS) e devolve a imagem. */
export async function ensureYoutubeThumb(
  service: Service,
  userId: string,
  video: { video_id: string; thumbnail_url: string | null; thumbnail_path: string | null },
): Promise<{ url: string; buffer: Buffer; contentType: string }> {
  if (video.thumbnail_path) {
    const { data } = await service.storage.from(BUCKET).download(video.thumbnail_path);
    if (data) return { url: publicUrlFor(service, video.thumbnail_path), buffer: Buffer.from(await data.arrayBuffer()), contentType: data.type || "image/jpeg" };
  }
  if (!video.thumbnail_url) throw new YouTubeApiError("Este vídeo não tem thumbnail disponível.", 404);

  // A maior resolução pode não existir pra vídeos antigos (maxres): cai pra versão menor.
  const candidates = [video.thumbnail_url, video.thumbnail_url.replace("maxresdefault", "hqdefault")];
  let last: unknown;
  for (const src of [...new Set(candidates)]) {
    try {
      const { buffer, contentType } = await downloadLimited(src, MAX_IMAGE_BYTES, "image");
      const path = `${userId}/yt/${video.video_id}.jpg`;
      const { error } = await service.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: true });
      if (error) throw new YouTubeApiError("Não foi possível guardar a thumbnail.", 500);
      await service.from("youtube_videos").update({ thumbnail_path: path }).eq("user_id", userId).eq("video_id", video.video_id);
      return { url: publicUrlFor(service, path), buffer, contentType };
    } catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new YouTubeApiError("Não foi possível baixar a thumbnail.", 502);
}
