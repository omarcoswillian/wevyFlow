import { META_GRAPH_BASE, MetaAdsApiError } from "@/lib/meta-ads/server";

/** Insights diários por anúncio (Marketing API /insights, level=ad,
 * time_increment=1). Só leitura (ads_read). */

const PAGE_SIZE = 500;
const MAX_PAGES = 100;
const RETRY_CODES = new Set([4, 17, 32, 613]); // limites de taxa da Meta
const MAX_ATTEMPTS = 3;

const INSIGHT_FIELDS = [
  "ad_id", "date_start", "spend", "impressions", "clicks", "account_currency",
  "actions", "action_values",
  "video_play_actions", "video_thruplay_watched_actions",
  "video_p25_watched_actions", "video_p50_watched_actions",
  "video_p75_watched_actions", "video_p100_watched_actions",
].join(",");

type ActionList = { action_type?: string; value?: string }[] | undefined;

interface InsightRow {
  ad_id?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  account_currency?: string;
  actions?: ActionList;
  action_values?: ActionList;
  video_play_actions?: ActionList;
  video_thruplay_watched_actions?: ActionList;
  video_p25_watched_actions?: ActionList;
  video_p50_watched_actions?: ActionList;
  video_p75_watched_actions?: ActionList;
  video_p100_watched_actions?: ActionList;
}

interface InsightsPage {
  data?: InsightRow[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message?: string; code?: number };
}

export interface DailyInsight {
  ad_external_id: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  purchases: number;
  purchase_value: number;
  video_plays: number;
  video_thruplays: number;
  video_p25: number;
  video_p50: number;
  video_p75: number;
  video_p100: number;
  currency: string | null;
}

const num = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Tipos de compra, do mais agregado ao mais específico. A Meta devolve a mesma
 * compra em mais de um tipo (ex.: omni_purchase já soma pixel + app): somar os
 * três contaria a venda duas ou três vezes, então usamos só o primeiro presente. */
const PURCHASE_ACTION_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];

export function pickPurchase(list: ActionList): number {
  if (!list?.length) return 0;
  for (const type of PURCHASE_ACTION_TYPES) {
    const hit = list.find((a) => a.action_type === type);
    if (hit) return num(hit.value);
  }
  return 0;
}

/** Os campos video_* vêm como lista [{action_type:"video_view", value}]. */
const firstValue = (list: ActionList): number => (list?.length ? num(list[0].value) : 0);

export function parseInsightRow(row: InsightRow): DailyInsight | null {
  if (!row.ad_id || !row.date_start) return null;
  return {
    ad_external_id: row.ad_id,
    date: row.date_start,
    spend: num(row.spend),
    impressions: num(row.impressions),
    clicks: num(row.clicks),
    purchases: pickPurchase(row.actions),
    purchase_value: pickPurchase(row.action_values),
    video_plays: firstValue(row.video_play_actions),
    video_thruplays: firstValue(row.video_thruplay_watched_actions),
    video_p25: firstValue(row.video_p25_watched_actions),
    video_p50: firstValue(row.video_p50_watched_actions),
    video_p75: firstValue(row.video_p75_watched_actions),
    video_p100: firstValue(row.video_p100_watched_actions),
    currency: row.account_currency ?? null,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getPage(url: URL, accessToken: string): Promise<InsightsPage> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const json = (await res.json().catch(() => ({}))) as InsightsPage;
    if (res.ok && !json.error) return json;
    const code = json.error?.code;
    if (code === 190) throw new MetaAdsApiError("A conexão com o Meta Ads expirou — reconecte a conta.", 401);
    if (code !== undefined && RETRY_CODES.has(code) && attempt < MAX_ATTEMPTS) {
      await sleep(2000 * 2 ** (attempt - 1));
      continue;
    }
    throw new MetaAdsApiError("Não foi possível ler os resultados dos anúncios na Meta agora.", 502);
  }
}

/** Insights diários de todos os anúncios da conta no intervalo [since, until]
 * (datas AAAA-MM-DD, no fuso da conta de anúncios). */
export async function fetchDailyInsights(
  adAccountId: string,
  accessToken: string,
  since: string,
  until: string,
): Promise<DailyInsight[]> {
  const out: DailyInsight[] = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${META_GRAPH_BASE}/${adAccountId}/insights`);
    url.searchParams.set("level", "ad");
    url.searchParams.set("time_increment", "1");
    url.searchParams.set("time_range", JSON.stringify({ since, until }));
    url.searchParams.set("fields", INSIGHT_FIELDS);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (after) url.searchParams.set("after", after);

    const json = await getPage(url, accessToken);
    for (const row of json.data ?? []) {
      const parsed = parseInsightRow(row);
      if (parsed) out.push(parsed);
    }
    after = json.paging?.next ? json.paging.cursors?.after : undefined;
    if (!after) break;
  }
  return out;
}
