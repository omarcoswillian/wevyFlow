import type { Database } from "@/lib/supabase/types";
import type { LaunchAsset } from "@/app/lib/types-kit";
import { getLaunchByProjectId, requireAuthUser, isUuid, LaunchApiError } from "./server";

type LaunchAssetRow = Database["public"]["Tables"]["launch_assets"]["Row"];

export type KvBatchAggregateStatus = "running" | "completed" | "partial" | "failed";

export interface KvBatch {
  batchId: string;
  launchKitId: string;
  status: KvBatchAggregateStatus;
  candidates: LaunchAsset[];
}

function rowToLaunchAsset(row: LaunchAssetRow, publicUrl: (bucket: string, path: string) => string): LaunchAsset {
  return {
    id: row.id,
    launchKitId: row.launch_kit_id,
    assetType: row.asset_type,
    batchId: row.batch_id,
    position: row.position,
    status: row.status,
    url:
      row.status === "done" && row.storage_bucket && row.storage_path
        ? publicUrl(row.storage_bucket, row.storage_path)
        : undefined,
    mimeType: row.mime_type ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    variant: row.variant ?? undefined,
    variationKey: row.variation_key ?? undefined,
    candidateId: row.candidate_id ?? undefined,
    pieceKey: row.piece_key ?? undefined,
    assetRole: row.asset_role ?? undefined,
    producer: row.producer ?? undefined,
    errorCode: row.error_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
    selectedAt: row.selected_at ?? undefined,
    createdAt: row.created_at,
  };
}

function aggregateStatus(candidates: LaunchAsset[]): KvBatchAggregateStatus {
  if (candidates.length === 0) return "failed";
  if (candidates.some((c) => c.status === "pending" || c.status === "generating")) return "running";
  const doneCount = candidates.filter((c) => c.status === "done").length;
  const errorCount = candidates.filter((c) => c.status === "error").length;
  if (doneCount > 0 && errorCount > 0) return "partial";
  if (doneCount > 0) return "completed";
  return "failed";
}

/** Lists every candidate of one KV batch, scoped to the caller's own launch.
 * Uses ownership-only resolution (not requireLaunch's active-launch gate) —
 * reading candidates already persisted shouldn't 409 just because the launch
 * was archived meanwhile (Codex review finding). A batchId from another
 * launch/user comes back as "not found", never leaked. */
export async function listKvBatch(projectId: unknown, batchId: unknown): Promise<KvBatch> {
  if (typeof projectId !== "string") throw new LaunchApiError("projectId inválido.", 400);
  const launch = await getLaunchByProjectId(projectId);
  if (typeof batchId !== "string" || !isUuid(batchId)) {
    throw new LaunchApiError("batchId inválido.", 400);
  }

  const { supabase } = await requireAuthUser();
  const { data, error } = await supabase
    .from("launch_assets")
    .select("*")
    .eq("launch_kit_id", launch.id)
    .eq("batch_id", batchId)
    .eq("asset_type", "kv")
    .order("position", { ascending: true });

  if (error) throw new LaunchApiError(error.message, 500);
  if (!data || data.length === 0) throw new LaunchApiError("Lote de KV não encontrado.", 404);

  const publicUrl = (bucket: string, path: string) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  const candidates = data.map((row) => rowToLaunchAsset(row, publicUrl));

  return {
    batchId,
    launchKitId: launch.id,
    status: aggregateStatus(candidates),
    candidates,
  };
}

/** Lists every KV candidate ever generated for this launch (any batch, any
 * status), newest first — backs the "Gerados" tab. Ownership-only
 * resolution, same as listKvBatch: an archived launch can still show its
 * past candidates. */
export async function listKvAssetsForLaunch(projectId: unknown): Promise<LaunchAsset[]> {
  if (typeof projectId !== "string") throw new LaunchApiError("projectId inválido.", 400);
  const launch = await getLaunchByProjectId(projectId);

  const { supabase } = await requireAuthUser();
  const { data, error } = await supabase
    .from("launch_assets")
    .select("*")
    .eq("launch_kit_id", launch.id)
    .eq("asset_type", "kv")
    .order("created_at", { ascending: false });

  if (error) throw new LaunchApiError(error.message, 500);

  const publicUrl = (bucket: string, path: string) => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return (data ?? []).map((row) => rowToLaunchAsset(row, publicUrl));
}

export interface KvSelectionResult {
  launchKitId: string;
  projectId: string;
  selectedKvAssetId: string;
  selectedKvCandidateId: string | null;
}

/** Approves one candidate as the launch's official KV via the select_launch_kv
 * RPC — never a plain UPDATE, since the ownership/status/type invariants live
 * server-side in that function (and again in a launch_kits trigger). Uses the
 * same ownership-only resolution as listKvBatch (not requireLaunch) so both
 * entry points agree on whether an archived launch can still pick a KV. */
export async function selectKvAsset(projectId: unknown, assetId: unknown): Promise<KvSelectionResult> {
  if (typeof projectId !== "string") throw new LaunchApiError("projectId inválido.", 400);
  const launch = await getLaunchByProjectId(projectId);
  if (typeof assetId !== "string" || !isUuid(assetId)) {
    throw new LaunchApiError("assetId inválido.", 400);
  }

  const { supabase } = await requireAuthUser();
  const { data, error } = await supabase.rpc("select_launch_kv", {
    p_project_id: launch.projectId,
    p_asset_id: assetId,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("not_found")) throw new LaunchApiError("Lançamento ou candidato não encontrado.", 404);
    if (msg.includes("asset_not_kv")) throw new LaunchApiError("Este ativo não é um candidato de KV.", 409);
    if (msg.includes("asset_not_ready")) throw new LaunchApiError("Este candidato ainda não está pronto para ser escolhido.", 409);
    if (msg.includes("asset_belongs_to_other_launch")) throw new LaunchApiError("Este candidato pertence a outro lançamento.", 409);
    if (msg.includes("not_authenticated")) throw new LaunchApiError("Faça login para continuar.", 401);
    throw new LaunchApiError(msg || "Falha ao selecionar o KV.", 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.out_selected_kv_asset_id) throw new LaunchApiError("Falha ao selecionar o KV.", 500);

  return {
    launchKitId: row.out_launch_kit_id,
    projectId: row.out_project_id,
    selectedKvAssetId: row.out_selected_kv_asset_id,
    selectedKvCandidateId: row.out_selected_kv_candidate_id ?? null,
  };
}
