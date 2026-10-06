import type { Confidence, Verdict } from "@/lib/ads/scoring";

export interface YtVideoMetricsView {
  views: number;
  minutesWatched: number;
  avgViewDurationSeconds: number;
  avgViewPercentage: number;
  likes: number;
  comments: number;
  subscribersGained: number;
  thumbImpressions: number | null;
  thumbCtr: number | null;
}

export type YtPeriod = 28 | 90 | 365;

export interface YtVideoRow {
  videoId: string;
  title: string;
  publishedAt: number;
  thumbnailUrl: string | null;
  durationSeconds: number;
  /** Totais desde a publicação (Data API), independentes do período escolhido. */
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  /** Impressões e CTR do último export do Studio importado (a API não entrega). */
  studioCtr: { impressions: number; ctr: number; periodStart: string; periodEnd: string } | null;
  metrics: YtVideoMetricsView | null;
  viewsPerDay: number | null;
  index: number | null;
  confidence: Confidence | null;
  verdict: Verdict | null;
}
