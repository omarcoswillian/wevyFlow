"use client";

import { useState } from "react";
import { cn } from "../../lib/cn";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "../../lib/templates";
import { TemplateCategory } from "../../lib/types";

interface TemplateGridProps {
  onSelectTemplate: (prompt: string) => void;
}

export function TemplateGrid({ onSelectTemplate }: TemplateGridProps) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>("vendas");

  const filteredTemplates = TEMPLATES.filter((t) => t.category === activeCategory);

  return (
    <div className="p-4">
      <label className="text-[10px] font-semibold text-wf-text-muted uppercase tracking-widest mb-3 block">
        Templates rápidos
      </label>

      {/* Category tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {TEMPLATE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all cursor-pointer",
              activeCategory === cat.id
                ? "bg-wf-primary/15 text-wf-primary"
                : "text-wf-text-muted hover:bg-wf-surface-hover hover:text-wf-text"
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template cards */}
      <div className="grid grid-cols-2 gap-2">
        {filteredTemplates.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelectTemplate(t.prompt)}
            className="group relative p-3 rounded-xl border border-wf-border bg-wf-surface text-left transition-all cursor-pointer hover:border-wf-primary/50 hover:bg-wf-surface-hover hover:shadow-lg hover:shadow-wf-primary/5"
          >
            <span className="text-lg mb-1 block">◻</span>
            <span className="text-xs font-medium text-wf-text group-hover:text-wf-primary transition-colors">
              {t.label}
            </span>
            {/* Hover overlay */}
            <div className="absolute inset-0 rounded-xl bg-wf-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </button>
        ))}
      </div>
    </div>
  );
}
