"use client";

import { TEMPLATES, TEMPLATE_CATEGORIES } from "../../lib/templates";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

interface ResourcesPageProps {
  onSelectTemplate: (prompt: string) => void;
}

// Visual gradient schemes for each template (more impactful than tiny iframes)
const TEMPLATE_VISUALS: Record<string, { gradient: string; mockupType: "hero-photo" | "saas" | "cards" | "form" | "blog" | "portfolio" | "minimal"; ready?: boolean }> = {
  "ready-lp-vendas": { gradient: "from-gray-950 via-orange-950/30 to-gray-950", mockupType: "saas", ready: true },
  "ready-hero-simples": { gradient: "from-gray-950 via-orange-950/20 to-gray-950", mockupType: "minimal", ready: true },
  "ready-urgencia": { gradient: "from-orange-600 via-orange-500 to-orange-600", mockupType: "minimal", ready: true },
  "ready-para-quem": { gradient: "from-gray-900 via-gray-800 to-gray-900", mockupType: "cards", ready: true },
  "ready-depoimentos": { gradient: "from-gray-950 via-amber-950/10 to-gray-950", mockupType: "cards", ready: true },
  "ready-oferta": { gradient: "from-gray-950 via-orange-950/20 to-gray-950", mockupType: "form", ready: true },
  "ready-faq": { gradient: "from-gray-900 via-gray-800 to-gray-900", mockupType: "minimal", ready: true },
  "ready-captura-premium": { gradient: "from-stone-200 via-stone-100 to-stone-50", mockupType: "hero-photo", ready: true },
  "vendas-lancamento": { gradient: "from-emerald-600 via-emerald-500 to-teal-400", mockupType: "saas" },
  "vendas-produto-fisico": { gradient: "from-amber-600 via-orange-500 to-yellow-400", mockupType: "cards" },
  "vendas-webinar": { gradient: "from-blue-700 via-blue-600 to-cyan-500", mockupType: "form" },
  "captura-premium-foto": { gradient: "from-gray-900 via-gray-800 to-gray-700", mockupType: "hero-photo" },
  "captura-vagas-abertas": { gradient: "from-green-900 via-emerald-800 to-green-700", mockupType: "hero-photo" },
  "captura-ebook": { gradient: "from-violet-700 via-purple-600 to-indigo-500", mockupType: "form" },
  "captura-lista-espera": { gradient: "from-gray-950 via-purple-950 to-gray-950", mockupType: "minimal" },
  "captura-quiz": { gradient: "from-purple-600 via-fuchsia-500 to-pink-500", mockupType: "cards" },
  "saas-dashboard": { gradient: "from-stone-200 via-stone-100 to-stone-50", mockupType: "saas" },
  "saas-ai": { gradient: "from-purple-900 via-violet-800 to-indigo-900", mockupType: "saas" },
  "blog-home": { gradient: "from-orange-500 via-pink-500 to-rose-500", mockupType: "blog" },
  "blog-post": { gradient: "from-slate-100 via-white to-slate-50", mockupType: "blog" },
  "portfolio-designer": { gradient: "from-white via-gray-50 to-gray-100", mockupType: "portfolio" },
  "portfolio-dev": { gradient: "from-gray-950 via-gray-900 to-emerald-950", mockupType: "portfolio" },
  "section-hero-split": { gradient: "from-indigo-600 via-purple-500 to-pink-500", mockupType: "saas" },
  "section-pricing": { gradient: "from-slate-100 via-white to-slate-100", mockupType: "cards" },
  "section-testimonials": { gradient: "from-amber-50 via-white to-amber-50", mockupType: "cards" },
  "section-features": { gradient: "from-sky-500 via-blue-500 to-indigo-600", mockupType: "cards" },
  "section-cta": { gradient: "from-gray-950 via-gray-900 to-gray-950", mockupType: "minimal" },
  "section-faq": { gradient: "from-white via-gray-50 to-white", mockupType: "minimal" },
};

