import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptToken } from "@/lib/meta-ads/crypto";
import { deleteAdMedia } from "@/lib/ads/media";
import { requireAuthUser, metaAdsErrorResponse, META_GRAPH_BASE } from "@/lib/meta-ads/server";

export async function POST() {
  try {
    const { user } = await requireAuthUser();
    const service = createServiceClient();

    const { data, error: selErr } = await service
      .from("meta_ads_connections")
      .select("access_token, meta_user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);

    // O dado do usuário sai primeiro e é o que define sucesso: se apagar
    // falhar, devolvemos erro (nada de "ok" com token ainda guardado).
    const { error: delErr } = await service.from("meta_ads_connections").delete().eq("user_id", user.id);
    if (delErr) throw new Error(delErr.message);

    // Dados importados da Marketing API saem junto com a conexão.
    const { error: adsErr } = await service
      .from("ad_watch_creatives")
      .delete()
      .eq("user_id", user.id)
      .eq("source", "meta_ads_api");
    if (adsErr) throw new Error(adsErr.message);

    // Resultados, análises e cópias de mídia derivados dos dados da Meta também saem.
    await service.from("meta_ads_daily_insights").delete().eq("user_id", user.id);
    await service.from("ad_creative_analyses").delete().eq("user_id", user.id);
    try { await deleteAdMedia(service, user.id); } catch (e) { console.error("[meta-ads] falha ao apagar mídia:", e); }

    // Revogar do lado da Meta é best-effort: o token pode já ter expirado ou
    // sido revogado pelo usuário, ou não decifrar (chave trocada). Em todo
    // caso a conexão local já foi removida.
    let revoked = false;
    if (data) {
      try {
        const revokeUrl = new URL(`${META_GRAPH_BASE}/${data.meta_user_id}/permissions`);
        revokeUrl.searchParams.set("access_token", decryptToken(data.access_token, user.id));
        revoked = (await fetch(revokeUrl, { method: "DELETE" })).ok;
      } catch { /* best-effort */ }
    }
    return NextResponse.json({ ok: true, revoked });
  } catch (err) {
    const { body, status } = metaAdsErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
