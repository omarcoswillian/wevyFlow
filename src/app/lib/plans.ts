export type PlanId = "free" | "pro" | "scale";

export interface Plan {
  label: string;
  pages: number; // monthly page generation limit (999 = unlimited display)
  kits: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free:  { label: "Free",  pages: 5,   kits: 1   },
  pro:   { label: "Pro",   pages: 50,  kits: 10  },
  scale: { label: "Scale", pages: 999, kits: 999 },
};

export const DEFAULT_PLAN: PlanId = "free";

export function isUnlimited(pages: number): boolean {
  return pages >= 999;
}
