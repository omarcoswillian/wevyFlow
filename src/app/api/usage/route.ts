import { createClient } from "@/lib/supabase/server";
import { PLANS, DEFAULT_PLAN, type PlanId } from "../../lib/plans";

export const maxDuration = 10;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });

    // Mirror the dev bypass in lib/credits.ts — otherwise the sidebar shows
    // a real "Limite atingido" from past testing even though generation
    // itself is unmetered locally, which reads as broken.
    if (process.env.NODE_ENV === "development") {
      // JSON has no Infinity (Response.json would serialize it to null and
      // break the client's creditsUsed/creditsLimit math) — use a large
      // finite ceiling instead.
      const UNLIMITED = 999999;
      return Response.json({
        plan: "scale",
        planLabel: "Dev (sem limite)",
        price: 0,
        creditsUsed: 0,
        creditsLimit: UNLIMITED,
        remaining: UNLIMITED,
        month: `${new Date().toLocaleString("pt-BR", { month: "long" })} ${new Date().getFullYear()}`,
        pagesUsed: 0,
        pagesLimit: UNLIMITED,
      });
    }

    // Resolve plan
    let planId: PlanId = DEFAULT_PLAN;
    try {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("plan")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile?.plan && profile.plan in PLANS) planId = profile.plan as PlanId;
    } catch { /* default */ }

    const plan = PLANS[planId];
    const creditsLimit = plan.credits;

    // Sum this month's non-refunded generation cost (weighted per action
    // type — see ACTION_COST in lib/credits.ts — not a raw row count,
    // since an image generation costs several times what a text one does).
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data: rows } = await supabase
      .from("generation_history")
      .select("cost")
      .eq("user_id", user.id)
      .gte("created_at", monthStart)
      .in("status", ["pending", "success"]);

    const creditsUsed = (rows ?? []).reduce((sum, r) => sum + (r.cost ?? 1), 0);

    return Response.json({
      plan: planId,
      planLabel: plan.label,
      price: plan.price,
      creditsUsed,
      creditsLimit,
      remaining: Math.max(0, creditsLimit - creditsUsed),
      month: `${now.toLocaleString("pt-BR", { month: "long" })} ${now.getFullYear()}`,
      // Legacy fields — keep for backward compat
      pagesUsed: creditsUsed,
      pagesLimit: creditsLimit,
    });
  } catch (e) {
    console.error("[usage]", e);
    return Response.json({ error: "erro interno" }, { status: 500 });
  }
}
