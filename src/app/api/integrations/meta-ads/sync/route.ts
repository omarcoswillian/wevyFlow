import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptToken } from "@/lib/meta-ads/crypto";
import { fetchMetaAds } from "@/lib/meta-ads/sync";
import { requireAuthUser, metaAdsErrorResponse, MetaAdsApiError } from "@/lib/meta-ads/server";

const COOLDOWN_MS = 60_000;

/** Sincroniza os anúncios reais da conta escolhida pra ad_watch_creatives.
 * Troca os dados de demonstração pelos reais e remove o que não existe mais
 * na conta (inclusive de uma conta anterior, se o usuário trocou). */
export async function POST() {
  try {
    const { user } = await requireAuthUser();
    const service = createServiceClient();

    const { data: conn, error: connErr } = await service
      .from("meta_ads_connections")
      .select("access_token, ad_account_id, ad_account_name, last_synced_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (connErr) throw new Error(connErr.message);
    if (!conn) throw new MetaAdsApiError("Nenhuma conexão com o Meta Ads encontrada.", 404);
    if (!conn.ad_account_id) throw new MetaAdsApiError("Escolha a conta de anúncios antes de sincronizar.", 400);

    if (conn.last_synced_at && Date.now() - new Date(conn.last_synced_at).getTime() < COOLDOWN_MS) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    let token: string;
    try {
      token = decryptToken(conn.access_token, user.id);
    } catch {
      throw new MetaAdsApiError("Não foi possível usar a conexão salva — reconecte a conta Meta.", 401);
    }

    const accountName = conn.ad_account_name ?? conn.ad_account_id;
    const { ads, complete } = await fetchMetaAds(conn.ad_account_id, accountName, token);

    if (ads.length > 0) {
      const { error } = await service.from("ad_watch_creatives").upsert(
        ads.map((a) => ({ ...a, user_id: user.id, source: "meta_ads_api" as const, meta_ad_account_id: conn.ad_account_id })),
        { onConflict: "user_id,source,external_id" },
      );
      if (error) throw new Error(error.message);
    }

    // Remove anúncios da Meta que não vieram mais (apagados, ou de outra
    // conta) — só quando a leitura foi completa, pra um corte por limite não
    // apagar dado válido.
    if (complete) {
      const keep = new Set(ads.map((a) => a.external_id));
      const { data: existing, error: exErr } = await service
        .from("ad_watch_creatives")
        .select("id, external_id")
        .eq("user_id", user.id)
        .eq("source", "meta_ads_api");
      if (exErr) throw new Error(exErr.message);
      const staleIds = (existing ?? []).filter((r) => !r.external_id || !keep.has(r.external_id)).map((r) => r.id);
      if (staleIds.length > 0) {
        const { error } = await service.from("ad_watch_creatives").delete().in("id", staleIds);
        if (error) throw new Error(error.message);
      }
    }

    // Conta real conectada: some a demonstração.
    const { error: mockErr } = await service.from("ad_watch_creatives").delete().eq("user_id", user.id).eq("source", "mock");
    if (mockErr) throw new Error(mockErr.message);

    await service.from("meta_ads_connections").update({ last_synced_at: new Date().toISOString() }).eq("user_id", user.id);
    return NextResponse.json({ ok: true, synced: ads.length });
  } catch (err) {
    const { body, status } = metaAdsErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
