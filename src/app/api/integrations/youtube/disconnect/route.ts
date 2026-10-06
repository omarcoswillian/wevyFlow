import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptToken } from "@/lib/meta-ads/crypto";
import { requireAuthUser } from "@/lib/meta-ads/server";
import { deleteAdMedia } from "@/lib/ads/media";
import { GOOGLE_REVOKE_URL, youtubeErrorResponse } from "@/lib/youtube/server";

export async function POST() {
  try {
    const { user } = await requireAuthUser();
    const service = createServiceClient();
    const { data } = await service.from("youtube_connections").select("refresh_token").eq("user_id", user.id).maybeSingle();

    // Os dados do usuário saem primeiro e definem o sucesso.
    const steps = [
      service.from("youtube_video_metrics").delete().eq("user_id", user.id),
      service.from("youtube_videos").delete().eq("user_id", user.id),
      service.from("ad_creative_analyses").delete().eq("user_id", user.id).like("ad_external_id", "yt:%"),
      service.from("youtube_connections").delete().eq("user_id", user.id),
    ];
    for (const step of steps) {
      const { error } = await step;
      if (error) throw new Error(error.message);
    }
    try { await deleteAdMedia(service, user.id, "yt"); } catch (e) { console.error("[youtube] falha ao apagar mídia:", e); }

    // Revogar no Google é best-effort.
    let revoked = false;
    if (data) {
      try {
        const res = await fetch(GOOGLE_REVOKE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: decryptToken(data.refresh_token, user.id) }),
        });
        revoked = res.ok;
      } catch { /* best-effort */ }
    }
    return NextResponse.json({ ok: true, revoked });
  } catch (err) {
    const { body, status } = youtubeErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
