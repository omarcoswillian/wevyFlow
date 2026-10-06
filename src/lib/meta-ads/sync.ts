import { META_GRAPH_BASE, MetaAdsApiError } from "@/lib/meta-ads/server";

/** Busca os anúncios de uma conta de anúncios na Marketing API e converte pro
 * formato de ad_watch_creatives. Só leitura (ads_read). */

const MAX_ADS = 500;
const PAGE_SIZE = 100;

interface MetaAd {
  id: string;
  name?: string;
  effective_status?: string;
  created_time?: string;
  updated_time?: string;
  creative?: {
    id?: string; title?: string; body?: string; thumbnail_url?: string; image_url?: string;
    image_hash?: string; video_id?: string; object_type?: string;
  };
  adset?: { start_time?: string; end_time?: string; targeting?: { publisher_platforms?: string[] } };
}

interface MetaAdsPage {
  data?: MetaAd[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message?: string; code?: number };
}

export interface SyncedAd {
  external_id: string;
  advertiser_name: string;
  headline: string | null;
  body: string | null;
  thumbnail_url: string | null;
  platforms: string[];
  status: "active" | "inactive";
  started_at: string;
  stopped_at: string | null;
  media_type: "image" | "video" | "unknown";
  creative_id: string | null;
  video_id: string | null;
  image_hash: string | null;
  image_url: string | null;
}

export async function fetchMetaAds(
  adAccountId: string,
  accountName: string,
  accessToken: string,
): Promise<{ ads: SyncedAd[]; complete: boolean }> {
  const ads: SyncedAd[] = [];
  let after: string | undefined;
  let complete = true;

  for (;;) {
    const url = new URL(`${META_GRAPH_BASE}/${adAccountId}/ads`);
    url.searchParams.set(
      "fields",
      "id,name,effective_status,created_time,updated_time,creative{id,title,body,thumbnail_url,image_url,image_hash,video_id,object_type},adset{start_time,end_time,targeting}",
    );
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (after) url.searchParams.set("after", after);

    // Token no header (não na URL) pra não vazar em logs/telemetria.
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = (await res.json().catch(() => ({}))) as MetaAdsPage;
    if (!res.ok || json.error) {
      if (json.error?.code === 190) {
        throw new MetaAdsApiError("A conexão com o Meta Ads expirou — reconecte a conta.", 401);
      }
      throw new MetaAdsApiError("Não foi possível ler os anúncios da Meta agora.", 502);
    }

    for (const ad of json.data ?? []) {
      const active = ad.effective_status === "ACTIVE";
      const startedAt = ad.adset?.start_time ?? ad.created_time;
      if (!startedAt) continue;
      const platforms = (ad.adset?.targeting?.publisher_platforms ?? []).filter((p) => p === "facebook" || p === "instagram");
      const c = ad.creative;
      // Vídeo se o criativo aponta pra um video_id (ou o tipo diz VIDEO); imagem
      // se tem arquivo de imagem; senão desconhecido (ex.: carrossel/dinâmico).
      const mediaType: SyncedAd["media_type"] =
        c?.video_id || c?.object_type === "VIDEO" ? "video" : c?.image_url || c?.image_hash ? "image" : "unknown";
      ads.push({
        external_id: ad.id,
        advertiser_name: accountName,
        headline: ad.creative?.title ?? ad.name ?? null,
        body: ad.creative?.body ?? null,
        // image_url é o arquivo original; thumbnail_url é uma miniatura. Prefere o original.
        thumbnail_url: c?.image_url ?? c?.thumbnail_url ?? null,
        media_type: mediaType,
        creative_id: c?.id ?? null,
        video_id: c?.video_id ?? null,
        image_hash: c?.image_hash ?? null,
        image_url: c?.image_url ?? null,
        platforms: platforms.length ? platforms : ["facebook", "instagram"],
        status: active ? "active" : "inactive",
        started_at: new Date(startedAt).toISOString(),
        stopped_at: active ? null : new Date(ad.adset?.end_time ?? ad.updated_time ?? startedAt).toISOString(),
      });
    }

    after = json.paging?.next ? json.paging.cursors?.after : undefined;
    if (!after) break;
    if (ads.length >= MAX_ADS) { complete = false; break; }
  }
  return { ads, complete };
}
