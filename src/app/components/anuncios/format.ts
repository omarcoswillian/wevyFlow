import type { Confidence, Verdict } from "@/lib/ads/scoring";

export function formatMoney(value: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL", maximumFractionDigits: 2 }).format(value);
  } catch {
    return value.toFixed(2);
  }
}

export const formatPct = (v: number | null): string => (v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);
export const formatRoas = (v: number | null): string => (v === null ? "—" : `${v.toFixed(2).replace(".", ",")}x`);

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  insufficient: "Dados insuficientes",
  low: "Confiança baixa",
  medium: "Confiança média",
  high: "Confiança alta",
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  winner: "Vencedor",
  loser: "Perdedor",
  neutral: "Na média",
  insufficient: "Dados insuficientes",
};
