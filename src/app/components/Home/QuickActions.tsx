"use client";

import { cn } from "@/lib/utils";
import { Rocket, Layout, Mail, Paintbrush } from "lucide-react";

export type HomeMode = "kit" | "page" | "emails" | "criativos";

const ACTIONS: { id: HomeMode; label: string; icon: React.ElementType; primary?: boolean }[] = [
  { id: "kit", label: "Kit Completo", icon: Rocket, primary: true },
  { id: "page", label: "Landing Page", icon: Layout },
  { id: "emails", label: "Emails", icon: Mail },
  { id: "criativos", label: "Criativos", icon: Paintbrush },
];

interface QuickActionsProps {
  activeMode: HomeMode | null;
  onSelect: (mode: HomeMode) => void;
  className?: string;
}

export function QuickActions({ activeMode, onSelect, className }: QuickActionsProps) {
  return (
    <div className={cn("w-full max-w-[580px] flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.05]", className)}>
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        const isActive = activeMode === action.id;

        return (
          <button
            key={action.id}
            onClick={() => onSelect(action.id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
              isActive
                ? action.primary
                  ? "bg-purple-500/20 text-purple-300 shadow-[0_0_0_1px_rgba(168,85,247,0.2)]"
                  : "bg-white/[0.08] text-white/80"
                : "text-white/30 hover:text-white/55 hover:bg-white/[0.03]"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
