"use client";

import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Loader2, AlertCircle, Trophy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

export type YtTest = Database["public"]["Tables"]["youtube_thumbnail_tests"]["Row"];
interface SavedPiece { id: string; url: string; hypothesis: string | null }

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

/** Registro dos testes A/B de thumbnail feitos no YouTube Studio ("Testar e comparar").
 * A WevyFlow gera as variações; o teste em si roda no Studio, e aqui ficam registrados
 * a hipótese, as variantes e o resultado. */
export function ThumbnailTestPanel({ videoId, tests, hypothesisSuggestions, analysisId, onChanged }: {
  videoId: string;
  tests: YtTest[];
  hypothesisSuggestions: string[];
  analysisId: string | null;
  onChanged: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [pieces, setPieces] = useState<SavedPiece[]>([]);
  const [hypothesis, setHypothesis] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState<string | null>(null);
  const [winner, setWinner] = useState("");
  const [shares, setShares] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    supabase.from("criativos").select("id,url,hypothesis").eq("source_ad_external_id", `yt:${videoId}`).order("created_at", { ascending: false })
      .then(({ data }) => { if (!cancelled) setPieces((data ?? []) as SavedPiece[]); });
    return () => { cancelled = true; };
  }, [supabase, videoId]);

  const running = tests.find((t) => t.status === "running") ?? null;
  const finished = tests.filter((t) => t.status === "finished");

  const toggle = (id: string) => setChosen((c) => c.includes(id) ? c.filter((x) => x !== id) : c.length >= 2 ? c : [...c, id]);

  const start = async () => {
    if (!hypothesis.trim() || chosen.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login para registrar o teste.");
      const variants = [
        { label: "Original", criativo_id: null, url: null, watch_share: null },
        ...chosen.map((id, i) => ({ label: `Variante ${i + 1}`, criativo_id: id, url: pieces.find((p) => p.id === id)?.url ?? null, watch_share: null })),
      ];
      const { error: err } = await supabase.from("youtube_thumbnail_tests").insert({
        user_id: user.id, video_id: videoId, hypothesis: hypothesis.trim().slice(0, 300), analysis_id: analysisId, variants, status: "running",
      });
      if (err) throw new Error(err.message);
      setHypothesis(""); setChosen([]);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível registrar o teste.");
    } finally {
      setSaving(false);
    }
  };

  const finish = async (t: YtTest) => {
    if (!winner) return;
    setSaving(true);
    setError(null);
    try {
      const variants = t.variants.map((v) => {
        const n = Number((shares[v.label] ?? "").replace(",", "."));
        return { ...v, watch_share: shares[v.label] && Number.isFinite(n) ? n : null };
      });
      const { error: err } = await supabase.from("youtube_thumbnail_tests")
        .update({ status: "finished", winner_label: winner, variants, note: note.trim() || null, ended_at: new Date().toISOString() })
        .eq("id", t.id);
      if (err) throw new Error(err.message);
      setFinishing(null); setWinner(""); setShares({}); setNote("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar o resultado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-3">
      <div className="flex items-center gap-1.5">
        <FlaskConical className="w-3.5 h-3.5 text-purple-300" />
        <p className="text-[12px] font-semibold text-white/85">Teste A/B no YouTube</p>
      </div>

      {running ? (
        <div className="space-y-2">
          <p className="text-[11px] text-white/55 leading-snug">
            Teste em andamento desde {fmtDate(running.started_at)}: <span className="text-white/80">{running.hypothesis}</span>
          </p>
          <div className="flex gap-2 flex-wrap">
            {running.variants.map((v) => (
              <div key={v.label} className="text-center">
                {v.url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={v.url} alt={v.label} style={{ width: 96, height: 54 }} className="rounded-md object-cover border border-white/[0.08]" />
                  : <div style={{ width: 96, height: 54 }} className="rounded-md bg-white/[0.05] flex items-center justify-center text-[9px] text-white/35">atual</div>}
                <p className="text-[9px] text-white/40 mt-0.5">{v.label}</p>
              </div>
            ))}
          </div>

          {finishing === running.id ? (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] text-white/55">Qual variante venceu no Studio?</p>
              <div className="flex gap-1.5 flex-wrap">
                {running.variants.map((v) => (
                  <button key={v.label} onClick={() => setWinner(v.label)}
                    className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium cursor-pointer border transition-colors",
                      winner === v.label ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-white/[0.04] border-white/[0.07] text-white/55 hover:text-white/80")}>
                    {v.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-white/30">Parcela do tempo de exibição de cada uma, como o Studio mostra (opcional, em %):</p>
              <div className="flex gap-2 flex-wrap">
                {running.variants.map((v) => (
                  <label key={v.label} className="block">
                    <span className="block text-[9px] text-white/35 mb-0.5">{v.label}</span>
                    <input value={shares[v.label] ?? ""} onChange={(e) => setShares((s) => ({ ...s, [v.label]: e.target.value }))} inputMode="decimal" placeholder="%"
                      className="w-16 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none" />
                  </label>
                ))}
              </div>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Observação (opcional)"
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[11px] text-white placeholder:text-white/25 focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={() => finish(running)} disabled={saving || !winner}
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-[11px] font-semibold cursor-pointer">
                  {saving ? "Salvando..." : "Salvar resultado"}
                </button>
                <button onClick={() => setFinishing(null)} className="px-2 py-1.5 text-[11px] text-white/40 hover:text-white/70 cursor-pointer">Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setFinishing(running.id)} className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/70 text-[11px] font-medium cursor-pointer">
              Registrar resultado
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-white/40 leading-snug">
            O teste roda no YouTube Studio (<b className="text-white/60">Conteúdo, o vídeo, Testar e comparar</b>). Baixe as variações geradas, suba lá e registre aqui para guardar o resultado.
          </p>
          <input list={`hyp-${videoId}`} value={hypothesis} onChange={(e) => setHypothesis(e.target.value)} placeholder="Hipótese testada (ex.: texto mais curto)"
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[11px] text-white placeholder:text-white/25 focus:outline-none" />
          <datalist id={`hyp-${videoId}`}>{hypothesisSuggestions.map((h) => <option key={h} value={h} />)}</datalist>

          {pieces.length === 0 ? (
            <p className="text-[11px] text-white/35">Nenhuma variação salva para este vídeo ainda. Gere em &quot;Gerar 3 thumbs&quot; e clique em Usar para salvar.</p>
          ) : (
            <div>
              <p className="text-[10px] text-white/30 mb-1">Escolha até 2 variações (o Studio testa até 3 thumbnails, contando a atual):</p>
              <div className="flex gap-2 flex-wrap">
                {pieces.map((p) => (
                  <div key={p.id} className="relative">
                    <button onClick={() => toggle(p.id)} className={cn("block rounded-md overflow-hidden border-2 cursor-pointer", chosen.includes(p.id) ? "border-purple-400" : "border-transparent")}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt="Variação" style={{ width: 96, height: 54 }} className="object-cover" />
                    </button>
                    <a href={p.url} target="_blank" rel="noreferrer" title="Abrir para baixar" className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/70 text-white/70 hover:text-white">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={start} disabled={saving || !hypothesis.trim() || chosen.length === 0}
            className="px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 disabled:opacity-40 text-[11px] font-medium cursor-pointer flex items-center gap-1.5">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />} Registrar início do teste
          </button>
        </div>
      )}

      {error && <p className="flex items-start gap-1.5 text-[11px] text-red-300"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}</p>}

      {finished.length > 0 && (
        <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-white/30">Testes anteriores</p>
          {finished.map((t) => (
            <div key={t.id} className="text-[11px] text-white/55 leading-snug">
              <p><span className="text-white/75">{t.hypothesis}</span> · {fmtDate(t.started_at)} a {t.ended_at ? fmtDate(t.ended_at) : "?"}</p>
              <p className="flex items-center gap-1 text-emerald-300/90"><Trophy className="w-3 h-3" /> Venceu: {t.winner_label}
                <span className="text-white/35">
                  {t.variants.some((v) => v.watch_share !== null) ? ` (${t.variants.filter((v) => v.watch_share !== null).map((v) => `${v.label} ${v.watch_share}%`).join(", ")})` : ""}
                </span>
              </p>
              {t.note && <p className="text-white/35">{t.note}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
