"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, ArrowLeft, Trash2, AlertCircle, PlayCircle } from "lucide-react";
import {
  VSLConfig,
  PitchEntry,
  parseVTurbIds,
  parseDelay,
  formatDelay,
  pitchKeyFromTagId,
  emptyConfig,
} from "../lib/vsl";

interface VSLConfigPanelProps {
  /** Re-mount via React `key` to reset internal state when switching elements. */
  initialConfig: VSLConfig | null;
  onClose: () => void;
  onSave: (config: VSLConfig) => void;
}

interface UserRow {
  key: string;
  id: string;
  delayInput: string;
}

let rowKeyCounter = 0;
const newRowKey = () => `row_${++rowKeyCounter}_${Date.now()}`;

function userRowsFromConfig(config: VSLConfig | null, derivedKey: string | null): {
  derivedDelay: string;
  rows: UserRow[];
} {
  if (!config) return { derivedDelay: "", rows: [] };
  let derivedDelay = "";
  const rows: UserRow[] = [];
  for (const p of config.pitches) {
    if (derivedKey && p.id === derivedKey) {
      derivedDelay = formatDelay(p.delaySec);
    } else {
      rows.push({ key: newRowKey(), id: p.id, delayInput: formatDelay(p.delaySec) });
    }
  }
  return { derivedDelay, rows };
}

