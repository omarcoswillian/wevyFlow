import { NextRequest, NextResponse } from "next/server";
import { launchErrorResponse } from "@/lib/launches/server";
import { listKvAssetsForLaunch } from "@/lib/launches/kv-assets";

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    const assets = await listKvAssetsForLaunch(projectId);
    return NextResponse.json({ assets });
  } catch (err) {
    const { body, status } = launchErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
