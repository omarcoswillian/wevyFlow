"use client";

import { useEffect, useRef, useState } from "react";
import { X, Megaphone, Star, Copy, Check, ImagePlus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdCreative } from "./types";
import { formatDatePtBr } from "./date-range";

const SOURCE_LABELS: Record<AdCreative["source"], string> = {
  mock: "Demo",
  meta_ad_library: "Meta Library",
  foreplay: "Foreplay",
  meta_ads_api: "Meta Ads",
};

interface AdPreviewModalProps {
  creative: AdCreative;
  onClose: () => void;
  onToggleFavorite: (creative: AdCreative) => void;
  onUseAsReference: (creative: AdCreative) => void;
}

export function AdPreviewModal({ creative, onClose, onToggleFavorite, onUseAsReference }: AdPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [broken, setBroken] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Foco: move pro modal ao abrir, prende Tab/Shift+Tab dentro dele
  // enquanto aberto, devolve o foco pro elemento de origem ao fechar —
  // sem isso, aria-modal sozinho não impede Tab de vazar pra trás do
  // overlay nem deixa leitor de tela saber que o foco entrou no diálogo.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, a[href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const handleCopy = async () => {
    const text = [creative.headline, creative.body].filter(Boolean).join("\n\n");
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 1800);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={creative.headline ?? creative.advertiserName}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-[#111116] shadow-2xl grid grid-cols-1 md:grid-cols-2 outline-none"
      >
        <div className="bg-black/40 flex items-center justify-center p-6 min-h-[240px]">
          {creative.thumbnailUrl && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creative.thumbnailUrl}
              alt={creative.headline ?? creative.advertiserName}
              onError={() => setBroken(true)}
              className="max-w-full max-h-[60vh] rounded-xl object-contain"
            />
          ) : (
            <Megaphone className="w-10 h-10 text-white/10" />
          )}
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wide">{creative.advertiserName}</p>
              <p className="text-[10px] text-white/25 mt-0.5">{SOURCE_LABELS[creative.source]}</p>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {creative.headline && <p className="text-[15px] font-medium text-white/90 leading-snug">{creative.headline}</p>}
          {creative.body && <p className="text-[13px] text-white/50 leading-relaxed">{creative.body}</p>}

          <div className="grid grid-cols-2 gap-3 text-[11px] pt-2 border-t border-white/[0.06]">
            <div><p className="text-white/25 mb-0.5">Status atual</p><p className="text-white/70">{creative.status === "active" ? "Ativo" : "Pausado"}</p></div>
            <div><p className="text-white/25 mb-0.5">Tempo no ar</p><p className="text-white/70">{creative.daysRunning} dias</p></div>
            <div><p className="text-white/25 mb-0.5">Início</p><p className="text-white/70">{formatDatePtBr(creative.startedAt)}</p></div>
            <div><p className="text-white/25 mb-0.5">Término</p><p className="text-white/70">{creative.stoppedAt ? formatDatePtBr(creative.stoppedAt) : "Em veiculação"}</p></div>
            <div className="col-span-2"><p className="text-white/25 mb-0.5">Plataformas</p><p className="text-white/70">{creative.platforms.join(", ") || "—"}</p></div>
          </div>

          <div className="flex items-center gap-2 mt-auto pt-2">
            <button
              onClick={() => onToggleFavorite(creative)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-colors cursor-pointer border",
                creative.isFavorite ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "bg-white/[0.04] border-white/[0.07] text-white/50 hover:text-white/80"
              )}
            >
              <Star className={cn("w-3.5 h-3.5", creative.isFavorite && "fill-amber-400")} /> {creative.isFavorite ? "Favoritado" : "Favoritar"}
            </button>
            <button
              onClick={handleCopy}
              disabled={!creative.headline && !creative.body}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07] text-white/50 hover:text-white/80 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : copyError ? <AlertCircle className="w-3.5 h-3.5 text-red-400" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copiado!" : copyError ? "Erro ao copiar" : "Copiar texto"}
            </button>
            <button
              onClick={() => onUseAsReference(creative)}
              disabled={!creative.thumbnailUrl}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ImagePlus className="w-3.5 h-3.5" /> Usar como referência
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
