"use client";

import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Loader2, AlertCircle, Wand2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreativeAnalysis, CreativeHypothesis } from "@/lib/ads/creative-analysis";
import { CONFIDENCE_LABEL, VERDICT_LABEL } from "../anuncios/format";
import { ThumbnailTestPanel, type YtTest } from "./ThumbnailTestPanel";
import type { YtPeriod, YtVideoRow } from "./types";

interface AnalysisResult { id: string; analysis: CreativeAnalysis }
const VARIANT_CREDITS = 6; // 3 imagens x 2 créditos

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-white/25">{label}</p>
      <p className="text-[12px] text-white/70 leading-snug">{value}</p>
    </div>
  );
}

export function YouTubeVideoModal({ video, periodDays, tests, onTestsChanged, onClose, onGenerateVariants }: {
  video: YtVideoRow;
  periodDays: YtPeriod;
  tests: YtTest[];
  onTestsChanged: () => void;
  onClose: () => void;
  onGenerateVariants: (hypothesis: CreativeHypothesis, analysisId: string) => Promise<void>;
}) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const analyze = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/youtube/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: video.videoId, periodDays, force }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Não foi possível analisar a thumbnail.");
      setResult(body as AnalysisResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  };

  const generate = async (h: CreativeHypothesis, idx: number) => {
    if (!result) return;
    setGenerating(idx);
    setError(null);
    try { await onGenerateVariants(h, result.id); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível preparar as variações."); setGenerating(null); }
  };

  const m = video.metrics;
  return (
    <div role="dialog" aria-modal="true" aria-label={video.title} onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div ref={panelRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[88vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#111116] shadow-2xl grid grid-cols-1 md:grid-cols-2 outline-none">
        <div className="bg-black/40 flex items-start justify-center p-6">
          {video.thumbnailUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={video.thumbnailUrl} alt={video.title} className="w-full rounded-xl object-contain" />
            : <div className="aspect-video w-full rounded-xl bg-white/[0.04]" />}
        </div>

        <div className="p-6 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[15px] font-medium text-white/90 leading-snug">{video.title}</p>
            <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"><X className="w-4 h-4" /></button>
          </div>
          <a href={`https://www.youtube.com/watch?v=${video.videoId}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/70 w-fit">
            <ExternalLink className="w-3 h-3" /> Abrir no YouTube
          </a>

          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[10px] uppercase tracking-wide text-white/30">{periodDays === 365 ? "Último ano" : `Últimos ${periodDays} dias`}</p>
              {video.verdict && (
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold",
                  video.verdict === "winner" ? "bg-emerald-500/15 text-emerald-300" : video.verdict === "loser" ? "bg-red-500/15 text-red-300" : "bg-white/[0.06] text-white/45")}>
                  {VERDICT_LABEL[video.verdict]}{video.confidence && video.verdict !== "insufficient" ? ` · ${CONFIDENCE_LABEL[video.confidence]}` : ""}
                </span>
              )}
            </div>
            {m ? (
              <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-[11px]">
                <div><p className="text-white/25">Visualizações</p><p className="text-white/75">{m.views.toLocaleString("pt-BR")}</p></div>
                <div><p className="text-white/25">Vídeo assistido</p><p className="text-white/75">{m.avgViewPercentage.toFixed(0)}%</p></div>
                <div><p className="text-white/25">Tempo médio</p><p className="text-white/75">{Math.round(m.avgViewDurationSeconds)}s</p></div>
                <div><p className="text-white/25">Inscritos ganhos</p><p className="text-white/75">{m.subscribersGained}</p></div>
                {video.studioCtr && <div title={`Importado do Studio, período ${video.studioCtr.periodStart} a ${video.studioCtr.periodEnd}`}><p className="text-white/25">CTR da thumb (Studio)</p><p className="text-white/75">{(video.studioCtr.ctr * 100).toFixed(1).replace(".", ",")}%</p></div>}
                {video.studioCtr && <div><p className="text-white/25">Impressões (Studio)</p><p className="text-white/75">{video.studioCtr.impressions.toLocaleString("pt-BR")}</p></div>}
                <div><p className="text-white/25">Vs mediana do canal</p><p className="text-white/75">{video.index === null ? "—" : `${video.index.toFixed(1).replace(".", ",")}x`}</p></div>
              </div>
            ) : (
              <p className="text-[11px] text-white/35">Sem visualizações neste período. Total desde a publicação: {video.totalViews.toLocaleString("pt-BR")}.</p>
            )}
          </div>

          <ThumbnailTestPanel
            videoId={video.videoId}
            tests={tests}
            hypothesisSuggestions={result?.analysis.hypotheses.map((h) => h.title) ?? []}
            analysisId={result?.id ?? null}
            onChanged={onTestsChanged}
          />

          {!result && (
            <button onClick={() => analyze()} disabled={loading}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {loading ? "Analisando..." : "Analisar thumbnail (1 crédito)"}
            </button>
          )}
          {error && <p className="flex items-start gap-1.5 text-[11px] text-red-300"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}</p>}

          {result && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <Field label="O que atrai o olhar" value={result.analysis.hook} />
                <Field label="Promessa" value={result.analysis.promise} />
                <Field label="Estilo visual" value={result.analysis.visualStyle} />
                <Field label="Texto na thumb" value={result.analysis.textOnCreative} />
              </div>
              {result.analysis.strengths.length > 0 && (
                <div><p className="text-[10px] uppercase tracking-wide text-emerald-400/60">Pontos fortes</p>
                  <ul className="list-disc pl-4 text-[12px] text-white/65 space-y-0.5">{result.analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
              )}
              {result.analysis.weaknesses.length > 0 && (
                <div><p className="text-[10px] uppercase tracking-wide text-red-400/60">Fraquezas</p>
                  <ul className="list-disc pl-4 text-[12px] text-white/65 space-y-0.5">{result.analysis.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-white/30 mb-1.5">Hipóteses para testar (não são causas provadas)</p>
                <div className="flex flex-col gap-2">
                  {result.analysis.hypotheses.map((h, i) => (
                    <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                      <p className="text-[12px] font-medium text-white/85">{h.title}</p>
                      <p className="text-[11px] text-white/40 leading-snug mt-0.5">{h.rationale}</p>
                      <button onClick={() => generate(h, i)} disabled={generating !== null}
                        className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50">
                        {generating === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        Gerar 3 thumbs ({VARIANT_CREDITS} créditos)
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => analyze(true)} disabled={loading} className="self-start text-[10px] text-white/30 hover:text-white/60 underline underline-offset-2 cursor-pointer disabled:opacity-50">
                {loading ? "Refazendo..." : "Refazer análise"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
