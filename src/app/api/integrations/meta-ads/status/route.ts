import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptToken } from "@/lib/meta-ads/crypto";
import { requireAuthUser, isMetaAdsConfigured, metaAdsErrorResponse, META_GRAPH_BASE } from "@/lib/meta-ads/server";

/** Foto do perfil pra conexões criadas antes de a callback guardá-la.
 * Best-effort: qualquer falha só deixa a foto vazia (a UI mostra a inicial). */
async function fetchPicture(accessToken: string): Promise<string | null> {
  try {
    const url = new URL(`${META_GRAPH_BASE}/me`);
    url.searchParams.set("fields", "picture.type(large)");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const json = (await res.json()) as { picture?: { data?: { url?: string } } };
    return json.picture?.data?.url ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const { user } = await requireAuthUser();

    if (!isMetaAdsConfigured()) {
      return NextResponse.json({ configured: false, connected: false });
    }

    const service = createServiceClient();
    const { data } = await service
      .from("meta_ads_connections")
      .select("access_token, meta_user_name, meta_user_picture_url, ad_account_id, ad_account_name, available_ad_accounts, token_expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data) return NextResponse.json({ configured: true, connected: false });

    let picture = data.meta_user_picture_url;
    if (!picture) {
      try {
        picture = await fetchPicture(decryptToken(data.access_token, user.id));
        if (picture) await service.from("meta_ads_connections").update({ meta_user_picture_url: picture }).eq("user_id", user.id);
      } catch { /* sem foto, segue */ }
    }

    const availableAdAccounts = (data.available_ad_accounts ?? []) as { id: string; name: string }[];
    return NextResponse.json({
      configured: true,
      connected: true,
      metaUserName: data.meta_user_name,
      metaUserPicture: picture,
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
