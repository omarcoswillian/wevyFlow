import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptToken } from "@/lib/meta-ads/crypto";
import { requireAuthUser, metaAdsErrorResponse, MetaAdsApiError } from "@/lib/meta-ads/server";
import { ensureAdStill } from "@/lib/ads/media";

export const maxDuration = 30;

/** Baixa a imagem do anúncio (ou a capa do vídeo) pro nosso Storage e devolve
 * uma URL estável, sem CORS e que não expira. Usada ao mandar um anúncio como
 * referência pra Criativos. */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireAuthUser();
    const { adExternalId } = (await req.json().catch(() => ({}))) as { adExternalId?: string };
    if (!adExternalId) throw new MetaAdsApiError("adExternalId é obrigatório.", 400);

    const service = createServiceClient();
    const { data: ad } = await service
      .from("ad_watch_creatives")
      .select("external_id, media_type, video_id, image_url, thumbnail_url, media_path")
      .eq("user_id", user.id).eq("source", "meta_ads_api").eq("external_id", adExternalId)
      .maybeSingle();
    if (!ad) throw new MetaAdsApiError("Anúncio não encontrado.", 404);

    const { data: conn } = await service.from("meta_ads_connections").select("access_token").eq("user_id", user.id).maybeSingle();
    if (!conn) throw new MetaAdsApiError("Nenhuma conexão com o Meta Ads encontrada.", 404);
    let token: string;
    try { token = decryptToken(conn.access_token, user.id); }
    catch { throw new MetaAdsApiError("Não foi possível usar a conexão salva — reconecte a conta Meta.", 401); }

    const still = await ensureAdStill(service, user.id, ad, token);
    return NextResponse.json({ url: still.url });
  } catch (err) {
    const { body, status } = metaAdsErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
