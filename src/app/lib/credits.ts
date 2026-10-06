import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PLANS, DEFAULT_PLAN, type PlanId } from "./plans";

export type GenType =
  | "landing_page"
  | "brand_identity"
  | "email_sequence"
  | "criativo_html"
  | "image"
  | "design"
  | "design_swap"
  | "ad_analysis"
  | "ad_analysis_video"
  | "ensaio"
  | "logo"
  | "kv_batch"
  | "other";

// Weight per action, in credits — reflects real API cost, not "1 generation
// = 1 credit". Calibrated against Google's published per-image pricing:
// Nano Banana (gemini-2.5-flash-image) ~$0.039/image, Nano Banana Pro
// (gemini-3-pro-image-preview) ~$0.134-0.24/image, vs a plain text/HTML
// generation at a few cents. Tune here only — callers don't need to know
// the weight, it's resolved from the action's GenType.
const ACTION_COST: Record<GenType, number> = {
  landing_page: 1,
  brand_identity: 1,
  email_sequence: 1,
  criativo_html: 3, // creative/ad image — openai/fal/gemini, mid-tier cost
  image: 3,         // generic image gen — same tier as criativo
  logo: 4,          // defaults to gpt-image-2 (high quality)
  kv_batch: 4,      // same per-image tier as logo — one KV batch candidate
  // Imagem de design (Nano Banana Pro). O custo real é ~US$0,13-0,24 por
  // imagem; uma peça simples (geração/adaptação de referência) pesa 2, e a
  // troca de pessoa pesa 4 porque faz 3 chamadas de visão extras. Antes tudo
  // custava 6, o que tornava um criativo inviável nos planos menores.
  ad_analysis: 1,       // análise por IA de um criativo em imagem (visão, saída curta)
  ad_analysis_video: 2, // vídeo: mais tokens de entrada (~100-300 tokens/s)
  design: 2,
  design_swap: 4,
  ensaio: 6,        // legado — mantido pra histórico de gerações antigas
  other: 1,
};

export interface CreditResult {
  allowed: true;
  generationId: string;
  userId: string;
  plan: PlanId;
  planLabel: string;
  used: number;
  limit: number;
  remaining: number;
}

export interface CreditBlocked {
  allowed: false;
  userId: string;
  plan: PlanId;
  planLabel: string;
  used: number;
  limit: number;
}

export interface CreditError {
  error: string;
  status: number;
}

export type CreditCheckResult = CreditResult | CreditBlocked | CreditError;

export function isCreditError(r: CreditCheckResult): r is CreditError {
  return "error" in r;
}

/** Resolves a user's plan + monthly credit limit from user_profiles —
 * extracted from checkAndDeductCredit so the KV batch flow (which reserves
 * credits via its own dedicated, server-only RPCs, not this function's
 * single-claim RPC) can trust the same server-resolved limit instead of
 * duplicating this lookup or trusting a client-supplied one. */
export async function resolvePlanLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ planId: PlanId; planLabel: string; limit: number }> {
  let planId: PlanId = DEFAULT_PLAN;
  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("plan")
      .eq("user_id", userId)
      .maybeSingle();
    if (profile?.plan && profile.plan in PLANS) {
      planId = profile.plan as PlanId;
    }
  } catch { /* default plan */ }

  const plan = PLANS[planId];
  return { planId, planLabel: plan.label, limit: plan.credits };
}

export function actionCost(genType: GenType): number {
  return ACTION_COST[genType] ?? 1;
}

export async function checkAndDeductCredit(
  genType: GenType,
  promptSnippet = ""
): Promise<CreditCheckResult> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "Faça login para continuar.", status: 401 };
  }

  // Local dev only — unlimited generations for the fixed dev account (see
  // /api/dev/auto-signin) so testing batches of creatives isn't gated by
  // the real monthly plan quota. Never runs in production.
  if (process.env.NODE_ENV === "development") {
    return {
      allowed: true,
      generationId: "dev-bypass",
      userId: user.id,
      plan: "scale",
      planLabel: "Dev (sem limite)",
      used: 0,
      limit: Infinity,
      remaining: Infinity,
    };
  }

  const { planId, planLabel, limit } = await resolvePlanLimit(supabase, user.id);
  const cost = ACTION_COST[genType] ?? 1;

  // claim_generation_credit is server-only now (revoked from
  // authenticated/anon — see 20260909000001_kv_batch_generation.sql) so a
  // client can no longer call it directly with a forged p_user_id/p_limit
  // to lock another user's credit balance. Identity (user.id) and limit
  // are already resolved above from the real authenticated session, so
  // trusting them as RPC params here is safe — nothing this function
  // hasn't already independently verified reaches the RPC.
  const service = createServiceClient();

  // Atomic claim via Postgres advisory lock — eliminates race condition
  const { data: claim, error: rpcError } = await service.rpc(
    "claim_generation_credit",
    {
      p_user_id: user.id,
      p_gen_type: genType,
      p_prompt: promptSnippet.slice(0, 500),
      p_limit: limit,
      p_cost: cost,
    }
  );

  if (rpcError || !claim) {
    console.error("[credits] claim_generation_credit failed:", rpcError);
    return { error: "Erro ao verificar créditos. Tente novamente.", status: 500 };
  }

  if (!claim.allowed) {
    return {
      allowed: false,
      userId: user.id,
      plan: planId,
      planLabel,
      used: claim.used as number,
      limit: claim.limit as number,
    };
  }

  return {
    allowed: true,
    generationId: claim.generation_id as string,
    userId: user.id,
    plan: planId,
    planLabel,
    used: claim.used as number,
    limit: claim.limit as number,
    remaining: (claim.limit as number) - (claim.used as number),
  };
}

/**
 * Confirms a generation as successful (status = 'success') or refunds the
 * credit (status = 'failed_refunded'). Call this after every AI call attempt.
 * Failures here are logged but never surfaced to the user.
 */
export async function finalizeGeneration(
  generationId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  if (generationId === "dev-bypass") return; // no real credit row to finalize
  try {
    // Also server-only now — see the note in checkAndDeductCredit above.
    const service = createServiceClient();
    const { error } = await service.rpc("finalize_generation", {
      p_id: generationId,
      p_success: success,
      p_error: errorMessage ?? null,
    });
    if (error) {
      console.error("[credits] finalize_generation RPC failed:", error);
    }
  } catch (e) {
    console.error("[credits] finalizeGeneration threw:", e);
  }
}

export function limitReachedResponse(result: CreditBlocked): Response {
  return Response.json(
    {
      error: `Você atingiu seu limite mensal de ${result.limit} créditos (Plano ${result.planLabel}). Faça upgrade para continuar criando.`,
      limitReached: true,
      plan: result.plan,
      planLabel: result.planLabel,
      used: result.used,
      limit: result.limit,
    },
    { status: 429 }
  );
}
