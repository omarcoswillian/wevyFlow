import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptToken } from "@/lib/meta-ads/crypto";
import { requireAuthUser, metaAdsErrorResponse, MetaAdsApiError } from "@/lib/meta-ads/server";
import { ensureAdStill, fetchAdVideo } from "@/lib/ads/media";
import { analyzeCreative, ANALYSIS_MODEL, type CreativeAnalysis } from "@/lib/ads/creative-analysis";
import { rankAds, toMetrics, confidenceOf, type AdInsightTotals } from "@/lib/ads/scoring";
import { checkAndDeductCredit, finalizeGeneration, isCreditError, limitReachedResponse } from "@/app/lib/credits";

export const maxDuration = 120;

/** Analisa o criativo de um anúncio por IA e guarda o resultado (uma análise por
 * anúncio). Vídeo curto e leve é analisado de verdade; vídeo longo, grande ou
 * sem acesso cai em análise PARCIAL pela capa, e a resposta diz isso. */
export async function POST(req: NextRequest) {
  let generationId: string | undefined;
  try {
    const { user, supabase } = await requireAuthUser();
    const { adExternalId, from, to, force } = (await req.json().catch(() => ({}))) as {
      adExternalId?: string; from?: string; to?: string; force?: boolean;
    };
    if (!adExternalId) throw new MetaAdsApiError("adExternalId é obrigatório.", 400);

    const service = createServiceClient();
    const { data: ad } = await service
      .from("ad_watch_creatives")
      .select("external_id, media_type, video_id, image_url, thumbnail_url, media_path, headline, body")
      .eq("user_id", user.id).eq("source", "meta_ads_api").eq("external_id", adExternalId)
      .maybeSingle();
    if (!ad) throw new MetaAdsApiError("Anúncio não encontrado.", 404);

    // Já analisado: devolve o guardado, sem gastar crédito (a menos que peça refazer).
    if (!force) {
      const { data: existing } = await supabase
        .from("ad_creative_analyses").select("id, coverage, analysis, media_type")
        .eq("user_id", user.id).eq("ad_external_id", adExternalId).maybeSingle();
      if (existing) return NextResponse.json({ id: existing.id, coverage: existing.coverage, mediaType: existing.media_type, analysis: existing.analysis, cached: true });
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new MetaAdsApiError("Chave Google AI não configurada.", 503);

    const { data: conn } = await service.from("meta_ads_connections").select("access_token").eq("user_id", user.id).maybeSingle();
    if (!conn) throw new MetaAdsApiError("Nenhuma conexão com o Meta Ads encontrada.", 404);
    let token: string;
    try { token = decryptToken(conn.access_token, user.id); }
    catch { throw new MetaAdsApiError("Não foi possível usar a conexão salva — reconecte a conta Meta.", 401); }

    const isVideo = ad.media_type === "video" && Boolean(ad.video_id);
    const credit = await checkAndDeductCredit(isVideo ? "ad_analysis_video" : "ad_analysis", adExternalId);
    if (isCreditError(credit)) return NextResponse.json({ error: credit.error }, { status: credit.status });
    if (!credit.allowed) return limitReachedResponse(credit) as NextResponse;
    generationId = credit.generationId;

    // Performance do anúncio no período (se houver), pra a IA explicar o que viu à luz dos números.
    let metrics = null, verdict = null, confidence = null;
    if (from && to) {
      const { data: rows } = await supabase.rpc("ad_metrics_summary", { p_from: from, p_to: to });
      if (rows?.length) {
        const totals = (r: (typeof rows)[number]): AdInsightTotals => r;
        const ranked = rankAds(rows.map((r) => ({ id: r.ad_external_id, totals: totals(r) })));
        const mine = ranked.ads.find((a) => a.id === adExternalId);
        if (mine) ({ metrics, verdict, confidence } = { metrics: mine.metrics, verdict: mine.verdict, confidence: mine.confidence });
        else {
          const own = rows.find((r) => r.ad_external_id === adExternalId);
          if (own) { metrics = toMetrics(own); confidence = confidenceOf(metrics); }
        }
      }
    }

    const still = await ensureAdStill(service, user.id, ad, token);
    let video: { mimeType: string; data: string } | null = null;
    if (isVideo && ad.video_id) {
      const file = await fetchAdVideo(ad.video_id, token);
      if (file) video = { mimeType: file.contentType, data: file.buffer.toString("base64") };
    }
    const coverage: "full" | "partial" = isVideo && !video ? "partial" : "full";

    const analysis: CreativeAnalysis = await analyzeCreative(new GoogleGenAI({ apiKey }), {
      mediaType: isVideo ? "video" : "image",
      still: { mimeType: still.contentType, data: still.buffer.toString("base64") },
      video,
      headline: ad.headline,
      body: ad.body,
      metrics, verdict, confidence,
    });

    const { data: saved, error } = await service
      .from("ad_creative_analyses")
      .upsert({
        user_id: user.id, ad_external_id: adExternalId, media_type: isVideo ? "video" : "image",
        coverage, analysis: analysis as unknown as Record<string, unknown>, model: ANALYSIS_MODEL,
        created_at: new Date().toISOString(),
      }, { onConflict: "user_id,ad_external_id" })
      .select("id").single();
    if (error || !saved) throw new Error(error?.message ?? "Não foi possível salvar a análise.");

    await finalizeGeneration(generationId, true);
    return NextResponse.json({ id: saved.id, coverage, mediaType: isVideo ? "video" : "image", analysis, stillUrl: still.url, cached: false });
  } catch (err) {
    if (generationId) await finalizeGeneration(generationId, false, err instanceof Error ? err.message : "erro");
    const { body, status } = metaAdsErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
