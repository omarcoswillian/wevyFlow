"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, MonitorPlay, TrendingDown, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { rankVideos } from "@/lib/youtube/scoring";
import type { CreativeHypothesis } from "@/lib/ads/creative-analysis";
import { YouTubeConnectionCard, type YouTubeStatus } from "./youtube/YouTubeConnectionCard";
import { YouTubeVideoModal } from "./youtube/YouTubeVideoModal";
import { StudioCtrImportModal } from "./youtube/StudioCtrImportModal";
import type { YtTest } from "./youtube/ThumbnailTestPanel";
import type { YtPeriod, YtVideoRow } from "./youtube/types";
import { CONFIDENCE_LABEL, VERDICT_LABEL } from "./anuncios/format";
import type { AdsVisao } from "./AnunciosDashboard";

const TITLES: Record<AdsVisao, { title: string; subtitle: string }> = {
  todos: { title: "YouTube", subtitle: "Desempenho dos vídeos e das thumbnails do seu canal" },
  melhores: { title: "Melhores vídeos", subtitle: "Bem acima da mediana do canal, com visualizações suficientes para confiar" },
  piores: { title: "Piores vídeos", subtitle: "Bem abaixo da mediana do canal, depois de tempo suficiente no ar" },
};

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const fmtDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function YouTubeDashboard({ visao = "todos" }: { visao?: AdsVisao }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [status, setStatus] = useState<YouTubeStatus | null>(null);
  const [period, setPeriod] = useState<YtPeriod>(28);
  // Enquanto o usuário não escolhe, abre no menor período que tiver dados (canal pequeno: 28 dias vem vazio).
  const [periodChosen, setPeriodChosen] = useState(false);
  const [rows, setRows] = useState<YtVideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tests, setTests] = useState<YtTest[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  const load = useCallback(async (p: YtPeriod) => {
    setLoading(true);
    setSyncError(null);
    try {
      const st = (await (await fetch("/api/integrations/youtube/status")).json()) as YouTubeStatus;
      let ctrAvailable = st.ctrAvailable ?? null;
      if (st.connected) {
        const res = await fetch("/api/integrations/youtube/sync", { method: "POST" });
        const body = (await res.json().catch(() => ({}))) as { error?: string; ctrAvailable?: boolean | null; metricsFailed?: boolean };
        if (!res.ok) setSyncError(body.error ?? "Não foi possível sincronizar com o YouTube agora.");
        else if (body.metricsFailed) setSyncError("Os vídeos foram atualizados, mas as métricas não puderam ser lidas agora.");
        if (typeof body.ctrAvailable === "boolean") ctrAvailable = body.ctrAvailable;
      }
      setStatus({ ...st, ctrAvailable });

      const { data: videos } = await supabase.from("youtube_videos").select("*").order("published_at", { ascending: false });
      const { data: ctrRows } = await supabase.from("youtube_studio_ctr").select("*").order("period_end", { ascending: false });
      const ctrByVideo = new Map<string, { impressions: number; ctr: number; periodStart: string; periodEnd: string }>();
      for (const c of ctrRows ?? []) {
        if (!ctrByVideo.has(c.video_id)) ctrByVideo.set(c.video_id, { impressions: Number(c.impressions), ctr: Number(c.ctr), periodStart: c.period_start, periodEnd: c.period_end });
      }
      const { data: testRows } = await supabase.from("youtube_thumbnail_tests").select("*").order("started_at", { ascending: false });
      setTests((testRows ?? []) as YtTest[]);
      let { data: metrics } = await supabase.from("youtube_video_metrics").select("*").eq("period_days", p);
      if (!periodChosen && (metrics ?? []).length === 0 && p !== 365) {
        const { data: wider } = await supabase.from("youtube_video_metrics").select("*").eq("period_days", 365);
        if ((wider ?? []).length > 0) { setPeriod(365); return; }
      }
      metrics = metrics ?? [];
      const byId = new Map((metrics ?? []).map((m) => [m.video_id, m]));
      const now = Date.now();
      const ranked = new Map(
        rankVideos(
          (videos ?? []).filter((v) => byId.has(v.video_id)).map((v) => ({
            id: v.video_id, publishedAt: new Date(v.published_at).getTime(),
            views: Number(byId.get(v.video_id)!.views), avgViewPercentage: Number(byId.get(v.video_id)!.avg_view_percentage),
          })),
          p, now,
        ).map((r) => [r.id, r]),
      );
      setRows((videos ?? []).map((v): YtVideoRow => {
        const m = byId.get(v.video_id);
        const r = ranked.get(v.video_id);
        return {
          videoId: v.video_id, title: v.title, publishedAt: new Date(v.published_at).getTime(),
          thumbnailUrl: v.thumbnail_url, durationSeconds: v.duration_seconds,
          totalViews: Number(v.view_count), totalLikes: Number(v.like_count), totalComments: Number(v.comment_count),
          studioCtr: ctrByVideo.get(v.video_id) ?? null,
          metrics: m ? {
            views: Number(m.views), minutesWatched: Number(m.minutes_watched), avgViewDurationSeconds: Number(m.avg_view_duration_seconds),
            avgViewPercentage: Number(m.avg_view_percentage), likes: Number(m.likes), comments: Number(m.comments),
            subscribersGained: Number(m.subscribers_gained),
            thumbImpressions: m.thumb_impressions === null ? null : Number(m.thumb_impressions),
            thumbCtr: m.thumb_ctr === null ? null : Number(m.thumb_ctr),
          } : null,
          viewsPerDay: r?.viewsPerDay ?? null, index: r?.index ?? null,
          confidence: r?.confidence ?? null, verdict: r?.verdict ?? null,
        };
      }));
    } finally {
      setLoading(false);
    }
  }, [supabase, periodChosen]);

  useEffect(() => {
    load(period);
  }, [load, period]);

  const hasStudioCtr = rows.some((r) => r.studioCtr);
  const testByVideo = useMemo(() => {
    const m = new Map<string, "running" | "finished">();
    for (const t of tests) if (m.get(t.video_id) !== "running") m.set(t.video_id, t.status);
    return m;
  }, [tests]);
  const hasMetrics = rows.some((r) => r.metrics);

  const visible = useMemo(() => {
    let list = rows;
    if (visao === "melhores") list = list.filter((r) => r.verdict === "winner");
    if (visao === "piores") list = list.filter((r) => r.verdict === "loser");
    return [...list].sort((a, b) => {
      const ai = a.index ?? -1, bi = b.index ?? -1;
      return visao === "piores" ? ai - bi : bi - ai;
    });
  }, [rows, visao]);

  const selectedRow = selected ? rows.find((r) => r.videoId === selected) ?? null : null;

  /** Thumb do vídeo guardada no nosso Storage; a hipótese vira a instrução e Criativos gera 3 em 16:9. */
  const generateVariants = async (row: YtVideoRow, hypothesis: CreativeHypothesis, analysisId: string) => {
    const res = await fetch("/api/youtube/media", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId: row.videoId }),
    });
    const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !body.url) throw new Error(body.error || "Não foi possível preparar a thumbnail.");
    sessionStorage.setItem("wevyflow:pending-ad-reference", JSON.stringify({
      url: body.url, name: row.title, adId: row.videoId,
      variants: { prompt: hypothesis.editInstruction, hypothesis: hypothesis.title, analysisId, sourceAdExternalId: `yt:${row.videoId}`, count: 3, format: "16:9" },
    }));
    router.push("/criativos?tipo=thumb-youtube");
  };

  const Icon = visao === "melhores" ? TrendingUp : visao === "piores" ? TrendingDown : MonitorPlay;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0e]">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.05] shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Icon className={cn("w-4 h-4", visao === "melhores" ? "text-emerald-400" : visao === "piores" ? "text-red-400" : "text-purple-400")} />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-white/90">{TITLES[visao].title}</h1>
            <p className="text-[11px] text-white/30">{TITLES[visao].subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
        {status?.connected && (
          <button onClick={() => setImportOpen(true)}
            className="px-3 py-2 rounded-xl text-[12px] font-medium bg-white/[0.04] border border-white/[0.06] text-white/60 hover:text-white/85 transition-colors cursor-pointer">
            Importar CTR do Studio
          </button>
        )}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
          {([28, 90, 365] as const).map((p) => (
            <button key={p} onClick={() => { setPeriodChosen(true); setPeriod(p); }}
              className={cn("px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all cursor-pointer", period === p ? "bg-purple-600 text-white" : "text-white/40 hover:text-white/70")}>
              {p === 365 ? "1 ano" : `${p} dias`}
            </button>
          ))}
        </div>
        </div>
      </div>

      <div className="shrink-0 mx-8 mt-4">
        <YouTubeConnectionCard status={status} onChange={() => load(period)} />
      </div>

      {syncError && (
        <div className="shrink-0 mx-8 mt-3 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <Info className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-300 leading-relaxed">{syncError}</p>
        </div>
      )}

      {status?.connected && status.ctrAvailable === false && (
        <div className="shrink-0 mx-8 mt-3 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <Info className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/45 leading-relaxed">
            A API do YouTube não fornece o CTR das thumbnails. Use &quot;Importar CTR do Studio&quot; para trazê-lo do export do Studio. O ranking compara as visualizações por dia de cada vídeo com a mediana do seu canal.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="w-5 h-5 text-purple-400 animate-spin" /></div>
        ) : !status?.connected ? null : rows.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-14 text-center">
            <p className="text-[13px] text-white/40">Nenhum vídeo encontrado neste canal ainda.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-14 text-center">
            <p className="text-[13px] text-white/40">
              {visao === "todos" ? "Nenhum vídeo para mostrar." : hasMetrics ? "Nenhum vídeo se encaixa nesta visão com confiança suficiente no período." : "Ainda não há métricas neste período."}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]" style={{ minWidth: 1500 }}>
                <thead className="bg-[#111116]">
                  <tr className="border-b border-white/[0.06] text-left text-[10px] uppercase tracking-wider text-white/35">
                    <th className="px-3 py-2.5 font-semibold sticky left-0 bg-[#111116] z-10">Vídeo</th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Publicado</th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Views no período</th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Views totais</th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Horas assistidas</th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">% assistido</th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Tempo médio</th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Curtidas</th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Coment.</th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Inscritos</th>
                    {hasStudioCtr && <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Impressões</th>}
                    {hasStudioCtr && <th className="px-3 py-2.5 font-semibold whitespace-nowrap">CTR</th>}
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Vs mediana</th>
                    <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Teste</th>
                    <th className="px-3 py-2.5 font-semibold">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => {
                    const m = r.metrics;
                    const dash = <span className="text-white/20">—</span>;
                    return (
                      <tr key={r.videoId} onClick={() => setSelected(r.videoId)} className="group border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.03] transition-colors cursor-pointer">
                        <td className="px-3 py-2 sticky left-0 bg-[#0e0e12] group-hover:bg-[#15151b] z-10">
                          <div className="flex items-center gap-2.5" style={{ width: 300 }}>
                            <div className="relative shrink-0" style={{ width: 72 }}>
                              {r.thumbnailUrl
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={r.thumbnailUrl} alt="" style={{ width: 72, height: 40 }} className="rounded-md object-cover border border-white/[0.06]" />
                                : <div style={{ width: 72, height: 40 }} className="rounded-md bg-white/[0.04]" />}
                              <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/80 text-white text-[8px] font-semibold leading-tight">{fmtDuration(r.durationSeconds)}</span>
                            </div>
                            <p className="text-white/80 line-clamp-2 leading-snug">{r.title}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-white/45 whitespace-nowrap">{fmtDate(r.publishedAt)}</td>
                        <td className="px-3 py-2 text-white/85 font-medium whitespace-nowrap tabular-nums">{m ? m.views.toLocaleString("pt-BR") : dash}</td>
                        <td className="px-3 py-2 text-white/60 whitespace-nowrap tabular-nums">{r.totalViews.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2 text-white/60 whitespace-nowrap tabular-nums">{m ? (m.minutesWatched / 60).toFixed(1).replace(".", ",") + " h" : dash}</td>
                        <td className="px-3 py-2 text-white/60 whitespace-nowrap tabular-nums">{m ? `${m.avgViewPercentage.toFixed(0)}%` : dash}</td>
                        <td className="px-3 py-2 text-white/60 whitespace-nowrap tabular-nums">{m ? fmtDuration(Math.round(m.avgViewDurationSeconds)) : dash}</td>
                        <td className="px-3 py-2 text-white/60 whitespace-nowrap tabular-nums">{r.totalLikes.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2 text-white/60 whitespace-nowrap tabular-nums">{r.totalComments.toLocaleString("pt-BR")}</td>
                        <td className="px-3 py-2 text-white/60 whitespace-nowrap tabular-nums">{m ? m.subscribersGained.toLocaleString("pt-BR") : dash}</td>
                        {hasStudioCtr && <td className="px-3 py-2 text-white/60 whitespace-nowrap tabular-nums" title={r.studioCtr ? `Período ${r.studioCtr.periodStart} a ${r.studioCtr.periodEnd}` : undefined}>{r.studioCtr ? r.studioCtr.impressions.toLocaleString("pt-BR") : dash}</td>}
                        {hasStudioCtr && <td className="px-3 py-2 text-white/80 font-medium whitespace-nowrap tabular-nums" title={r.studioCtr ? `Período ${r.studioCtr.periodStart} a ${r.studioCtr.periodEnd}` : undefined}>{r.studioCtr ? `${(r.studioCtr.ctr * 100).toFixed(1).replace(".", ",")}%` : dash}</td>}
                        <td className="px-3 py-2 text-white/75 whitespace-nowrap tabular-nums">{r.index === null ? dash : `${r.index.toFixed(1).replace(".", ",")}x`}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {testByVideo.get(r.videoId) === "running" ? <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-semibold">Em teste</span>
                            : testByVideo.get(r.videoId) === "finished" ? <span className="px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 text-[10px] font-semibold">Testado</span> : dash}
                        </td>
                        <td className="px-3 py-2">
                          {r.verdict ? (
                            <div className="flex flex-col gap-0.5">
                              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap w-fit",
                                r.verdict === "winner" ? "bg-emerald-500/15 text-emerald-300" : r.verdict === "loser" ? "bg-red-500/15 text-red-300" : "bg-white/[0.06] text-white/45")}>
                                {VERDICT_LABEL[r.verdict]}
                              </span>
                              {r.confidence && r.verdict !== "insufficient" && <span className="text-[9px] text-white/30 whitespace-nowrap">{CONFIDENCE_LABEL[r.confidence]}</span>}
                            </div>
                          ) : dash}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {importOpen && (
        <StudioCtrImportModal
          videos={rows.map((r) => ({ videoId: r.videoId, title: r.title }))}
          onClose={() => setImportOpen(false)}
          onImported={() => load(period)}
        />
      )}

      {selectedRow && (
        <YouTubeVideoModal
          video={selectedRow}
          periodDays={period}
          tests={tests.filter((t) => t.video_id === selectedRow.videoId)}
          onTestsChanged={() => load(period)}
          onClose={() => setSelected(null)}
          onGenerateVariants={(h, analysisId) => generateVariants(selectedRow, h, analysisId)}
        />
      )}
    </div>
  );
}
