"use client";

import { cn } from "@/lib/utils";
import { HistoryEntry, Platform } from "../lib/types";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  entries: HistoryEntry[];
  onRestore: (entry: HistoryEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const PLATFORM_BADGES: Record<Platform, { label: string; color: string }> = {
  html: { label: "HTML", color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  elementor: { label: "Elementor", color: "bg-pink-500/15 text-pink-400 border-pink-500/20" },
  webflow: { label: "Webflow", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "agora mesmo";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export function HistoryPanel({ isOpen, onClose, entries, onRestore, onRemove, onClear }: HistoryPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full z-50 flex flex-col bg-wf-bg border-l border-wf-border shadow-2xl",
          "animate-slide-in-right"
        )}
        style={{ width: "var(--wf-history-width)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-wf-border shrink-0">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-wf-primary">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h2 className="font-semibold text-sm text-wf-text">Histórico</h2>
            <span className="px-1.5 py-0.5 rounded-full bg-wf-primary/15 text-wf-primary text-[10px] font-medium">
              {entries.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-wf-text-muted hover:text-wf-text hover:bg-wf-surface-hover transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-wf-text-muted p-6 text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-30">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <p className="text-sm font-medium mb-1">Nenhuma geração ainda</p>
              <p className="text-xs opacity-60">Crie seu primeiro layout!</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {entries.map((entry) => {
                const badge = PLATFORM_BADGES[entry.platform];
                return (
                  <div
                    key={entry.id}
                    className="group p-3 rounded-xl border border-wf-border bg-wf-surface hover:border-wf-primary/30 hover:bg-wf-surface-hover transition-all cursor-pointer"
                    onClick={() => onRestore(entry)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-medium border", badge.color)}>
                        {badge.label}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-wf-text-muted">
                          {timeAgo(entry.createdAt)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemove(entry.id);
                          }}
                          className="p-0.5 rounded text-wf-text-muted/30 hover:text-wf-danger opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-wf-text leading-relaxed line-clamp-2">
                      {entry.prompt}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {entries.length > 0 && (
          <div className="p-3 border-t border-wf-border shrink-0">
            <button
              onClick={onClear}
              className="w-full py-2 rounded-xl text-xs font-medium text-wf-danger/70 hover:text-wf-danger hover:bg-wf-danger/5 transition-all cursor-pointer"
            >
              Limpar todo o histórico
            </button>
          </div>
        )}
      </div>
    </>
  );
}
