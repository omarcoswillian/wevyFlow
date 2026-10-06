import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/service";
import { encryptToken } from "@/lib/meta-ads/crypto";
import { requireAuthUser, resolveAppOrigin } from "@/lib/meta-ads/server";
import { getGoogleCredentials, GOOGLE_TOKEN_URL, YT_STATE_COOKIE } from "@/lib/youtube/server";
import { fetchChannel } from "@/lib/youtube/sync";

export async function GET(request: NextRequest) {
  const origin = resolveAppOrigin(request.url);
  const fail = (reason: string) => NextResponse.redirect(`${origin}/anuncios?plataforma=youtube&yt_error=${encodeURIComponent(reason)}`);

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(YT_STATE_COOKIE)?.value;
  cookieStore.delete(YT_STATE_COOKIE);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (searchParams.get("error")) return fail("denied");
  if (!code || !state || !expectedState || state !== expectedState) return fail("invalid_state");

  let user;
  try {
    ({ user } = await requireAuthUser());
  } catch {
    return NextResponse.redirect(`${origin}/login`);
  }

  try {
    const { clientId, clientSecret } = getGoogleCredentials();
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: `${origin}/api/integrations/youtube/callback`, grant_type: "authorization_code",
      }),
    });
    const tokens = (await tokenRes.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; scope?: string };
    if (!tokenRes.ok || !tokens.access_token) return fail("token_exchange");
    if (!tokens.refresh_token) return fail("no_refresh_token");
    // O usuário pode desmarcar permissões na tela do Google: sem ler o canal e o Analytics, não funciona.
    const granted = tokens.scope ?? "";
    if (!granted.includes("youtube.readonly") || !granted.includes("yt-analytics.readonly")) return fail("missing_scopes");

    const channel = await fetchChannel(tokens.access_token);
    const service = createServiceClient();

    // Reconectar com OUTRO canal: os vídeos e as métricas do canal anterior não podem sobrar.
    const { data: previous } = await service.from("youtube_connections").select("channel_id").eq("user_id", user.id).maybeSingle();
    if (previous && previous.channel_id !== channel.id) {
      await service.from("youtube_video_metrics").delete().eq("user_id", user.id);
      await service.from("youtube_videos").delete().eq("user_id", user.id);
      await service.from("ad_creative_analyses").delete().eq("user_id", user.id).like("ad_external_id", "yt:%");
    }

    const { error } = await service.from("youtube_connections").upsert({
      user_id: user.id,
      refresh_token: encryptToken(tokens.refresh_token, user.id),
      channel_id: channel.id,
      channel_title: channel.title,
      channel_picture_url: channel.pictureUrl,
      uploads_playlist_id: channel.uploadsPlaylistId,
      last_synced_at: null,
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    return NextResponse.redirect(`${origin}/anuncios?plataforma=youtube&yt_connected=1`);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "unknown");
  }
}
