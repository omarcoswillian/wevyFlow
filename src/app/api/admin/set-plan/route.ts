import { createClient } from "@/lib/supabase/server";
import { PLANS, PLAN_IDS, type PlanId } from "../../../lib/plans";

export const maxDuration = 10;

// Simple admin endpoint protected by ADMIN_SECRET env var.
// Usage: POST /api/admin/set-plan
// Body: { secret, userId, plan }
// Returns: { ok: true, userId, plan, creditsLimit }
export async function POST(request: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return Response.json({ error: "ADMIN_SECRET não configurado" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({})) as {
    secret?: string;
    userId?: string;
    plan?: string;
    resetUsage?: boolean;
  };

  if (body.secret !== secret) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!body.userId || !body.plan) {
    return Response.json({ error: "userId e plan são obrigatórios" }, { status: 400 });
  }

  if (!PLAN_IDS.includes(body.plan as PlanId)) {
    return Response.json({ error: `plan inválido. Use: ${PLAN_IDS.join(", ")}` }, { status: 400 });
  }

  const planId = body.plan as PlanId;
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: body.userId, plan: planId }, { onConflict: "user_id" });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Optionally reset this month's usage by deleting generation_history rows
  if (body.resetUsage) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    await supabase
      .from("generation_history")
      .delete()
      .eq("user_id", body.userId)
      .gte("created_at", monthStart);
  }

  const plan = PLANS[planId];
  return Response.json({
    ok: true,
    userId: body.userId,
    plan: planId,
    planLabel: plan.label,
    creditsLimit: plan.credits,
  });
}
