"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KvExample } from "../../lib/kv-examples";

export function KvExampleShowcase({ example }: { example: KvExample }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="w-full max-w-[760px] mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4">
        <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        <p className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">
          Exemplo real — {example.projectName} · {example.clientName}
        </p>
      </div>
      <p className="text-[11px] text-white/30 px-4 mt-1">Um brand book completo gerado com a mesma estrutura que você vai construir aqui.</p>

      <div className="flex gap-3 overflow-x-auto px-4 py-4 scrollbar-none">
        {example.slides.map((slide, i) => (
          <button
            key={slide.path}
            onClick={() => setOpenIndex(i)}
            className="group shrink-0 w-[150px] flex flex-col rounded-xl overflow-hidden border border-white/[0.06] hover:border-purple-500/30 transition-all cursor-pointer text-left"
          >
            <div className="relative h-[90px] bg-white/[0.03] overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.path} alt={slide.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            </div>
            <p className="text-[10px] text-white/40 group-hover:text-white/70 px-2 py-1.5 truncate">{slide.label}</p>
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <Lightbox
          slides={example.slides}
          index={openIndex}
          onClose={() => setOpenIndex(null)}
          onNavigate={setOpenIndex}
        />
      )}
    </div>
  );
}

function Lightbox({
  slides,
  index,
  onClose,
  onNavigate,
}: {
  slides: KvExample["slides"];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const slide = slides[index];
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/50 hover:text-white cursor-pointer">
          <X className="w-5 h-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slide.path} alt={slide.label} className="w-full max-h-[75vh] object-contain rounded-xl" />
        <div className="flex items-center gap-4 mt-4">
          <button
            onClick={() => onNavigate((index - 1 + slides.length) % slides.length)}
            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.14] flex items-center justify-center text-white/60 hover:text-white cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className="text-[12px] text-white/50">{slide.label} — {index + 1}/{slides.length}</p>
          <button
            onClick={() => onNavigate((index + 1) % slides.length)}
            className={cn("w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.14] flex items-center justify-center text-white/60 hover:text-white cursor-pointer transition-colors")}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