function MockupOverlay({ type }: { type: string }) {
  switch (type) {
    case "hero-photo":
      return (
        <div className="absolute inset-0 flex items-end">
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="relative z-10 p-5 max-w-[60%]">
            <div className="w-8 h-1 bg-white/30 rounded mb-2" />
            <div className="w-full h-2.5 bg-white/90 rounded mb-1.5" />
            <div className="w-3/4 h-2.5 bg-white/90 rounded mb-3" />
            <div className="w-1/2 h-1 bg-white/30 rounded mb-3" />
            <div className="w-20 h-5 bg-emerald-500 rounded-md" />
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-20 rounded-full bg-white/10 backdrop-blur-sm" />
        </div>
      );
    case "saas":
      return (
        <div className="absolute inset-3 flex items-center justify-center">
          <div className="w-[85%] bg-white/95 dark:bg-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur">
            <div className="flex items-center gap-1 px-3 py-1.5 bg-black/5 dark:bg-white/5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            </div>
            <div className="p-3 flex gap-2">
              <div className="w-10 space-y-1.5">
                {[...Array(4)].map((_, i) => <div key={i} className="h-1 bg-black/10 dark:bg-white/10 rounded-full" style={{ width: `${60 + i * 10}%` }} />)}
              </div>
              <div className="flex-1 space-y-2">
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="bg-emerald-500/15 rounded-md p-1.5"><div className="h-2 w-6 bg-emerald-500/40 rounded" /></div>
                  <div className="bg-blue-500/15 rounded-md p-1.5"><div className="h-2 w-6 bg-blue-500/40 rounded" /></div>
                  <div className="bg-purple-500/15 rounded-md p-1.5"><div className="h-2 w-6 bg-purple-500/40 rounded" /></div>
                </div>
                <div className="flex gap-1 items-end h-6">
                  {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                    <div key={i} className="flex-1 bg-black/10 dark:bg-white/10 rounded-sm" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    case "form":
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[55%] bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 p-4 space-y-2">
            <div className="w-2/3 h-2 bg-white/60 rounded mx-auto mb-3" />
            <div className="h-4 bg-white/5 border border-white/10 rounded-lg" />
            <div className="h-4 bg-white/5 border border-white/10 rounded-lg" />
            <div className="h-5 bg-emerald-500/80 rounded-lg mt-1" />
          </div>
        </div>
      );
    case "cards":
      return (
        <div className="absolute inset-3 flex items-end justify-center gap-2 pb-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn("w-[28%] bg-white/90 dark:bg-white/10 rounded-xl shadow-lg p-2 backdrop-blur", i === 1 && "-translate-y-2")}>
              <div className="w-full h-4 bg-black/5 dark:bg-white/5 rounded-md mb-1.5" />
              <div className="w-3/4 h-1 bg-black/20 dark:bg-white/20 rounded mb-1" />
              <div className="w-1/2 h-1 bg-black/10 dark:bg-white/10 rounded" />
            </div>
          ))}
        </div>
      );
    case "blog":
      return (
        <div className="absolute inset-3 flex items-center justify-center">
          <div className="w-[80%] space-y-2">
            <div className="w-full h-12 bg-white/20 rounded-xl" />
            <div className="grid grid-cols-3 gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-white/90 dark:bg-white/10 rounded-lg overflow-hidden shadow-md">
                  <div className="h-5 bg-black/10 dark:bg-white/5" />
                  <div className="p-1.5"><div className="w-full h-1 bg-black/20 dark:bg-white/20 rounded mb-0.5" /><div className="w-2/3 h-1 bg-black/10 dark:bg-white/10 rounded" /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "portfolio":
      return (
        <div className="absolute inset-3 flex flex-col items-start justify-end p-3">
          <div className="w-2/3 h-3 bg-black/80 dark:bg-white/80 rounded mb-1.5" />
          <div className="w-1/3 h-1.5 bg-black/30 dark:bg-white/30 rounded mb-4" />
          <div className="grid grid-cols-2 gap-2 w-full">
            <div className="h-10 bg-black/10 dark:bg-white/10 rounded-lg" />
            <div className="h-10 bg-black/10 dark:bg-white/10 rounded-lg" />
          </div>
        </div>
      );
    case "minimal":
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="w-1/2 h-2.5 bg-white/70 rounded" />
          <div className="w-1/3 h-1.5 bg-white/30 rounded" />
          <div className="w-16 h-5 bg-white/15 border border-white/20 rounded-full mt-1" />
        </div>
      );
    default:
      return null;
  }
}

export function ResourcesPage({ onSelectTemplate }: ResourcesPageProps) {
  const [cat, setCat] = useState(TEMPLATE_CATEGORIES[0].id);
  const filtered = TEMPLATES.filter((t) => t.category === cat);

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-1">Resources</h1>
      <p className="text-sm text-white/40 mb-8">Comece a partir de um template para construir seu próximo projeto</p>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TEMPLATE_CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)}
            className={cn("px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
              cat === c.id ? "bg-white/10 text-white" : "text-white/30 hover:text-white/50 hover:bg-white/[0.04]")}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((t) => {
          const visual = TEMPLATE_VISUALS[t.id] || { gradient: "from-gray-700 to-gray-900", mockupType: "minimal" as const };

          return (
            <button key={t.id} onClick={() => onSelectTemplate(t.prompt)}
              className="group text-left rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15] transition-all cursor-pointer hover:shadow-xl hover:shadow-black/30 hover:scale-[1.02] active:scale-[0.99]">
              {/* Visual preview */}
              <div className={cn("h-48 relative overflow-hidden bg-gradient-to-br", visual.gradient)}>
                <MockupOverlay type={visual.mockupType} />
                {/* Ready badge */}
                {visual.ready && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-lg">
                    Pronto
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 bg-white text-black px-5 py-2 rounded-full text-xs font-semibold shadow-xl flex items-center gap-1.5">
                    {visual.ready ? "Usar agora" : "Usar template"} <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
              {/* Info */}
              <div className="p-4">
                <h3 className="text-[13px] font-semibold text-white/85 group-hover:text-white transition-colors">{t.label}</h3>
                <p className="text-[11px] text-white/35 mt-1 leading-relaxed line-clamp-2">{t.description}</p>
                <div className="flex gap-1 mt-2.5 flex-wrap">
                  {t.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-[9px] text-white/25">{tag}</span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
