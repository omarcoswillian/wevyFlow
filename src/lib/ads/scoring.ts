/* Métricas e ranking de anúncios a partir dos insights diários da Meta.
 * Puro (sem I/O), usado pelo servidor e pela tela. Tudo que depende de uma
 * regra de negócio está nomeado aqui, pra ser auditável e fácil de ajustar. */

export interface AdInsightTotals {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchase_value: number;
  video_plays: number;
  video_thruplays: number;
  video_p25: number;
  video_p100: number;
}

export interface AdMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  revenue: number;
  /** receita atribuída / gasto; null sem gasto ou sem valor de compra. */
  roas: number | null;
  /** gasto / compras; null sem compras. */
  cpa: number | null;
  /** cliques / impressões. */
  ctr: number | null;
  /** Hook rate: reproduções de vídeo (campo video_play_actions da Meta) / impressões.
   * Fórmula do produto, não uma métrica oficial da Meta. null se não é vídeo. */
  hookRate: number | null;
  /** Retenção: visualizações de 25% / reproduções. */
  hold25: number | null;
  /** Conclusão: visualizações de 100% / reproduções. */
  completion: number | null;
}

export type Confidence = "insufficient" | "low" | "medium" | "high";
export type Verdict = "winner" | "loser" | "neutral" | "insufficient";

const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export function toMetrics(t: AdInsightTotals): AdMetrics {
  return {
    spend: t.spend,
    impressions: t.impressions,
    clicks: t.clicks,
    purchases: t.purchases,
    revenue: t.purchase_value,
    roas: t.spend > 0 && t.purchase_value > 0 ? t.purchase_value / t.spend : null,
    cpa: ratio(t.spend, t.purchases),
    ctr: ratio(t.clicks, t.impressions),
    hookRate: t.video_plays > 0 ? ratio(t.video_plays, t.impressions) : null,
    hold25: ratio(t.video_p25, t.video_plays),
    completion: ratio(t.video_p100, t.video_plays),
  };
}

/** Nível de confiança do resultado de UM anúncio no período. Limiares de
 * triagem (não um teste estatístico): poucas compras = ruído. */
export const CONFIDENCE_RULES = {
  minImpressions: 1000,
  lowPurchases: 1,
  mediumPurchases: 10,
  mediumImpressions: 5000,
  highPurchases: 30,
  highImpressions: 10000,
} as const;

export function confidenceOf(m: AdMetrics): Confidence {
  const r = CONFIDENCE_RULES;
  if (m.spend <= 0 || m.impressions < r.minImpressions) return "insufficient";
  if (m.purchases >= r.highPurchases && m.impressions >= r.highImpressions) return "high";
  if (m.purchases >= r.mediumPurchases && m.impressions >= r.mediumImpressions) return "medium";
  return "low";
}

export const VERDICT_RULES = {
  /** Vencedor: ROAS pelo menos 15% acima do da conta, com confiança média+. */
  winnerRoasVsAccount: 1.15,
  /** Perdedor: ROAS até 60% do da conta, com confiança média+. */
  loserRoasVsAccount: 0.6,
  /** Perdedor sem nenhuma compra: gastou pelo menos 2x o CPA médio da conta. */
  loserZeroPurchaseCpaMultiple: 2,
  zeroPurchaseMinImpressions: 3000,
} as const;

const CONFIDENCE_ORDER: Record<Confidence, number> = { insufficient: 0, low: 1, medium: 2, high: 3 };

export interface RankedAd {
  id: string;
  metrics: AdMetrics;
  confidence: Confidence;
  verdict: Verdict;
}

/** Classifica os anúncios de uma conta no período, comparando cada um com o
 * resultado agregado da própria conta (não com um número fixo). */
export function rankAds(items: { id: string; totals: AdInsightTotals }[]): { ads: RankedAd[]; accountRoas: number | null; accountCpa: number | null } {
  const sum = items.reduce(
    (a, { totals: t }) => ({ spend: a.spend + t.spend, revenue: a.revenue + t.purchase_value, purchases: a.purchases + t.purchases }),
    { spend: 0, revenue: 0, purchases: 0 },
  );
  const accountRoas = sum.spend > 0 && sum.revenue > 0 ? sum.revenue / sum.spend : null;
  const accountCpa = sum.purchases > 0 ? sum.spend / sum.purchases : null;
  const V = VERDICT_RULES;

  const ads = items.map(({ id, totals }): RankedAd => {
    const metrics = toMetrics(totals);
    const confidence = confidenceOf(metrics);
    let verdict: Verdict = "neutral";
    if (confidence === "insufficient") {
      verdict = "insufficient";
    } else if (CONFIDENCE_ORDER[confidence] >= CONFIDENCE_ORDER.medium && accountRoas !== null && metrics.roas !== null) {
      if (metrics.roas >= accountRoas * V.winnerRoasVsAccount) verdict = "winner";
      else if (metrics.roas <= accountRoas * V.loserRoasVsAccount) verdict = "loser";
    } else if (
      metrics.purchases === 0 &&
      accountCpa !== null &&
      metrics.impressions >= V.zeroPurchaseMinImpressions &&
      metrics.spend >= accountCpa * V.loserZeroPurchaseCpaMultiple
    ) {
      verdict = "loser";
    }
    return { id, metrics, confidence, verdict };
  });
  return { ads, accountRoas, accountCpa };
}
