import type { AdMetrics, Confidence, Verdict } from "@/lib/ads/scoring";

export type AdSource = "mock" | "meta_ad_library" | "foreplay" | "meta_ads_api";
export type AdStatus = "active" | "inactive";

export interface AdCreative {
  id: string;
  source: AdSource;
  advertiserName: string;
  headline: string | null;
  body: string | null;
  thumbnailUrl: string | null;
  platforms: string[];
  status: AdStatus;
  startedAt: number;
  stoppedAt: number | null;
  /** Total known lifetime in days (stoppedAt ?? now) — computed once on
   * load, never during render (Date.now() is impure). */
  daysRunning: number;
  isFavorite: boolean;
  /** ID do anúncio na Meta (só em meta_ads_api). */
  externalId: string | null;
  mediaType: "image" | "video" | "unknown";
  /** Resultado no período selecionado; null sem insights (ou fonte sem eles). */
  metrics: AdMetrics | null;
  confidence: Confidence | null;
  verdict: Verdict | null;
}

export type DatePreset = "30d" | "15d" | "7d" | "yesterday" | "today" | "ytd" | "custom";

export interface DateRange {
  /** Inclusive lower bound, epoch ms, local midnight. */
  start: number;
  /** Exclusive upper bound, epoch ms — local midnight of the day AFTER the last included day. */
  endExclusive: number;
  label: string;
}

export type SortKey = "advertiserName" | "startedAt" | "stoppedAt" | "daysRunning" | "status" | "spend" | "purchases" | "roas";
export type SortDirection = "asc" | "desc";

export interface AdFilters {
  search: string;
  status: "all" | AdStatus;
  platform: "all" | "facebook" | "instagram";
  favoritesOnly: boolean;
}
