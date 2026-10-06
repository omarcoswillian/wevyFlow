import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAuthUser, metaAdsErrorResponse } from "@/lib/meta-ads/server";
import { isYouTubeConfigured } from "@/lib/youtube/server";

export async function GET() {
  try {
    const { user } = await requireAuthUser();
    if (!isYouTubeConfigured()) return NextResponse.json({ configured: false, connected: false });

    const { data } = await createServiceClient()
      .from("youtube_connections")
      .select("channel_title, channel_picture_url, last_synced_at, ctr_available")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) return NextResponse.json({ configured: true, connected: false });
    return NextResponse.json({
      configured: true,
      connected: true,
      channelTitle: data.channel_title,
      channelPicture: data.channel_picture_url,
      lastSyncedAt: data.last_synced_at,
      ctrAvailable: data.ctr_available,
    });
  } catch (err) {
    const { body, status } = metaAdsErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
