"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DatePreset, DateRange } from "./types";
import { DATE_PRESET_OPTIONS, formatDateInputValue, formatDatePtBr, getCustomRange, parseDateInputValue, todayDateInputValue } from "./date-range";

interface AdDateRangeFilterProps {
  preset: DatePreset;
  range: DateRange;
  onPresetChange: (preset: DatePreset) => void;
  onCustomApply: (range: DateRange) => void;
}

export function AdDateRangeFilter({ preset, range, onPresetChange, onCustomApply }: AdDateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [startInput, setStartInput] = useState(() => formatDateInputValue(range.start));
  const [endInput, setEndInput] = useState(() => formatDateInputValue(range.endExclusive - 1));
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const todayValue = todayDateInputValue();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node) || triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const startMs = parseDateInputValue(startInput);
  const endMs = parseDateInputValue(endInput);
  // `max` no <input> não impede digitar/colar uma data futura na mão — o
  // handler do botão precisa validar de novo, não só confiar no atributo.
  // Comparação de string "YYYY-MM-DD" é equivalente à cronológica aqui.
  const isFuture = startInput > todayValue || endInput > todayValue;
  const invalid = startMs === null || endMs === null || startMs > endMs || isFuture;

  const applyCustom = () => {
    if (invalid || startMs === null || endMs === null) return;
    onCustomApply(getCustomRange(startMs, endMs));
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {DATE_PRESET_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onPresetChange(opt.id)}
          className={cn(
            "px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all cursor-pointer border",
            preset === opt.id
              ? "bg-purple-600 text-white border-purple-600 shadow-[0_0_16px_rgba(124,58,237,0.4)]"
              : "text-white/40 border-white/[0.08] hover:text-white/70 hover:border-white/[0.16]"
          )}
        >
          {opt.label}
        </button>
      ))}

      <div className="relative">
        <button
          ref={triggerRef}
          onClick={() => setOpen((p) => !p)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all cursor-pointer border",
            preset === "custom"
              ? "bg-purple-600 text-white border-purple-600 shadow-[0_0_16px_rgba(124,58,237,0.4)]"
              : "text-white/40 border-white/[0.08] hover:text-white/70 hover:border-white/[0.16]"
          )}
        >
          <Calendar className="w-3 h-3" />
          {preset === "custom" ? `${formatDatePtBr(range.start)} – ${formatDatePtBr(range.endExclusive - 1)}` : "Personalizar"}
          <ChevronDown className="w-3 h-3" />
        </button>

        {open && (
          <div
            ref={popoverRef}
            className="absolute z-[200] top-full left-0 mt-2 w-[280px] rounded-xl bg-[#1a1a1e] border border-white/[0.1] shadow-2xl p-4 space-y-3"
          >
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-white/30 block mb-1">De</label>
                <input
                  type="date"
                  value={startInput}
                  max={todayValue}
                  onChange={(e) => setStartInput(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-purple-500/40 [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-[10px] text-white/30 block mb-1">Até</label>
                <input
                  type="date"
                  value={endInput}
                  max={todayValue}
                  onChange={(e) => setEndInput(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-purple-500/40 [color-scheme:dark]"
                />
              </div>
            </div>
            {isFuture ? (
              <p className="text-[10px] text-red-400">Não dá pra escolher uma data futura.</p>
            ) : invalid && (
              <p className="text-[10px] text-red-400">A data inicial precisa ser igual ou anterior à data final.</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-white/50 text-[11px] hover:text-white hover:bg-white/[0.07] transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={applyCustom}
                disabled={invalid}
                className="flex-1 py-1.5 rounded-lg bg-purple-600 text-white text-[11px] font-medium hover:bg-purple-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Aplicar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
