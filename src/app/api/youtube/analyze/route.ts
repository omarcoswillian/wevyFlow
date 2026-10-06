import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuthUser } from "@/lib/meta-ads/server";
import { youtubeErrorResponse, YouTubeApiError } from "@/lib/youtube/server";
import { ensureYoutubeThumb } from "@/lib/youtube/media";
import { rankVideos } from "@/lib/youtube/scoring";
import { analyzeCreative, ANALYSIS_MODEL } from "@/lib/ads/creative-analysis";
import { checkAndDeductCredit, finalizeGeneration, isCreditError, limitReachedResponse } from "@/app/lib/credits";

export const maxDuration = 60;

/** Analisa a thumbnail de um vídeo por IA. A análise fica guardada em
 * ad_creative_analyses com ad_external_id = "yt:<videoId>" (uma por vídeo). */
export async function POST(req: NextRequest) {
  let generationId: string | undefined;
  try {
    const { user, supabase } = await requireAuthUser();
    const { videoId, periodDays = 28, force } = (await req.json().catch(() => ({}))) as { videoId?: string; periodDays?: number; force?: boolean };
    if (!videoId) throw new YouTubeApiError("videoId é obrigatório.", 400);
    const key = `yt:${videoId}`;

    const service = createServiceClient();
    const { data: video } = await service.from("youtube_videos")
      .select("video_id, title, published_at, thumbnail_url, thumbnail_path, view_count")
      .eq("user_id", user.id).eq("video_id", videoId).maybeSingle();
    if (!video) throw new YouTubeApiError("Vídeo não encontrado.", 404);

    if (!force) {
      const { data: existing } = await supabase.from("ad_creative_analyses").select("id, coverage, analysis, media_type")
        .eq("user_id", user.id).eq("ad_external_id", key).maybeSingle();
      if (existing) return NextResponse.json({ id: existing.id, coverage: existing.coverage, mediaType: existing.media_type, analysis: existing.analysis, cached: true });
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new YouTubeApiError("Chave Google AI não configurada.", 503);

    const credit = await checkAndDeductCredit("ad_analysis", key);
    if (isCreditError(credit)) return NextResponse.json({ error: credit.error }, { status: credit.status });
    if (!credit.allowed) return limitReachedResponse(credit) as NextResponse;
    generationId = credit.generationId;

    // Números do vídeo e do canal no período, pra IA ler a thumb à luz do resultado.
    const days = periodDays === 365 ? 365 : periodDays === 90 ? 90 : 28;
    const { data: all } = await supabase.from("youtube_video_metrics").select("video_id, views, avg_view_percentage, thumb_ctr, thumb_impressions").eq("period_days", days);
    const { data: vids } = await supabase.from("youtube_videos").select("video_id, published_at");
    const published = new Map((vids ?? []).map((v) => [v.video_id, new Date(v.published_at).getTime()]));
    const ranked = rankVideos(
      (all ?? []).filter((m) => published.has(m.video_id)).map((m) => ({ id: m.video_id, publishedAt: published.get(m.video_id)!, views: Number(m.views), avgViewPercentage: Number(m.avg_view_percentage) })),
      days, Date.now(),
    ).find((r) => r.id === videoId);
    const mine = (all ?? []).find((m) => m.video_id === videoId);
    const { data: ctrRow } = await supabase.from("youtube_studio_ctr").select("impressions, ctr, period_start, period_end").eq("video_id", videoId).order("period_end", { ascending: false }).limit(1).maybeSingle();
    const contextLine = mine
      ? [
          `${Number(mine.views)} visualizações nos últimos ${days} dias`,
          `${Number(mine.avg_view_percentage).toFixed(0)}% do vídeo assistido em média`,
          ...(ctrRow ? [`CTR da thumbnail ${(Number(ctrRow.ctr) * 100).toFixed(1)}% em ${Number(ctrRow.impressions)} impressões (${ctrRow.period_start} a ${ctrRow.period_end}, export do Studio)`] : []),
          ...(ranked?.index != null ? [`${ranked.index.toFixed(1)}x a mediana do canal`] : []),
        ].join(", ")
      : undefined;

    const still = await ensureYoutubeThumb(service, user.id, video);
    const analysis = await analyzeCreative(new GoogleGenAI({ apiKey }), {
      kind: "thumbnail", mediaType: "image",
      still: { mimeType: still.contentType, data: still.buffer.toString("base64") },
      headline: video.title, body: null, contextLine,
      verdict: ranked?.verdict ?? null, confidence: ranked?.confidence ?? null,
    });

    const { data: saved, error } = await service.from("ad_creative_analyses").upsert({
      user_id: user.id, ad_external_id: key, media_type: "image", coverage: "full",
      analysis: analysis as unknown as Record<string, unknown>, model: ANALYSIS_MODEL, created_at: new Date().toISOString(),
    }, { onConflict: "user_id,ad_external_id" }).select("id").single();
    if (error || !saved) throw new Error(error?.message ?? "Não foi possível salvar a análise.");

    await finalizeGeneration(generationId, true);
    return NextResponse.json({ id: saved.id, coverage: "full", mediaType: "image", analysis, cached: false });
  } catch (err) {
    if (generationId) await finalizeGeneration(generationId, false, err instanceof Error ? err.message : "erro");
    const { body, status } = youtubeErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
