import { createClient } from "@/lib/supabase/server";
import { PLANS, DEFAULT_PLAN, type PlanId } from "../../lib/plans";

export const maxDuration = 10;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });

    // Get user's plan (default free if no profile row)
    let planId: PlanId = DEFAULT_PLAN;
    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("plan")
        .eq("user_id", user.id)
        .single();
      if (profile?.plan && profile.plan in PLANS) {
        planId = profile.plan as PlanId;
      }
    } catch {
      // table may not exist yet — treat as free
    }

    // Count generations this calendar month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count } = await supabase
      .from("generation_history")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", monthStart);

    const plan = PLANS[planId];
    const pagesUsed = count ?? 0;

    return Response.json({
      plan: planId,
      planLabel: plan.label,
      pagesUsed,
      pagesLimit: plan.pages,
      month: `${now.toLocaleString("pt-BR", { month: "long" })} ${now.getFullYear()}`,
    });
  } catch (e) {
    console.error("[usage]", e);
    return Response.json({ error: "erro interno" }, { status: 500 });
  }
}
