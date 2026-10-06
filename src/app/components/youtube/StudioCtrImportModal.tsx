"use client";

import { useMemo, useRef, useState } from "react";
import { X, Upload, Loader2, AlertCircle, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { matchStudioRows, parseStudioCsv, type StudioRow } from "@/lib/youtube/studio-csv";

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Lê o arquivo escolhido: .csv direto, ou .zip do Studio (pega o CSV da tabela de dados). */
async function readExport(file: File): Promise<string> {
  if (!file.name.toLowerCase().endsWith(".zip")) return file.text();
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const csvs = Object.values(zip.files).filter((f) => !f.dir && f.name.toLowerCase().endsWith(".csv"));
  // O Studio inclui "Dados da tabela" (por vídeo), "Dados do gráfico" e "Totais": só a tabela serve.
  const preferred = csvs.find((f) => /tabela|table/i.test(f.name)) ?? csvs[0];
  if (!preferred) throw new Error("O .zip não tem nenhum arquivo CSV.");
  return preferred.async("string");
}

export function StudioCtrImportModal({ videos, onClose, onImported }: {
  videos: { videoId: string; title: string }[];
  onClose: () => void;
  onImported: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<StudioRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [start, setStart] = useState(() => isoDay(Date.now() - 28 * 86_400_000));
  const [end, setEnd] = useState(() => isoDay(Date.now()));

  const match = useMemo(() => (rows ? matchStudioRows(rows, videos) : null), [rows, videos]);

  const onFile = async (file: File) => {
    setError(null);
    setDone(null);
    try {
      const parsed = parseStudioCsv(await readExport(file));
      if (!parsed.ok) { setRows(null); setError(parsed.error); return; }
      setRows(parsed.rows);
      setFileName(file.name);
    } catch (e) {
      setRows(null);
      setError(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    }
  };

  const save = async () => {
    if (!match || match.matched.length === 0) return;
    if (!start || !end || start > end) { setError("Confira o período: a data inicial precisa ser anterior à final."); return; }
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Faça login para importar.");
      const payload = match.matched.map((m) => ({
        user_id: user.id, video_id: m.videoId, period_start: start, period_end: end,
        impressions: m.impressions, ctr: m.ctr, imported_at: new Date().toISOString(),
      }));
      for (let i = 0; i < payload.length; i += 200) {
        const { error: err } = await supabase.from("youtube_studio_ctr").upsert(payload.slice(i, i + 200), { onConflict: "user_id,video_id,period_start,period_end" });
        if (err) throw new Error(err.message);
      }
      setDone(payload.length);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a importação.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#111116] p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Importar CTR do YouTube Studio</h2>
            <p className="text-[11px] text-white/40 mt-0.5">A API do YouTube não entrega impressões nem CTR das thumbnails. O Studio exporta esse relatório.</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] cursor-pointer"><X className="w-4 h-4" /></button>
        </div>

        <ol className="list-decimal pl-5 space-y-1 text-[12px] text-white/55 leading-snug">
          <li>No YouTube Studio, abra <b className="text-white/75">Analytics</b> e clique em <b className="text-white/75">Modo avançado</b>.</li>
          <li>Escolha o período e, na tabela, as métricas <b className="text-white/75">Impressões</b> e <b className="text-white/75">Taxa de cliques das impressões</b>.</li>
          <li>Clique no ícone de download e escolha <b className="text-white/75">CSV</b>. Pode subir o .csv ou o .zip que o Studio baixa.</li>
        </ol>

        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-[10px] uppercase tracking-widest text-white/30 mb-1">Início do período</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none" /></label>
          <label className="block"><span className="block text-[10px] uppercase tracking-widest text-white/30 mb-1">Fim do período</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none" /></label>
        </div>
        <p className="text-[10px] text-white/30 -mt-2">Use as mesmas datas que escolheu no Studio: o CTR vale para esse período.</p>

        <input ref={fileRef} type="file" accept=".csv,.zip,text/csv,application/zip" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
        <button onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-dashed border-white/[0.15] text-white/55 hover:text-white/80 hover:border-white/30 text-[12px] transition-colors cursor-pointer">
          <Upload className="w-4 h-4" /> {fileName ? `Arquivo: ${fileName} (trocar)` : "Escolher o arquivo CSV ou ZIP"}
        </button>

        {error && <p className="flex items-start gap-1.5 text-[11px] text-red-300"><AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}</p>}

        {match && (
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-[12px] text-white/65 space-y-1">
            <p><b className="text-white/85">{match.matched.length}</b> vídeo(s) encontrados no seu canal.</p>
            {match.unmatched.length > 0 && <p className="text-white/40">{match.unmatched.length} linha(s) ignoradas: não batem com nenhum vídeo do canal.</p>}
          </div>
        )}

        {done !== null ? (
          <p className="flex items-center gap-1.5 text-[12px] text-emerald-300"><Check className="w-4 h-4" /> {done} vídeo(s) importados. O CTR já aparece na tabela.</p>
        ) : (
          <button onClick={save} disabled={saving || !match || match.matched.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-[12px] font-semibold transition-colors cursor-pointer">
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importando...</> : "Importar"}
          </button>
        )}
      </div>
    </div>
  );
}
