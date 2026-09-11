import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuthUser, metaAdsErrorResponse, META_GRAPH_BASE } from "@/lib/meta-ads/server";

export async function POST() {
  try {
    const { user } = await requireAuthUser();
    const service = createServiceClient();

    const { data } = await service
      .from("meta_ads_connections")
      .select("access_token, meta_user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (data) {
      // Revoga o token do lado da Meta também — best-effort, não impede a
      // desconexão do lado da WevyFlow se a chamada falhar (token já pode
      // ter expirado/sido revogado manualmente pelo usuário).
      try {
        const revokeUrl = new URL(`${META_GRAPH_BASE}/${data.meta_user_id}/permissions`);
        revokeUrl.searchParams.set("access_token", data.access_token);
        await fetch(revokeUrl, { method: "DELETE" });
      } catch { /* best-effort */ }
    }

    await service.from("meta_ads_connections").delete().eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { body, status } = metaAdsErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
