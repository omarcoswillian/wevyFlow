"use client";

import { cn } from "../../lib/cn";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
}

const MAX_CHARS = 2000;

export function PromptInput({ value, onChange, onGenerate, isLoading }: PromptInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!isLoading && value.trim()) onGenerate();
    }
  };

  return (
    <div className="p-4 border-b border-wf-border">
      <label className="text-[10px] font-semibold text-wf-text-muted uppercase tracking-widest mb-3 block">
        Descreva o que você precisa
      </label>

      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={handleKeyDown}
          placeholder="Ex: Crie uma hero section premium para uma landing page de lançamento digital com headline impactante, subtítulo persuasivo, botão CTA vibrante..."
          className="w-full h-36 bg-wf-surface border border-wf-border rounded-xl p-3 pr-3 pb-8 text-sm text-wf-text placeholder:text-wf-text-muted/40 resize-none focus:outline-none focus:border-wf-primary focus:shadow-lg focus:shadow-wf-primary/5 transition-all"
        />
        {/* Character count */}
        <span className={cn(
          "absolute bottom-2 right-3 text-[10px]",
          value.length > MAX_CHARS * 0.9 ? "text-wf-danger" : "text-wf-text-muted/40"
        )}>
          {value.length} / {MAX_CHARS}
        </span>
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={isLoading || !value.trim()}
        className={cn(
          "w-full mt-3 py-3 rounded-xl font-semibold text-sm text-white transition-all cursor-pointer relative overflow-hidden",
          isLoading || !value.trim()
            ? "bg-wf-primary/30 cursor-not-allowed"
            : "bg-gradient-to-r from-wf-primary to-wf-primary-hover hover:shadow-xl hover:shadow-wf-primary/20 hover:scale-[1.01] active:scale-[0.99] glow-pulse"
        )}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="56" strokeDashoffset="14" />
            </svg>
            <span className="loading-dots">Gerando layout</span>
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Gerar Layout
          </span>
        )}
      </button>
    </div>
  );
}
