"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, Wand2, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreativeAnalysis, CreativeHypothesis } from "@/lib/ads/creative-analysis";
import type { AdCreative } from "./types";
import { CONFIDENCE_LABEL, VERDICT_LABEL, formatMoney, formatPct, formatRoas } from "./format";

interface AnalysisResult {
  id: string;
  coverage: "full" | "partial";
  mediaType: "image" | "video";
  analysis: CreativeAnalysis;
}

interface Props {
  creative: AdCreative;
  currency: string | null;
  /** Período em AAAA-MM-DD, pra IA ler o anúncio à luz dos números do intervalo. */
  from: string;
  to: string;
  onGenerateVariants: (hypothesis: CreativeHypothesis, analysisId: string) => Promise<void>;
}

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

export function AdAnalysisPanel({ creative, currency, from, to, onGenerateVariants }: Props) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<number | null>(null);

  if (creative.source !== "meta_ads_api" || !creative.externalId) return null;
  const isVideo = creative.mediaType === "video";
  const m = creative.metrics;

  const analyze = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ads/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adExternalId: creative.externalId, from, to, force }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Não foi possível analisar o criativo.");
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
    try {
      await onGenerateVariants(h, result.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível preparar as variações.");
      setGenerating(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-white/[0.06]">
      {m && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[10px] uppercase tracking-wide text-white/30">Resultado no período</p>
            {creative.verdict && (
              <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold",
                creative.verdict === "winner" ? "bg-emerald-500/15 text-emerald-300"
                : creative.verdict === "loser" ? "bg-red-500/15 text-red-300" : "bg-white/[0.06] text-white/45")}>
                {VERDICT_LABEL[creative.verdict]}{creative.confidence && creative.verdict !== "insufficient" ? ` · ${CONFIDENCE_LABEL[creative.confidence]}` : ""}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-2 text-[11px]">
            <div><p className="text-white/25">Gasto</p><p className="text-white/75">{formatMoney(m.spend, currency)}</p></div>
            <div><p className="text-white/25">Compras</p><p className="text-white/75">{m.purchases}</p></div>
            <div><p className="text-white/25">ROAS</p><p className="text-white/75">{formatRoas(m.roas)}</p></div>
            <div><p className="text-white/25">CPA</p><p className="text-white/75">{m.cpa === null ? "—" : formatMoney(m.cpa, currency)}</p></div>
            <div><p className="text-white/25">CTR</p><p className="text-white/75">{formatPct(m.ctr)}</p></div>
            {m.hookRate !== null && <div><p className="text-white/25">Hook rate</p><p className="text-white/75">{formatPct(m.hookRate)}</p></div>}
            {m.hookRate !== null && <div><p className="text-white/25">Retenção 25%</p><p className="text-white/75">{formatPct(m.hold25)}</p></div>}
            {m.hookRate !== null && <div><p className="text-white/25">Conclusão</p><p className="text-white/75">{formatPct(m.completion)}</p></div>}
          </div>
          <p className="text-[10px] text-white/25 mt-2 leading-snug">
            Compras e receita são atribuídas pela Meta e não provam venda causada pelo anúncio.
          </p>
        </div>
      )}

      {!result && (
        <button
          onClick={() => analyze()}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? "Analisando..." : `Analisar criativo (${isVideo ? 2 : 1} ${isVideo ? "créditos" : "crédito"})`}
        </button>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-[11px] text-red-300"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}</p>
      )}

      {result && (
        <div className="flex flex-col gap-3">
          {result.coverage === "partial" && (
            <p className="flex items-start gap-1.5 text-[11px] text-amber-300/90 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3 py-2">
              <Video className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Análise parcial: o arquivo do vídeo não estava acessível (ou é longo/pesado demais), então a IA analisou só a capa. Hook e ritmo do vídeo não foram avaliados.
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Field label="Hook" value={result.analysis.hook} />
            <Field label="Promessa" value={result.analysis.promise} />
            <Field label="Mecanismo" value={result.analysis.mechanism} />
            <Field label="Prova" value={result.analysis.proof} />
            <Field label="CTA" value={result.analysis.cta} />
            <Field label="Estilo visual" value={result.analysis.visualStyle} />
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
                  <button
                    onClick={() => generate(h, i)}
                    disabled={generating !== null}
                    className="mt-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {generating === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    Gerar 3 variações em imagem ({VARIANT_CREDITS} créditos)
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
  );
}
