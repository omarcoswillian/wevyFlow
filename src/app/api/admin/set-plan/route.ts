import { createServiceClient } from "@/lib/supabase/service";
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

  const rawBody: unknown = await request.json().catch(() => null);
  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return Response.json({ error: "Corpo da requisição deve ser um objeto." }, { status: 400 });
  }
  const body = rawBody as {
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
  if (body.resetUsage !== undefined && typeof body.resetUsage !== "boolean") {
    return Response.json({ error: "resetUsage deve ser um booleano." }, { status: 400 });
  }

  if (!PLAN_IDS.includes(body.plan as PlanId)) {
    return Response.json({ error: `plan inválido. Use: ${PLAN_IDS.join(", ")}` }, { status: 400 });
  }

  const planId = body.plan as PlanId;
  // This operates on an arbitrary userId, gated only by ADMIN_SECRET — not
  // by a logged-in session for that user, so it can never satisfy
  // user_profiles' owner-only RLS (which no longer allows client writes at
  // all — see 20260909000001_kv_batch_generation.sql). Needs the
  // privileged client regardless of who (if anyone) is logged in here.
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: body.userId, plan: planId }, { onConflict: "user_id" });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Optionally reset this month's usage by deleting generation_history rows
  // — the service-role client bypasses the credit_locked RLS restriction,
  // which is the point: this is the authorized administrative path that's
  // allowed to touch locked credit rows, unlike a normal user's own client.
  if (body.resetUsage) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const { error: resetError } = await supabase
      .from("generation_history")
      .delete()
      .eq("user_id", body.userId)
      .gte("created_at", monthStart);
    if (resetError) {
      return Response.json({ error: `Plano atualizado, mas falha ao resetar uso: ${resetError.message}` }, { status: 500 });
    }
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
