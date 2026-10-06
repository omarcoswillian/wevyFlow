import type { Confidence, Verdict } from "@/lib/ads/scoring";

/** Ranking de vídeos do YouTube. Sem o CTR da thumbnail (que a API pode não
 * entregar), compara o desempenho de cada vídeo com o da mediana do próprio
 * canal: visualizações por dia no período, ajustadas à idade do vídeo. */

export interface VideoPerfInput {
  id: string;
  publishedAt: number;
  views: number;
  avgViewPercentage: number;
}

export interface RankedVideo {
  id: string;
  ageDays: number;
  viewsPerDay: number;
  /** viewsPerDay / mediana do canal (1 = na média). null sem base de comparação. */
  index: number | null;
  confidence: Confidence;
  verdict: Verdict;
}

export const VIDEO_RULES = {
  /** Vídeos mais novos que isso ainda não tiveram tempo de render. */
  minAgeDays: 3,
  minViews: 100,
  lowViews: 500,
  mediumViews: 5000,
  lowAgeDays: 14,
  winnerIndex: 1.5,
  loserIndex: 0.5,
  loserMinAgeDays: 14,
  /** A mediana só usa vídeos com pelo menos isto de idade. */
  baselineMinAgeDays: 7,
} as const;

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function rankVideos(items: VideoPerfInput[], periodDays: number, now: number): RankedVideo[] {
  const R = VIDEO_RULES;
  const rows = items.map((v) => {
    const ageDays = Math.max(0, (now - v.publishedAt) / 86_400_000);
    // Dias em que o vídeo esteve no ar dentro do período (vídeo novo não teve o período todo).
    const exposed = Math.max(1, Math.min(periodDays, ageDays));
    return { v, ageDays, viewsPerDay: v.views / exposed };
  });
  const base = median(rows.filter((r) => r.ageDays >= R.baselineMinAgeDays).map((r) => r.viewsPerDay));

  return rows.map(({ v, ageDays, viewsPerDay }): RankedVideo => {
    let confidence: Confidence;
    if (ageDays < R.minAgeDays || v.views < R.minViews) confidence = "insufficient";
    else if (ageDays < R.lowAgeDays || v.views < R.lowViews) confidence = "low";
    else if (v.views < R.mediumViews) confidence = "medium";
    else confidence = "high";

    const index = base && base > 0 ? viewsPerDay / base : null;
    let verdict: Verdict = "neutral";
    if (confidence === "insufficient") verdict = "insufficient";
    else if (index !== null) {
      if (index >= R.winnerIndex && (confidence === "medium" || confidence === "high")) verdict = "winner";
      else if (index <= R.loserIndex && ageDays >= R.loserMinAgeDays) verdict = "loser";
    }
    return { id: v.id, ageDays, viewsPerDay, index, confidence, verdict };
  });
}