export function VSLConfigPanel({ initialConfig, onClose, onSave }: VSLConfigPanelProps) {
  const seed = initialConfig ?? emptyConfig();
  const seedIds = seed.snippet ? parseVTurbIds(seed.snippet) : null;
  const seedDerivedKey = seedIds ? pitchKeyFromTagId(seedIds.tagId) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seedRows = useMemo(() => userRowsFromConfig(seed, seedDerivedKey), []);

  const [snippet, setSnippet] = useState(seed.snippet);
  const [derivedDelay, setDerivedDelay] = useState(seedRows.derivedDelay);
  const [userRows, setUserRows] = useState<UserRow[]>(seedRows.rows);
  const [includePreload, setIncludePreload] = useState(seed.includePreload);
  const [error, setError] = useState<string | null>(null);

  const parsedIds = useMemo(() => (snippet ? parseVTurbIds(snippet) : null), [snippet]);
  const derivedKey = parsedIds ? pitchKeyFromTagId(parsedIds.tagId) : null;

  const addRow = () => setUserRows((rows) => [...rows, { key: newRowKey(), id: "", delayInput: "" }]);
  const updateUserRow = (key: string, patch: Partial<Omit<UserRow, "key">>) => {
    setUserRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const removeRow = (key: string) => setUserRows((rows) => rows.filter((r) => r.key !== key));

  const handleSave = () => {
    setError(null);
    const cleanSnippet = snippet.trim();
    if (!cleanSnippet) { setError("Cole o snippet do VTurb."); return; }
    if (!parsedIds) {
      setError("Não consegui extrair os IDs. Cole o snippet completo (com <vturb-smartplayer> + <script>).");
      return;
    }

    const pitches: PitchEntry[] = [];
    const collect = (id: string, delayRaw: string, label: string): boolean => {
      const cleanId = id.trim();
      const cleanDelay = delayRaw.trim();
      if (!cleanId && !cleanDelay) return true;
      if (!cleanId) { setError(`${label}: faltando ID.`); return false; }
      if (!cleanDelay) return true;
      const delaySec = parseDelay(cleanDelay);
      if (delaySec === null || delaySec <= 0) {
        setError(`Delay inválido em "${cleanId}". Use mm:ss (ex: 30:10) ou segundos (ex: 1810).`);
        return false;
      }
      pitches.push({ id: cleanId, delaySec });
      return true;
    };

    if (derivedKey) {
      if (!collect(derivedKey, derivedDelay, "Variante principal")) return;
    }
    for (const row of userRows) {
      if (!collect(row.id, row.delayInput, "Variante extra")) return;
    }

    onSave({ snippet: cleanSnippet, pitches, includePreload });
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      {/* Header */}
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 text-[11px] text-white/50 hover:text-white mb-3 cursor-pointer"
      >
        <ArrowLeft className="w-3 h-3" />
        Voltar
      </button>
      <div className="flex items-center gap-2 mb-4">
        <PlayCircle className="w-4 h-4 text-purple-400" />
        <h2 className="text-[12px] font-semibold text-white">Configurar VSL VTurb</h2>
      </div>

      {/* Snippet */}
      <div className="space-y-1.5 mb-4">
        <label className="text-[10px] font-medium text-white/60 block">Snippet do VTurb</label>
        <textarea
          value={snippet}
          onChange={(e) => setSnippet(e.target.value)}
          placeholder='<vturb-smartplayer id="vid-..."></vturb-smartplayer>&#10;<script>...</script>'
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-2 text-[11px] text-white focus:outline-none focus:border-purple-500/40 h-32 resize-none font-mono"
        />
        {snippet.trim() && !parsedIds && (
          <span className="text-[10px] text-amber-400 flex items-start gap-1">
            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
            <span>Esperado: tag &lt;vturb-smartplayer&gt; + script com URL converteai.net.</span>
          </span>
        )}
        {parsedIds && (
          <span className="text-[10px] text-emerald-400/80 block">
            ✓ {parsedIds.kind === "ab-test" ? "A/B test" : "Player"} ·
            <code className="ml-1 text-emerald-300/90">{parsedIds.tagId}</code>
          </span>
        )}
      </div>

      {/* Pitches */}
      <div className="space-y-1.5 mb-4">
        <label className="text-[10px] font-medium text-white/60 block">
          Tempos da pitch <span className="text-white/30 font-normal">· uma linha por variante A/B</span>
        </label>

        {!derivedKey && userRows.length === 0 && (
          <div className="text-[10px] text-white/40 px-2.5 py-3 rounded-lg border border-dashed border-white/[0.08] text-center">
            Cole o snippet acima para auto-detectar a primeira variante.
          </div>
        )}

        <div className="space-y-1">
          {derivedKey && (
            <div className="flex items-center gap-1">
              <input
                value={derivedKey}
                disabled
                className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[10px] text-emerald-300/90 font-mono cursor-not-allowed truncate"
              />
              <input
                value={derivedDelay}
                onChange={(e) => setDerivedDelay(e.target.value)}
                placeholder="30:10"
                className="w-16 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500/40 font-mono text-center"
              />
              <span className="w-7 h-7" /> {/* spacer matching delete button width */}
            </div>
          )}

          {userRows.map((row) => (
            <div key={row.key} className="flex items-center gap-1">
              <input
                value={row.id}
                onChange={(e) => updateUserRow(row.key, { id: e.target.value })}
                placeholder="ID do player"
                className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500/40 font-mono"
              />
              <input
                value={row.delayInput}
                onChange={(e) => updateUserRow(row.key, { delayInput: e.target.value })}
                placeholder="30:10"
                className="w-16 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500/40 font-mono text-center"
              />
              <button
                onClick={() => removeRow(row.key)}
                title="Remover"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-white/[0.06] cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed border-white/[0.1] text-[10px] text-white/50 hover:text-white hover:border-purple-500/40 hover:bg-purple-500/5 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          Adicionar variante A/B
        </button>

        <p className="text-[10px] text-white/40 leading-snug">
          Elementos com classe <code className="text-purple-300">.esconder</code> aparecem
          quando a pitch toca.
        </p>
      </div>

      {/* Preload */}
      <label className="flex items-start gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] cursor-pointer hover:bg-white/[0.05] mb-3">
        <input
          type="checkbox"
          checked={includePreload}
          onChange={(e) => setIncludePreload(e.target.checked)}
          className="mt-0.5 accent-purple-500"
        />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] text-white/80 block">Incluir preload (LCP)</span>
          <span className="text-[10px] text-white/40 block">
            Reduz o load do player em 200-500ms.
          </span>
        </div>
      </label>

      {error && (
        <div className="text-[10px] text-red-400 flex items-start gap-1.5 p-2 rounded-lg bg-red-500/5 border border-red-500/20 mb-3">
          <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-1.5 sticky bottom-0 bg-zinc-950 pt-2 pb-1 -mx-1 px-1">
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded-lg text-[11px] text-white/60 bg-white/[0.04] hover:bg-white/[0.08] cursor-pointer"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!snippet.trim()}
          className={cn(
            "flex-[2] py-2 rounded-lg text-[11px] font-medium cursor-pointer",
            snippet.trim()
              ? "bg-purple-500 text-white hover:bg-purple-400"
              : "bg-white/[0.06] text-white/30 cursor-not-allowed"
          )}
        >
          Salvar VSL
        </button>
      </div>
    </div>
  );
}
