import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuthUser } from "@/lib/meta-ads/server";
import { youtubeErrorResponse, YouTubeApiError } from "@/lib/youtube/server";
import { ensureYoutubeThumb } from "@/lib/youtube/media";

export const maxDuration = 30;

/** Thumbnail do vídeo guardada no nosso Storage, pra usar como referência em Criativos. */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuthUser();
    const { videoId } = (await req.json().catch(() => ({}))) as { videoId?: string };
    if (!videoId) throw new YouTubeApiError("videoId é obrigatório.", 400);
    const service = createServiceClient();
    const { data: video } = await service.from("youtube_videos").select("video_id, thumbnail_url, thumbnail_path").eq("user_id", user.id).eq("video_id", videoId).maybeSingle();
    if (!video) throw new YouTubeApiError("Vídeo não encontrado.", 404);
    const still = await ensureYoutubeThumb(service, user.id, video);
    return NextResponse.json({ url: still.url });
  } catch (err) {
    const { body, status } = youtubeErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
