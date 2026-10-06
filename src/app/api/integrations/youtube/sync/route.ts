import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptToken } from "@/lib/meta-ads/crypto";
import { requireAuthUser } from "@/lib/meta-ads/server";
import { getAccessToken, YouTubeApiError, youtubeErrorResponse } from "@/lib/youtube/server";
import { fetchVideos, fetchVideoMetrics } from "@/lib/youtube/sync";

export const maxDuration = 60;

// A cota da Data API é diária e por projeto: não sincroniza a cada abertura de tela.
const COOLDOWN_MS = 5 * 60_000;
const YT_PERIODS = [28, 90, 365] as const;

export async function POST() {
  try {
    const { user } = await requireAuthUser();
    const service = createServiceClient();

    const { data: conn, error: connErr } = await service
      .from("youtube_connections")
      .select("refresh_token, uploads_playlist_id, last_synced_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (connErr) throw new Error(connErr.message);
    if (!conn) throw new YouTubeApiError("Nenhum canal do YouTube conectado.", 404);
    if (!conn.uploads_playlist_id) throw new YouTubeApiError("Não foi possível localizar os vídeos do canal: reconecte.", 400);

    if (conn.last_synced_at && Date.now() - new Date(conn.last_synced_at).getTime() < COOLDOWN_MS) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    let refresh: string;
    try { refresh = decryptToken(conn.refresh_token, user.id); }
    catch { throw new YouTubeApiError("Não foi possível usar a conexão salva: reconecte o canal.", 401); }
    const accessToken = await getAccessToken(refresh);

    const videos = await fetchVideos(accessToken, conn.uploads_playlist_id);
    if (videos.length > 0) {
      for (let i = 0; i < videos.length; i += 200) {
        const { error } = await service.from("youtube_videos").upsert(
          videos.slice(i, i + 200).map((v) => ({ ...v, user_id: user.id, updated_at: new Date().toISOString() })),
          { onConflict: "user_id,video_id" },
        );
        if (error) throw new Error(error.message);
      }
    }
    // Vídeos que saíram do canal não devem continuar na tela.
    const keep = new Set(videos.map((v) => v.video_id));
    const { data: existing } = await service.from("youtube_videos").select("video_id").eq("user_id", user.id);
    const stale = (existing ?? []).map((r) => r.video_id).filter((id) => !keep.has(id));
    if (stale.length > 0 && videos.length > 0) {
      await service.from("youtube_videos").delete().eq("user_id", user.id).in("video_id", stale);
      await service.from("youtube_video_metrics").delete().eq("user_id", user.id).in("video_id", stale);
    }

    let ctrAvailable: boolean | null = null;
    let metricsFailed = false;
    let metricRows = 0;
    try {
      for (const days of YT_PERIODS) {
        const { rows, ctrAvailable: ctr } = await fetchVideoMetrics(accessToken, days);
        ctrAvailable = (ctrAvailable ?? true) && ctr;
        if (rows.length > 0) {
          const { error } = await service.from("youtube_video_metrics").upsert(
            rows.filter((r) => keep.has(r.video_id)).map((r) => ({ ...r, user_id: user.id, period_days: days, fetched_at: new Date().toISOString() })),
            { onConflict: "user_id,video_id,period_days" },
          );
          if (error) throw new Error(error.message);
          metricRows += rows.length;
        }
      }
    } catch (err) {
      if (err instanceof YouTubeApiError && err.status === 401) throw err;
      console.error("[youtube sync] métricas falharam:", err);
      metricsFailed = true;
    }

    await service.from("youtube_connections")
      .update({ last_synced_at: new Date().toISOString(), ...(ctrAvailable !== null ? { ctr_available: ctrAvailable } : {}) })
      .eq("user_id", user.id);
    return NextResponse.json({ ok: true, videos: videos.length, metricRows, metricsFailed, ctrAvailable });
  } catch (err) {
    const { body, status } = youtubeErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
