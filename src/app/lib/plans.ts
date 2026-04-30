export type PlanId = "free" | "starter" | "pro" | "scale";

export interface Plan {
  label: string;
  credits: number; // generations per month
  price: number;   // R$/month
}

export const PLANS: Record<PlanId, Plan> = {
  free:    { label: "Free",    credits: 5,   price: 0   },
  starter: { label: "Starter", credits: 20,  price: 97  },
  pro:     { label: "Pro",     credits: 60,  price: 197 },
  scale:   { label: "Scale",   credits: 150, price: 397 },
};

export const DEFAULT_PLAN: PlanId = "free";

export const PLAN_IDS: PlanId[] = ["free", "starter", "pro", "scale"];
