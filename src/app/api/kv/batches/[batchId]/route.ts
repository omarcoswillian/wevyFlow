import { NextRequest, NextResponse } from "next/server";
import { launchErrorResponse, requireAuthUser } from "@/lib/launches/server";
import { listKvBatch } from "@/lib/launches/kv-assets";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const { batchId } = await params;
    const projectId = req.nextUrl.searchParams.get("projectId");

    // Reconciles any candidate stuck in 'generating' (dead request, killed
    // serverless function) before reading — otherwise a batch could show
    // 'running' forever even though nothing is actually still working on it.
    try {
      const { user } = await requireAuthUser();
      await createServiceClient().rpc("reap_stale_kv_generations", { p_user_id: user.id });
    } catch {
      // Best-effort — if auth fails here, listKvBatch below will surface
      // the real 401 anyway.
    }

    const batch = await listKvBatch(projectId, batchId);
    return NextResponse.json({ batch });
  } catch (err) {
    const { body, status } = launchErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
