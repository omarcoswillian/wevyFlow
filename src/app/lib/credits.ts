"use server";

import { createClient } from "@/lib/supabase/server";
import { PLANS, DEFAULT_PLAN, type PlanId } from "./plans";

export type GenType =
  | "landing_page"
  | "brand_identity"
  | "email_sequence"
  | "criativo_html"
  | "other";

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

export async function checkAndDeductCredit(
  genType: GenType,
  promptSnippet = ""
): Promise<CreditCheckResult> {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: "Faça login para continuar.", status: 401 };
  }

  // Resolve plan — maybeSingle() never throws on missing row
  let planId: PlanId = DEFAULT_PLAN;
  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.plan && profile.plan in PLANS) {
      planId = profile.plan as PlanId;
    }
  } catch { /* default plan */ }

  const plan = PLANS[planId];
  const limit = plan.credits;

  // Atomic claim via Postgres advisory lock — eliminates race condition
  const { data: claim, error: rpcError } = await supabase.rpc(
    "claim_generation_credit",
    {
      p_user_id: user.id,
      p_gen_type: genType,
      p_prompt: promptSnippet.slice(0, 500),
      p_limit: limit,
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
      planLabel: plan.label,
      used: claim.used as number,
      limit: claim.limit as number,
    };
  }

  return {
    allowed: true,
    generationId: claim.generation_id as string,
    userId: user.id,
    plan: planId,
    planLabel: plan.label,
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
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("finalize_generation", {
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
      error: `Você atingiu seu limite mensal de ${result.limit} gerações (Plano ${result.planLabel}). Faça upgrade para continuar criando.`,
      limitReached: true,
      plan: result.plan,
      planLabel: result.planLabel,
      used: result.used,
      limit: result.limit,
    },
    { status: 429 }
  );
}
