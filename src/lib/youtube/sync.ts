import { YT_ANALYTICS_BASE, YT_DATA_BASE, YouTubeApiError, ytGet } from "./server";

/** Leitura do canal: vídeos (Data API) e métricas por período (Analytics API). */

export interface YtChannel {
  id: string;
  title: string;
  pictureUrl: string | null;
  uploadsPlaylistId: string | null;
}

export interface YtVideo {
  video_id: string;
  title: string;
  published_at: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  view_count: number;
  like_count: number;
  comment_count: number;
}

export interface YtVideoMetrics {
  video_id: string;
  views: number;
  minutes_watched: number;
  avg_view_duration_seconds: number;
  avg_view_percentage: number;
  likes: number;
  comments: number;
  subscribers_gained: number;
  thumb_impressions: number | null;
  thumb_ctr: number | null;
}

const MAX_VIDEOS = 300;
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** "PT1H2M3S" -> segundos. */
export function parseIsoDuration(iso: string | undefined): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? "");
  if (!m) return 0;
  return num(m[1]) * 86400 + num(m[2]) * 3600 + num(m[3]) * 60 + num(m[4]);
}

interface ThumbSet { maxres?: { url?: string }; standard?: { url?: string }; high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } }
export const bestThumb = (t: ThumbSet | undefined): string | null =>
  t?.maxres?.url ?? t?.standard?.url ?? t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? null;

export async function fetchChannel(accessToken: string): Promise<YtChannel> {
  const json = await ytGet<{ items?: { id: string; snippet?: { title?: string; thumbnails?: ThumbSet }; contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] }>(
    YT_DATA_BASE, "channels", { part: "snippet,contentDetails", mine: "true" }, accessToken,
  );
  const ch = json.items?.[0];
  if (!ch) throw new YouTubeApiError("Esta conta Google não tem um canal do YouTube.", 404);
  return {
    id: ch.id,
    title: ch.snippet?.title ?? "Canal",
    pictureUrl: bestThumb(ch.snippet?.thumbnails),
    uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads ?? null,
  };
}

/** Vídeos enviados (mais recentes primeiro), com duração e estatísticas totais. */
export async function fetchVideos(accessToken: string, uploadsPlaylistId: string): Promise<YtVideo[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < MAX_VIDEOS) {
    const page = await ytGet<{ items?: { contentDetails?: { videoId?: string } }[]; nextPageToken?: string }>(
      YT_DATA_BASE, "playlistItems",
      { part: "contentDetails", playlistId: uploadsPlaylistId, maxResults: "50", ...(pageToken ? { pageToken } : {}) },
      accessToken,
    );
    for (const it of page.items ?? []) if (it.contentDetails?.videoId) ids.push(it.contentDetails.videoId);
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }

  const out: YtVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const json = await ytGet<{ items?: { id: string; snippet?: { title?: string; publishedAt?: string; thumbnails?: ThumbSet }; contentDetails?: { duration?: string }; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[] }>(
      YT_DATA_BASE, "videos", { part: "snippet,contentDetails,statistics", id: batch.join(",") }, accessToken,
    );
    for (const v of json.items ?? []) {
      if (!v.snippet?.publishedAt) continue;
      out.push({
        video_id: v.id,
        title: v.snippet.title ?? "(sem título)",
        published_at: new Date(v.snippet.publishedAt).toISOString(),
        thumbnail_url: bestThumb(v.snippet.thumbnails),
        duration_seconds: parseIsoDuration(v.contentDetails?.duration),
        view_count: num(v.statistics?.viewCount),
        like_count: num(v.statistics?.likeCount),
        comment_count: num(v.statistics?.commentCount),
      });
    }
  }
  return out;
}

interface AnalyticsResponse { columnHeaders?: { name: string }[]; rows?: (string | number)[][] }

const BASE_METRICS = ["views", "estimatedMinutesWatched", "averageViewDuration", "averageViewPercentage", "likes", "comments", "subscribersGained"];

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function parseAnalyticsRows(json: AnalyticsResponse): YtVideoMetrics[] {
  const names = (json.columnHeaders ?? []).map((c) => c.name);
  const idx = (n: string) => names.indexOf(n);
  const iVideo = idx("video");
  if (iVideo < 0) return [];
  const iImp = idx("videoThumbnailImpressions");
  const iCtr = idx("videoThumbnailImpressionsClickRate");
  return (json.rows ?? []).map((r) => ({
    video_id: String(r[iVideo]),
    views: num(r[idx("views")]),
    minutes_watched: num(r[idx("estimatedMinutesWatched")]),
    avg_view_duration_seconds: num(r[idx("averageViewDuration")]),
    avg_view_percentage: num(r[idx("averageViewPercentage")]),
    likes: num(r[idx("likes")]),
    comments: num(r[idx("comments")]),
    subscribers_gained: num(r[idx("subscribersGained")]),
    thumb_impressions: iImp >= 0 ? num(r[iImp]) : null,
    // A API devolve a taxa em porcentagem (ex.: 6.4); guardamos como fração (0.064).
    thumb_ctr: iCtr >= 0 ? num(r[iCtr]) / 100 : null,
  }));
}

/** Métricas por vídeo nos últimos `days` dias. O CTR e as impressões da thumbnail
 * (videoThumbnailImpressions...) NÃO são suportados pela API do YouTube Analytics:
 * testado em 2026-10-06, a consulta devolve 400 "query is not supported". Só o
 * YouTube Studio mostra esse número. Por isso o ranking usa visualizações e retenção. */
export async function fetchVideoMetrics(accessToken: string, days: number): Promise<{ rows: YtVideoMetrics[]; ctrAvailable: false }> {
  const until = new Date();
  const since = new Date(Date.now() - days * 86_400_000);
  const json = await ytGet<AnalyticsResponse>(YT_ANALYTICS_BASE, "reports", {
    ids: "channel==MINE", startDate: isoDay(since), endDate: isoDay(until),
    metrics: BASE_METRICS.join(","), dimensions: "video", sort: "-views", maxResults: "200",
  }, accessToken);
  return { rows: parseAnalyticsRows(json), ctrAvailable: false };
}
