import { createClient } from "@/lib/supabase/server";
import { PLANS, DEFAULT_PLAN, type PlanId } from "./plans";

export type GenType =
  | "landing_page"
  | "brand_identity"
  | "email_sequence"
  | "criativo_html"
  | "image"
  | "ensaio"
  | "logo"
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
  logo: 4,          // defaults to Nano Banana Pro
  ensaio: 6,        // Nano Banana Pro + 2 extra vision/analysis calls per image
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
  const cost = ACTION_COST[genType] ?? 1;

  // Atomic claim via Postgres advisory lock — eliminates race condition
  const { data: claim, error: rpcError } = await supabase.rpc(
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
  if (generationId === "dev-bypass") return; // no real credit row to finalize
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
