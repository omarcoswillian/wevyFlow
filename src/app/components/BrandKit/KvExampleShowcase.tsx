"use client";

import { useState } from "react";
import { Sparkles, ImagePlus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KvExample, KvExampleSlide } from "../../lib/kv-examples";
import { Lightbox } from "./Lightbox";

export function KvExampleShowcase({
  example,
  onUseAsReference,
  addingPath,
  addedPaths,
  onUseAllAsReference,
  isAddingAll,
}: {
  example: KvExample;
  /** When provided, every thumbnail gets a hover "Usar como referência"
   * button that calls this with the slide's image path. */
  onUseAsReference?: (slide: KvExampleSlide) => void;
  /** Path currently being added (shows a spinner on just that thumbnail). */
  addingPath?: string | null;
  /** Paths already added as references (shows a check mark instead of the button). */
  addedPaths?: string[];
  /** When provided, shows a header button to add every slide of this
   * example as a reference in one shot — the user picking "o exemplo
   * inteiro" instead of clicking imagem por imagem. */
  onUseAllAsReference?: (slides: KvExampleSlide[]) => void;
  isAddingAll?: boolean;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const allAdded = example.slides.every((s) => addedPaths?.includes(s.path));

  return (
    <div className="w-full max-w-[760px] mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0" />
          <p className="text-[11px] font-semibold text-white/60 uppercase tracking-widest truncate">
            Exemplo real — {example.projectName} · {example.clientName}
          </p>
        </div>
        {onUseAllAsReference && (
          <button
            onClick={() => onUseAllAsReference(example.slides)}
            disabled={isAddingAll || allAdded}
            className={cn(
              "shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer disabled:cursor-default",
              allAdded
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-purple-500/15 text-purple-300 hover:bg-purple-500/25"
            )}
          >
            {isAddingAll ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : allAdded ? (
              <Check className="w-3 h-3" />
            ) : (
              <ImagePlus className="w-3 h-3" />
            )}
            {allAdded ? "Todas adicionadas" : `Usar todas (${example.slides.length})`}
          </button>
        )}
      </div>
      <p className="text-[11px] text-white/30 px-4 mt-1">Um brand book completo gerado com a mesma estrutura que você vai construir aqui.</p>

      <div className="flex gap-3 overflow-x-auto px-4 py-4 scrollbar-none">
        {example.slides.map((slide, i) => {
          const isAdding = addingPath === slide.path;
          const isAdded = addedPaths?.includes(slide.path) ?? false;
          return (
            <div key={slide.path} className="group relative shrink-0 w-[150px] flex flex-col rounded-xl overflow-hidden border border-white/[0.06] hover:border-purple-500/30 transition-all">
              <button
                onClick={() => setOpenIndex(i)}
                className="relative h-[90px] bg-white/[0.03] overflow-hidden cursor-pointer text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slide.path} alt={slide.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              </button>
              {onUseAsReference && (
                <button
                  onClick={(e) => { e.stopPropagation(); onUseAsReference(slide); }}
                  disabled={isAdding || isAdded}
                  title={isAdded ? "Já usado como referência" : "Usar como referência"}
                  className={cn(
                    "absolute top-1.5 right-1.5 w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer disabled:cursor-default",
                    isAdded ? "bg-emerald-500/90 text-white opacity-100" : "bg-black/60 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-purple-600/90"
                  )}
                >
                  {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : isAdded ? <Check className="w-3 h-3" /> : <ImagePlus className="w-3 h-3" />}
                </button>
              )}
              <p className="text-[10px] text-white/40 group-hover:text-white/70 px-2 py-1.5 truncate">{slide.label}</p>
            </div>
          );
        })}
      </div>

      {openIndex !== null && (
        <Lightbox
          items={example.slides}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      )}
    </div>
  );
}
