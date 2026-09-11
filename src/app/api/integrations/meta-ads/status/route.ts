import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuthUser, isMetaAdsConfigured, metaAdsErrorResponse } from "@/lib/meta-ads/server";

export async function GET() {
  try {
    const { user } = await requireAuthUser();

    if (!isMetaAdsConfigured()) {
      return NextResponse.json({ configured: false, connected: false });
    }

    const service = createServiceClient();
    const { data } = await service
      .from("meta_ads_connections")
      .select("meta_user_name, ad_account_id, ad_account_name, available_ad_accounts, token_expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data) return NextResponse.json({ configured: true, connected: false });

    const availableAdAccounts = (data.available_ad_accounts ?? []) as { id: string; name: string }[];
    return NextResponse.json({
      configured: true,
      connected: true,
      metaUserName: data.meta_user_name,
      adAccountId: data.ad_account_id,
      adAccountName: data.ad_account_name,
      availableAdAccounts,
      needsAccountPick: !data.ad_account_id && availableAdAccounts.length > 1,
      tokenExpiresAt: data.token_expires_at,
    });
  } catch (err) {
    const { body, status } = metaAdsErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
