import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuthUser, metaAdsErrorResponse, MetaAdsApiError } from "@/lib/meta-ads/server";

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthUser();
    const { adAccountId } = (await request.json().catch(() => ({}))) as { adAccountId?: string };
    if (!adAccountId) throw new MetaAdsApiError("adAccountId é obrigatório.", 400);

    const service = createServiceClient();
    const { data } = await service
      .from("meta_ads_connections")
      .select("available_ad_accounts")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) throw new MetaAdsApiError("Nenhuma conexão com o Meta Ads encontrada.", 404);

    const accounts = (data.available_ad_accounts ?? []) as { id: string; name: string }[];
    const match = accounts.find((a) => a.id === adAccountId);
    if (!match) throw new MetaAdsApiError("Essa conta não está na lista de contas disponíveis pra esse usuário.", 400);

    const { error: updErr } = await service
      .from("meta_ads_connections")
      .update({ ad_account_id: match.id, ad_account_name: match.name })
      .eq("user_id", user.id);
    if (updErr) throw new Error(updErr.message);

    return NextResponse.json({ ok: true, adAccountId: match.id, adAccountName: match.name });
  } catch (err) {
    const { body, status } = metaAdsErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
