"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxItem {
  path: string;
  label: string;
}

/** Popup de imagem em tela cheia com navegação prev/next — extraído de
 * KvExampleShowcase (a Biblioteca já usava isso) pra ser reaproveitado em
 * qualquer lugar que precise "abrir uma imagem grande sem sair da tela
 * atual" (pedido do dono: "não quero abrir uma página diferente, quero que
 * abra um popup... igual temos na biblioteca da KV"). */
export function Lightbox({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: LightboxItem[];
  index: number;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const item = items[index];
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
        <button onClick={onClose} className="absolute -top-10 right-0 text-white/50 hover:text-white cursor-pointer">
          <X className="w-5 h-5" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.path} alt={item.label} className="w-full max-h-[75vh] object-contain rounded-xl" />
        {items.length > 1 && (
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={() => onNavigate((index - 1 + items.length) % items.length)}
              className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.14] flex items-center justify-center text-white/60 hover:text-white cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p className="text-[12px] text-white/50">{item.label} — {index + 1}/{items.length}</p>
            <button
              onClick={() => onNavigate((index + 1) % items.length)}
              className={cn("w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.14] flex items-center justify-center text-white/60 hover:text-white cursor-pointer transition-colors")}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
        {items.length === 1 && (
          <p className="text-[12px] text-white/50 mt-4">{item.label}</p>
        )}
      </div>
    </div>
  );
}
