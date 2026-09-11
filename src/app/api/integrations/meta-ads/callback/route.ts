import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import {
  requireAuthUser,
  getMetaAppCredentials,
  resolveAppOrigin,
  META_GRAPH_BASE,
  META_STATE_COOKIE,
} from "@/lib/meta-ads/server";

interface MetaTokenResponse { access_token: string; token_type?: string; expires_in?: number }
interface MetaMeResponse { id: string; name?: string }
interface MetaAdAccount { id: string; account_id?: string; name?: string }
interface MetaAdAccountsResponse { data: MetaAdAccount[] }
interface MetaErrorEnvelope { error?: { message?: string } }

async function metaFetch<T>(url: URL): Promise<T> {
  const res = await fetch(url);
  const json = (await res.json().catch(() => ({}))) as T & MetaErrorEnvelope;
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Meta respondeu ${res.status}`);
  }
  return json;
}

export async function GET(request: NextRequest) {
  const origin = resolveAppOrigin(request.url);
  const fail = (reason: string) => NextResponse.redirect(`${origin}/anuncios?meta_error=${encodeURIComponent(reason)}`);

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(META_STATE_COOKIE)?.value;
  cookieStore.delete(META_STATE_COOKIE);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error_message") || searchParams.get("error");

  if (oauthError) return fail("denied");
  if (!code || !state || !expectedState || state !== expectedState) return fail("invalid_state");

  let user;
  try {
    ({ user } = await requireAuthUser());
  } catch {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const { appId, appSecret } = getMetaAppCredentials();
    const redirectUri = `${origin}/api/integrations/meta-ads/callback`;

    // 1) code -> token de curta duração (mesmo redirect_uri usado em /connect)
    const shortLivedUrl = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
    shortLivedUrl.searchParams.set("client_id", appId);
    shortLivedUrl.searchParams.set("redirect_uri", redirectUri);
    shortLivedUrl.searchParams.set("client_secret", appSecret);
    shortLivedUrl.searchParams.set("code", code);
    const shortLived = await metaFetch<MetaTokenResponse>(shortLivedUrl);

    // 2) troca por token de longa duração (~60 dias) — sem isso o usuário
    // precisaria reconectar a cada 1-2h.
    const longLivedUrl = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
    longLivedUrl.searchParams.set("grant_type", "fb_exchange_token");
    longLivedUrl.searchParams.set("client_id", appId);
    longLivedUrl.searchParams.set("client_secret", appSecret);
    longLivedUrl.searchParams.set("fb_exchange_token", shortLived.access_token);
    const longLived = await metaFetch<MetaTokenResponse>(longLivedUrl);
    const accessToken = longLived.access_token;
    const expiresAt = longLived.expires_in ? new Date(Date.now() + longLived.expires_in * 1000).toISOString() : null;

    // 3) identidade + contas de anúncio que essa pessoa administra
    const meUrl = new URL(`${META_GRAPH_BASE}/me`);
    meUrl.searchParams.set("fields", "id,name");
    meUrl.searchParams.set("access_token", accessToken);
    const me = await metaFetch<MetaMeResponse>(meUrl);

    const adAccountsUrl = new URL(`${META_GRAPH_BASE}/me/adaccounts`);
    adAccountsUrl.searchParams.set("fields", "id,name,account_id");
    adAccountsUrl.searchParams.set("access_token", accessToken);
    const adAccounts = await metaFetch<MetaAdAccountsResponse>(adAccountsUrl);

    const accounts = (adAccounts.data ?? []).map((a) => ({ id: a.id, name: a.name || a.account_id || a.id }));
    const autoSelected = accounts.length === 1 ? accounts[0] : null;

    const service = createServiceClient();
    const { error: dbErr } = await service.from("meta_ads_connections").upsert({
      user_id: user.id,
      access_token: accessToken,
      token_expires_at: expiresAt,
      meta_user_id: me.id,
      meta_user_name: me.name ?? null,
      available_ad_accounts: accounts,
      ad_account_id: autoSelected?.id ?? null,
      ad_account_name: autoSelected?.name ?? null,
    }, { onConflict: "user_id" });
    if (dbErr) throw new Error(dbErr.message);

    const needsPicker = accounts.length > 1;
    return NextResponse.redirect(`${origin}/anuncios?meta_connected=1${needsPicker ? "&meta_pick_account=1" : ""}`);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "unknown");
  }
}
