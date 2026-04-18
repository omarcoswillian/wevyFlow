"use client";

import { cn } from "../lib/cn";

interface HeaderProps {
  onToggleHistory: () => void;
  historyCount: number;
}

export function Header({ onToggleHistory, historyCount }: HeaderProps) {
  return (
    <header className="relative border-b border-wf-border px-6 py-3 flex items-center justify-between shrink-0 bg-wf-bg header-gradient-border">
      <div className="flex items-center gap-3">
        {/* Logo */}
        <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-wf-primary to-wf-accent flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-wf-primary/20 group cursor-default">
          <span className="transition-transform group-hover:scale-110">W</span>
        </div>
        <div>
          <h1 className="text-lg font-bold text-wf-text leading-tight">
            Wevy<span className="text-wf-primary">Flow</span>
          </h1>
          <p className="text-[10px] text-wf-text-muted leading-none">
            Gerador de Layouts com IA
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Shortcut hint */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-wf-surface border border-wf-border text-[10px] text-wf-text-muted">
          <kbd className="px-1 py-0.5 rounded bg-wf-bg border border-wf-border text-[9px]">⌘</kbd>
          <kbd className="px-1 py-0.5 rounded bg-wf-bg border border-wf-border text-[9px]">↵</kbd>
          <span>gerar</span>
        </div>

        {/* History button */}
        <button
          onClick={onToggleHistory}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
            "border border-wf-border bg-wf-surface text-wf-text-muted hover:border-wf-primary hover:text-wf-primary"
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Histórico
          {historyCount > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-wf-primary/20 text-wf-primary text-[10px] font-semibold">
              {historyCount}
            </span>
          )}
        </button>

        {/* Version badge */}
        <span className="px-2 py-0.5 rounded-full bg-wf-primary/10 text-wf-primary text-[10px] font-medium border border-wf-primary/20">
          v2.0 Beta
        </span>
      </div>
    </header>
  );
}
