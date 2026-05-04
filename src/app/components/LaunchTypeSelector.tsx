"use client";

import { cn } from "@/lib/utils";
import { Rocket, Zap, Sprout, PlayCircle, Repeat } from "lucide-react";
import type { StrategyId } from "../lib/types-kit";

const TYPES: {
  id: StrategyId;
  label: string;
  tagline: string;
  bestFor: string;
  duration: string;
  complexity: "Basico" | "Intermediario" | "Avancado";
  icon: React.ElementType;
  color: string;
  bg: string;
}[] = [
  {
    id: "classico",
    label: "Classico",
    tagline: "O metodo que movimentou bilhoes no mercado",
    bestFor: "Produtos novos com lista de leads aquecida",
    duration: "14-21 dias",
    complexity: "Intermediario",
    icon: Rocket,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    id: "meteorico",
    label: "Meteorico",
    tagline: "48h de abertura. Urgencia real. Conversao maxima",
    bestFor: "Relancamentos e ofertas ja validadas",
    duration: "5-7 dias",
    complexity: "Basico",
    icon: Zap,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  {
    id: "semente",
    label: "Semente",
    tagline: "Lance antes de criar — valide com quem paga",
    bestFor: "Primeira vez vendendo, produto ainda em criacao",
    duration: "7-14 dias",
    complexity: "Basico",
    icon: Sprout,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    id: "pago-vsl",
    label: "Pago / VSL",
    tagline: "Trafego frio, oferta direta, venda imediata",
    bestFor: "Escala com VSL e funil de clique unico",
    duration: "Continuo",
    complexity: "Avancado",
    icon: PlayCircle,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
  {
    id: "perpetuo",
    label: "Perpetuo",
    tagline: "Estrutura dos grandes lançamentos, no automatico",
    bestFor: "Produto consolidado pronto para escalar",
    duration: "Continuo",
    complexity: "Avancado",
    icon: Repeat,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
];

const COMPLEXITY_COLOR: Record<string, string> = {
  Basico: "text-emerald-400/70",
  Intermediario: "text-yellow-400/70",
  Avancado: "text-pink-400/70",
};

interface LaunchTypeSelectorProps {
  selected: StrategyId | null;
  onSelect: (id: StrategyId) => void;
  className?: string;
}

export function LaunchTypeSelector({ selected, onSelect, className }: LaunchTypeSelectorProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-2", className)}>
      {TYPES.map((type) => {
        const Icon = type.icon;
        const isSelected = selected === type.id;

        return (
          <button
            key={type.id}
            onClick={() => onSelect(type.id)}
            className={cn(
              "w-full text-left px-4 py-3.5 rounded-xl border transition-all cursor-pointer group",
              isSelected
                ? "bg-purple-500/10 border-purple-500/40 shadow-[0_0_0_1px_rgba(168,85,247,0.2)]"
                : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.10]"
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "p-2 rounded-lg mt-0.5 transition-colors shrink-0",
                  isSelected
                    ? `${type.bg} ${type.color}`
                    : "bg-white/[0.06] text-white/40 group-hover:text-white/60"
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-[13px] font-semibold transition-colors",
                      isSelected ? "text-white" : "text-white/70 group-hover:text-white/90"
                    )}
                  >
                    {type.label}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("text-[9px] font-medium", COMPLEXITY_COLOR[type.complexity])}>
                      {type.complexity}
                    </span>
                    <span className="text-[9px] text-white/25">{type.duration}</span>
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1.5 4L3.5 6L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{type.tagline}</p>
                <p className="text-[10px] text-white/25 mt-1">{type.bestFor}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
