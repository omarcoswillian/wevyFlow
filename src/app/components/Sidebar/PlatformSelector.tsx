"use client";

import { cn } from "@/lib/utils";
import { Platform } from "../../lib/types";

interface PlatformSelectorProps {
  value: Platform;
  onChange: (platform: Platform) => void;
}

const PLATFORMS: { id: Platform; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    id: "html",
    label: "HTML Puro",
    desc: "Código limpo",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
        <line x1="14" y1="4" x2="10" y2="20" />
      </svg>
    ),
  },
  {
    id: "elementor",
    label: "Elementor",
    desc: "WordPress",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM9 16V8h2v8H9zm4-8h2v8h-2V8z" />
      </svg>
    ),
  },
  {
    id: "webflow",
    label: "Webflow",
    desc: "Embed code",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.802 8.56s-1.946 6.032-2.046 6.34c-.046-.372-1.108-6.34-1.108-6.34-1.774 0-2.71 1.242-3.252 2.59 0 0-1.312 3.466-1.38 3.642-.012-.182-.342-6.232-.342-6.232C8.4 7.296 6.6 8.56 6.6 8.56l1.236 8.88c1.866-.006 2.862-1.23 3.432-2.598 0 0 1.086-2.814 1.14-2.958.048.162 1.044 5.556 1.044 5.556 1.878-.006 2.88-1.164 3.468-2.508L20.4 8.56h-2.598z" />
      </svg>
    ),
  },
];

export function PlatformSelector({ value, onChange }: PlatformSelectorProps) {
  return (
    <div className="p-4 border-b border-wf-border">
      <label className="text-[10px] font-semibold text-wf-text-muted uppercase tracking-widest mb-3 block">
        Plataforma de destino
      </label>
      <div className="grid grid-cols-3 gap-2">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={cn(
              "relative p-3 rounded-xl border text-center transition-all cursor-pointer group",
              value === p.id
                ? "border-wf-primary bg-wf-primary/10 text-wf-primary shadow-lg shadow-wf-primary/5"
                : "border-wf-border bg-wf-surface text-wf-text-muted hover:border-wf-text-muted hover:bg-wf-surface-hover"
            )}
          >
            {value === p.id && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-wf-primary" />
            )}
            <div className="flex justify-center mb-1.5 transition-transform group-hover:scale-110">
              {p.icon}
            </div>
            <div className="text-xs font-semibold">{p.label}</div>
            <div className="text-[10px] mt-0.5 opacity-60">{p.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
