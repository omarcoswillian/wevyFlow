export type PlanId = "free" | "starter" | "pro" | "scale";

export interface Plan {
  label: string;
  credits: number; // créditos por mês (uma peça de design simples = 2, troca de pessoa = 4 — ver ACTION_COST em credits.ts)
  price: number;   // R$/month
}

export const PLANS: Record<PlanId, Plan> = {
  free:    { label: "Free",    credits: 6,   price: 0   },
  starter: { label: "Starter", credits: 40,  price: 97  },
  pro:     { label: "Pro",     credits: 120, price: 197 },
  scale:   { label: "Scale",   credits: 300, price: 397 },
};

export const DEFAULT_PLAN: PlanId = "free";

export const PLAN_IDS: PlanId[] = ["free", "starter", "pro", "scale"];
