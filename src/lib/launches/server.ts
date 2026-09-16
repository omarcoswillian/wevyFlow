import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { isBriefingActivatable, isValidStrategyId, toBrandInfo } from "@/app/lib/launch-briefing";
import type { LaunchBriefing } from "@/app/lib/launch-briefing";
import type { BrandIdentity, LaunchKit, LaunchStatus, StrategyId } from "@/app/lib/types-kit";

/** Machine-readable next step for the UI to link to directly, alongside the
 * human-readable message — added so a 409 body isn't just a dead end (see
 * launches review item 9). */
export type LaunchErrorAction = "create_launch" | "complete_briefing";

export class LaunchApiError extends Error {
  status: number;
  code?: string;
  action?: LaunchErrorAction;
  constructor(message: string, status: number, code?: string, action?: LaunchErrorAction) {
    super(message);
    this.status = status;
    this.code = code;
    this.action = action;
  }
}

type LaunchKitRow = Database["public"]["Tables"]["launch_kits"]["Row"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

function rowToLaunchKit(row: LaunchKitRow): LaunchKit {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    strategyId: (row.strategy_id as StrategyId | null) ?? null,
    briefing: row.briefing as unknown as LaunchBriefing,
    brandInfo: row.brand_info as unknown as LaunchKit["brandInfo"],
    brandIdentity: (row.brand_identity as unknown as LaunchKit["brandIdentity"]) ?? undefined,
    selectedKvAssetId: row.selected_kv_asset_id ?? null,
    selectedKvCandidateId: row.selected_kv_candidate_id ?? null,
    assets: (row.assets as LaunchKit["assets"]) ?? [],
    emailSequences: row.email_sequences as unknown as LaunchKit["emailSequences"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function requireAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new LaunchApiError("Faça login para continuar.", 401);
  return { supabase, user };
}

export async function listLaunches(): Promise<LaunchKit[]> {
  const { supabase } = await requireAuthUser();
  const { data, error } = await supabase
    .from("launch_kits")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new LaunchApiError(error.message, 500);
  return (data ?? []).map(rowToLaunchKit);
}

export async function getLaunchByProjectId(projectId: string): Promise<LaunchKit> {
  const { supabase, user } = await requireAuthUser();
  if (!isUuid(projectId)) throw new LaunchApiError("ID de lançamento inválido.", 400);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw new LaunchApiError(projectError.message, 500);
  if (!project || project.user_id !== user.id) {
    throw new LaunchApiError("Lançamento não encontrado.", 404);
  }

  const { data: kit, error: kitError } = await supabase
    .from("launch_kits")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (kitError) throw new LaunchApiError(kitError.message, 500);
  if (!kit) throw new LaunchApiError("Lançamento não encontrado.", 404);

  return rowToLaunchKit(kit);
}

export interface SaveLaunchInput {
  projectId?: string | null;
  clientToken?: string | null;
  briefing: LaunchBriefing;
  strategyId?: StrategyId | null;
  /** Omit on update to leave the current status untouched (e.g. preserve
   * 'archived' instead of the caller having to know/guess it — see review
   * item 9). Required when creating (projectId is null). */
  status?: LaunchStatus;
  brandKitId?: string | null;
  assets?: LaunchKit["assets"] | null;
  brandIdentity?: LaunchKit["brandIdentity"] | null;
  emailSequences?: LaunchKit["emailSequences"] | null;
  /** Explicitly clear strategyId/brandIdentity to null. Needed because the
   * RPC's `coalesce(p_x, x)` update pattern otherwise can't distinguish
   * "field omitted, don't touch it" from "field explicitly sent as null,
   * clear it" — both arrive as SQL null (see review item 9). */
  clearStrategy?: boolean;
  clearBrandIdentity?: boolean;
  /** Same omitted-vs-null distinction, extended to brandKitId (review item J) —
   * without this, `coalesce(p_brand_kit_id, brand_kit_id)` in the RPC makes an
   * explicit `brandKitId: null` indistinguishable from "not sent". */
  clearBrandKitId?: boolean;
}

/** Creates or updates the (projects, launch_kits) pair atomically via the
 * save_launch Postgres function — never two sequential JS inserts. */
export async function saveLaunch(input: SaveLaunchInput): Promise<LaunchKit> {
  const { supabase } = await requireAuthUser();

  if (input.projectId != null && !isUuid(input.projectId)) {
    throw new LaunchApiError("projectId inválido.", 400);
  }

  if (input.projectId == null && !input.status) {
    throw new LaunchApiError("status é obrigatório ao criar um lançamento.", 400);
  }

  if (input.strategyId != null && !input.clearStrategy && !isValidStrategyId(input.strategyId)) {
    throw new LaunchApiError("Estratégia de lançamento inválida.", 400);
  }

  if (input.status === "active" && !isBriefingActivatable(input.briefing, input.strategyId)) {
    throw new LaunchApiError(
      "Preencha produto, nicho, público-alvo e transformação, e escolha uma estratégia antes de ativar o lançamento.",
      409,
      "LAUNCH_BRIEFING_REQUIRED",
      "complete_briefing"
    );
  }

  const brandInfo = toBrandInfo(input.briefing);

  const { data, error } = await supabase.rpc("save_launch", {
    p_project_id: input.projectId ?? null,
    p_client_token: input.clientToken ?? null,
    p_briefing: input.briefing as unknown as Record<string, unknown>,
    p_brand_info: brandInfo as unknown as Record<string, unknown>,
    p_strategy_id: input.clearStrategy ? null : (input.strategyId ?? null),
    p_status: input.status ?? null,
    p_brand_kit_id: input.clearBrandKitId ? null : (input.brandKitId ?? null),
    p_assets: input.assets ?? null,
    p_brand_identity: input.clearBrandIdentity ? null : ((input.brandIdentity as unknown as Record<string, unknown>) ?? null),
    p_email_sequences: (input.emailSequences as unknown as Record<string, unknown>) ?? null,
    p_clear_strategy: input.clearStrategy ?? false,
    p_clear_brand_identity: input.clearBrandIdentity ?? false,
    p_clear_brand_kit_id: input.clearBrandKitId ?? false,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("briefing_incomplete") || error.code === "23514") {
      // 23514 = Postgres check_violation — covers launch_kits_active_requires_briefing
      // firing on an update that clears strategy_id while status stays 'active'
      // (e.g. clearStrategy without also changing status away from active).
      throw new LaunchApiError("Briefing incompleto para ativar o lançamento.", 409, "LAUNCH_BRIEFING_REQUIRED", "complete_briefing");
    }
    if (msg.includes("not_found")) {
      throw new LaunchApiError("Lançamento não encontrado.", 404);
    }
    if (msg.includes("client_token_required")) {
      throw new LaunchApiError("Falha ao salvar rascunho (token ausente). Tente novamente.", 400);
    }
    if (msg.includes("status_required_on_create")) {
      throw new LaunchApiError("status é obrigatório ao criar um lançamento.", 400);
    }
    if (msg.includes("not_authenticated")) {
      throw new LaunchApiError("Faça login para continuar.", 401);
    }
    throw new LaunchApiError(msg || "Falha ao salvar lançamento.", 500);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.out_project_id) throw new LaunchApiError("Falha ao salvar lançamento.", 500);

  return getLaunchByProjectId(row.out_project_id);
}

/** Deletes only the launch_kits row for this project — never the project or
 * its pages. A project left without a kit simply stops authorizing
 * generation (see requireLaunch). */
export async function deleteLaunch(projectId: string): Promise<void> {
  const { supabase, user } = await requireAuthUser();
  if (!isUuid(projectId)) throw new LaunchApiError("projectId inválido.", 400);

  const { error } = await supabase
    .from("launch_kits")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", user.id);
  if (error) throw new LaunchApiError(error.message, 500);
}

/* ── requireLaunch — gate applied to generation API routes ──────────────
 * Deliberately does NOT accept brandInfo/brandContext/user_id from the
 * client as proof of a valid launch — only a projectId the caller owns,
 * resolved fresh against the database on every call. */

export interface RequiredLaunch {
  projectId: string;
  launchKitId: string;
  briefing: LaunchBriefing;
  brandInfo: LaunchKit["brandInfo"];
  brandIdentity: LaunchKit["brandIdentity"];
  strategyId: StrategyId | null;
}

export async function requireLaunch(projectId: unknown): Promise<RequiredLaunch> {
  const { supabase, user } = await requireAuthUser();

  if (typeof projectId !== "string" || !projectId.trim()) {
    throw new LaunchApiError(
      "Este recurso exige um lançamento ativo. Envie projectId.",
      409,
      "LAUNCH_REQUIRED",
      "create_launch"
    );
  }
  if (!isUuid(projectId)) {
    throw new LaunchApiError("projectId inválido.", 400);
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) throw new LaunchApiError(projectError.message, 500);
  if (!project || project.user_id !== user.id) {
    throw new LaunchApiError("Lançamento não encontrado.", 404);
  }

  const { data: kit, error: kitError } = await supabase
    .from("launch_kits")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (kitError) throw new LaunchApiError(kitError.message, 500);
  if (!kit || kit.user_id !== user.id) {
    throw new LaunchApiError("Lançamento não encontrado.", 404);
  }

  const briefing = kit.briefing as unknown as LaunchBriefing;
  const strategyId = (kit.strategy_id as StrategyId | null) ?? null;

  if (kit.status !== "active" || !isBriefingActivatable(briefing, strategyId)) {
    throw new LaunchApiError(
      "Este lançamento ainda não está pronto para gerar — complete o briefing e a estratégia.",
      409,
      "LAUNCH_BRIEFING_REQUIRED",
      "complete_briefing"
    );
  }

  return {
    projectId,
    launchKitId: kit.id,
    briefing,
    brandInfo: kit.brand_info as unknown as LaunchKit["brandInfo"],
    brandIdentity: (kit.brand_identity as unknown as LaunchKit["brandIdentity"]) ?? undefined,
    strategyId,
  };
}

/* ── Single source of truth for a launch's visual style ─────────────────
 * Every generator (landing page, criativo, copy) that used to receive raw
 * primaryColor/secondaryColor/fontChoice from the client — or duplicate
 * this exact fallback chain client-side (see LaunchHub.tsx buildIdentityBlock
 * / buildAssetPrompt before this) — should resolve style through here
 * instead. Approved brand identity (5-color palette, 2 fonts, logo, concept)
 * wins when it exists; the briefing's basic style choice (set once in the
 * launch wizard) is the fallback. Mirrors the resolution LaunchHub already
 * did in the browser, moved server-side so new callers inherit it for free
 * instead of having to reimplement it. */
export interface LaunchStyle {
  primaryColor: string;
  secondaryColor: string;
  fontChoice: string;
  stylePreset: string;
  /** Prompt-ready block with the full approved identity (accent/light/dark
   * colors, body font, logo, concept, personality words) — empty string when
   * there's no approved identity yet, since colors/fontChoice/stylePreset
   * above already cover the briefing-only case. */
  identityBlock: string;
}

export function resolveLaunchStyle(launch: RequiredLaunch): LaunchStyle {
  const identity: BrandIdentity | null =
    launch.brandIdentity?.status === "approved" ? launch.brandIdentity : null;

  const primary = identity?.colors.find((c) => c.usage === "primary");
  const secondary = identity?.colors.find((c) => c.usage === "secondary");
  const accent = identity?.colors.find((c) => c.usage === "accent");
  const light = identity?.colors.find((c) => c.usage === "light");
  const dark = identity?.colors.find((c) => c.usage === "dark");
  const displayFont = identity?.fonts.find((f) => f.usage === "display");
  const bodyFont = identity?.fonts.find((f) => f.usage === "body");

  const identityBlock = identity
    ? [
        "IDENTIDADE VISUAL APROVADA (use fielmente):",
        accent ? `Cor de destaque/CTA: ${accent.hex} (${accent.name})` : "",
        light ? `Cor clara/fundo light: ${light.hex}` : "",
        dark ? `Cor escura/texto: ${dark.hex}` : "",
        bodyFont ? `Fonte de corpo: ${bodyFont.name}` : "",
        identity.concept ? `Conceito da marca: ${identity.concept}` : "",
        identity.words.length ? `Palavras-chave da marca: ${identity.words.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  return {
    primaryColor: primary?.hex ?? launch.brandInfo.primaryColor,
    secondaryColor: secondary?.hex ?? launch.brandInfo.secondaryColor,
    fontChoice: displayFont?.name ?? launch.brandInfo.fontChoice,
    stylePreset: launch.brandInfo.stylePreset,
    identityBlock,
  };
}

export function launchErrorResponse(err: unknown): {
  body: { error: string; code?: string; action?: LaunchErrorAction };
  status: number;
} {
  if (err instanceof LaunchApiError) {
    return { body: { error: err.message, code: err.code, action: err.action }, status: err.status };
  }
  const message = err instanceof Error ? err.message : "Erro desconhecido.";
  return { body: { error: message }, status: 500 };
}
