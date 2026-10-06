import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuthUser, resolveAppOrigin } from "@/lib/meta-ads/server";
import { getGoogleCredentials, isYouTubeConfigured, GOOGLE_AUTH_URL, YT_OAUTH_SCOPES, YT_STATE_COOKIE } from "@/lib/youtube/server";

/** Começa "Conectar YouTube" (navegação de página inteira, não fetch). Todo erro
 * redireciona de volta pro app. */
export async function GET(request: NextRequest) {
  const origin = resolveAppOrigin(request.url);
  try {
    await requireAuthUser();
  } catch {
    return NextResponse.redirect(`${origin}/login`);
  }
  if (!isYouTubeConfigured()) return NextResponse.redirect(`${origin}/anuncios?plataforma=youtube&yt_error=not_configured`);

  try {
    const { clientId } = getGoogleCredentials();
    const state = crypto.randomUUID();
    (await cookies()).set(YT_STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });

    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", `${origin}/api/integrations/youtube/callback`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", YT_OAUTH_SCOPES);
    // offline + consent: garante o refresh token (sem ele a leitura morre em 1h).
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return NextResponse.redirect(url.toString());
  } catch {
    return NextResponse.redirect(`${origin}/anuncios?plataforma=youtube&yt_error=unknown`);
  }
}
