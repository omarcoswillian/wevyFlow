"use client";

import { useState } from "react";
import { cn } from "../../lib/cn";

interface RefinementInputProps {
  onRefine: (request: string) => void;
  onNewGeneration: () => void;
  isRefining: boolean;
}

const SUGGESTIONS = [
  "Mude as cores para azul",
  "Aumente o título",
  "Adicione mais espaçamento",
  "Mude a fonte para Montserrat",
  "Escureça o fundo",
  "Adicione um formulário",
];

export function RefinementInput({ onRefine, onNewGeneration, isRefining }: RefinementInputProps) {
  const [request, setRequest] = useState("");

  const handleSubmit = () => {
    if (request.trim() && !isRefining) {
      onRefine(request.trim());
      setRequest("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 border-t border-wf-border animate-slide-in-up">
      <div className="flex items-center gap-2 mb-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-wf-accent">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        <label className="text-[10px] font-semibold text-wf-accent uppercase tracking-widest">
          Refinar resultado
        </label>
      </div>

      {/* Quick suggestions */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setRequest(s)}
            className="px-2 py-1 rounded-lg bg-wf-surface border border-wf-border text-[10px] text-wf-text-muted hover:border-wf-accent/50 hover:text-wf-accent transition-all cursor-pointer"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Refinement input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="O que você quer mudar?"
          className="flex-1 bg-wf-surface border border-wf-border rounded-xl px-3 py-2.5 text-sm text-wf-text placeholder:text-wf-text-muted/40 focus:outline-none focus:border-wf-accent transition-colors"
        />
        <button
          onClick={handleSubmit}
          disabled={isRefining || !request.trim()}
          className={cn(
            "px-4 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer shrink-0",
            isRefining || !request.trim()
              ? "bg-wf-accent/20 text-wf-accent/40 cursor-not-allowed"
              : "bg-wf-accent text-white hover:bg-wf-accent/80"
          )}
        >
          {isRefining ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="56" strokeDashoffset="14" />
            </svg>
          ) : (
            "Refinar"
          )}
        </button>
      </div>

      {/* New generation button */}
      <button
        onClick={onNewGeneration}
        className="w-full mt-2 py-2 rounded-xl text-xs font-medium text-wf-text-muted hover:text-wf-text hover:bg-wf-surface-hover transition-all cursor-pointer"
      >
        Descartar e criar nova geração
      </button>
    </div>
  );
}
