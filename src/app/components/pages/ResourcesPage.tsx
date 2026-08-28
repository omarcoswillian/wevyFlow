"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "../../lib/templates";
import { Sparkles, ArrowRight, Layout } from "lucide-react";

interface ResourcesPageProps {
  onSelectTemplate: (prompt: string) => void;
}

export function ResourcesPage({ onSelectTemplate }: ResourcesPageProps) {
  const searchParams = useSearchParams();
  const paramCategory = searchParams.get("categoria") ?? "captura";
  const [activeCategory, setActiveCategory] = useState(paramCategory);

  useEffect(() => {
    setActiveCategory(paramCategory);
  }, [paramCategory]);

  const filtered = useMemo(
    () => TEMPLATES.filter(t => t.category === activeCategory),
    [activeCategory]
  );

  const categoryLabel = TEMPLATE_CATEGORIES.find(c => c.id === activeCategory)?.label ?? "Templates";

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">

      {/* Header */}
      <div className="px-8 pt-6 pb-4 shrink-0 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-white/70 tracking-tight">{categoryLabel}</h2>
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
          {TEMPLATE_CATEGORIES.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                activeCategory === cat.id
                  ? "bg-purple-600/20 text-purple-300"
                  : "text-white/35 hover:text-white/60"
              )}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
              <Layout className="w-5 h-5 text-white/15" />
            </div>
            <p className="text-[13px] font-semibold text-white/30 mb-1">Nenhum template aqui ainda</p>
            <p className="text-[11px] text-white/20">Em breve novos templates nesta categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-5">
            {filtered.map(template => {
              const isReady = template.tags.includes("pronto");
              return (
                <div key={template.id}
                  className="group flex flex-col rounded-2xl border border-white/[0.06] hover:border-purple-500/25 bg-white/[0.02] hover:bg-white/[0.03] transition-all overflow-hidden">

                  {/* Preview */}
                  <div className="relative h-[320px] overflow-hidden border-b border-white/[0.04] bg-white/[0.02]">
                    {isReady && (
                      <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-green-600 text-[9px] font-bold text-white uppercase tracking-wide shadow-lg">
                        Pronto
                      </span>
                    )}
                    {template.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={template.thumbnail}
                        alt={template.label}
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-500/[0.08] via-transparent to-pink-500/[0.05] flex flex-col items-center justify-center gap-3 px-4 text-center">
                        <Sparkles className="w-7 h-7 text-white/[0.12]" />
                        <span className="text-[11px] font-medium text-white/30 leading-snug">{template.label}</span>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="p-3">
                    <p className="px-1 pb-2 text-[11px] font-medium text-white/50 truncate" title={template.label}>
                      {template.label}
                    </p>
                    <button
                      onClick={() => onSelectTemplate(template.prompt)}
                      className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-xl bg-purple-600/[0.12] border border-purple-500/20 text-purple-300 text-[11px] font-semibold cursor-pointer hover:bg-purple-600/20 hover:border-purple-500/35 transition-all"
                    >
                      Usar este template <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
