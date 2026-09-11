import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  requireAuthUser,
  isMetaAdsConfigured,
  getMetaAppCredentials,
  resolveAppOrigin,
  META_OAUTH_DIALOG_URL,
  META_OAUTH_SCOPE,
  META_STATE_COOKIE,
} from "@/lib/meta-ads/server";

/** Starts the "Conectar Meta Ads" flow — hit via a full-page browser
 * navigation (a plain link/button click, not fetch), so every error path
 * here redirects back into the app instead of returning JSON. */
export async function GET(request: NextRequest) {
  const origin = resolveAppOrigin(request.url);

  try {
    await requireAuthUser();
  } catch {
    return NextResponse.redirect(`${origin}/login`);
  }

  if (!isMetaAdsConfigured()) {
    return NextResponse.redirect(`${origin}/anuncios?meta_error=not_configured`);
  }

  try {
    const { appId } = getMetaAppCredentials();
    const redirectUri = `${origin}/api/integrations/meta-ads/callback`;
    // Anti-CSRF: um cookie httpOnly de curta duração, comparado no callback
    // — sem isso, um atacante poderia induzir a vítima a completar o OAuth
    // dele e vincular a própria conta de anúncio do atacante à conta
    // WevyFlow da vítima.
    const state = crypto.randomUUID();
    const cookieStore = await cookies();
    cookieStore.set(META_STATE_COOKIE, state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });

    const authUrl = new URL(META_OAUTH_DIALOG_URL);
    authUrl.searchParams.set("client_id", appId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("scope", META_OAUTH_SCOPE);
    authUrl.searchParams.set("response_type", "code");

    return NextResponse.redirect(authUrl.toString());
  } catch {
    return NextResponse.redirect(`${origin}/anuncios?meta_error=unknown`);
  }
}
