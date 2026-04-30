"use server";

import { createClient } from "@/lib/supabase/server";
import { PLANS, DEFAULT_PLAN, type PlanId } from "./plans";

export type GenType = "landing_page" | "brand_identity" | "email_sequence" | "criativo" | "other";

export interface CreditResult {
  allowed: true;
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

function isError(r: CreditCheckResult): r is CreditError {
  return "error" in r;
}

export { isError as isCreditError };

export async function checkAndDeductCredit(
  genType: GenType,
  promptSnippet = ""
): Promise<CreditCheckResult> {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Faça login para continuar.", status: 401 };

  // Resolve user plan
  let planId: PlanId = DEFAULT_PLAN;
  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();
    if (profile?.plan && profile.plan in PLANS) planId = profile.plan as PlanId;
  } catch { /* default plan */ }

  const plan = PLANS[planId];
  const limit = plan.credits;

  // Count this month's generations
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { count } = await supabase
    .from("generation_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", monthStart);

  const used = count ?? 0;

  if (used >= limit) {
    return {
      allowed: false,
      userId: user.id,
      plan: planId,
      planLabel: plan.label,
      used,
      limit,
    };
  }

  // Pre-deduct: insert tracking row
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("generation_history") as any).insert({
    user_id: user.id,
    prompt: promptSnippet.slice(0, 500),
    platform: "html",
    gen_type: genType,
    code: "",
  });

  return {
    allowed: true,
    userId: user.id,
    plan: planId,
    planLabel: plan.label,
    used: used + 1,
    limit,
    remaining: limit - used - 1,
  };
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
