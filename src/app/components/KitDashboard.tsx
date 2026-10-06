"use client";

import { useRouter } from "next/navigation";
import { Plus, Rocket, Zap, Sprout, PlayCircle, Repeat, Trash2, ChevronRight, PenLine } from "lucide-react";
import { useAppContext } from "../(app)/_context";
import { LAUNCH_STRATEGIES, STRATEGY_MAP } from "../lib/launch-strategies";
import type { LaunchKit, StrategyId } from "../lib/types-kit";

const STRATEGY_ICONS: Record<StrategyId, React.ElementType> = {
  classico: Rocket,
  meteorico: Zap,
  semente: Sprout,
  "pago-vsl": PlayCircle,
  perpetuo: Repeat,
};


export function KitDashboard() {
  const { launchKits, deleteLaunchKit, openLaunchWizardForDraft, resumeLaunchWizard } = useAppContext();
  const router = useRouter();

  const openKit = (kit: LaunchKit) => {
    if (kit.status === "draft") {
      // Only a draft (no strategy/briefing confirmed yet) goes to the
      // wizard. `archived` must never go through it — closing the wizard
      // there would silently PATCH status back to 'draft', un-archiving it
      // by accident (see launches review item 1 / dashboard bypass).
      resumeLaunchWizard(kit.projectId);
    } else {
      // `active` opens the Hub; `archived` lands on the same URL, which
      // renders its own read-only view (see lancamentos/page.tsx).
      router.push(`/lancamentos?projectId=${kit.projectId}`);
    }
  };

  if (launchKits.length === 0) {
    return <EmptyState onNew={() => { openLaunchWizardForDraft({}).catch((e) => console.error(e)); }} />;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[20px] font-bold text-white">Kits de Lançamento</h1>
            <p className="text-[12px] text-white/40 mt-0.5">{launchKits.length} kit{launchKits.length !== 1 ? "s" : ""} criado{launchKits.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={() => { openLaunchWizardForDraft({}).catch((e) => console.error(e)); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Kit
          </button>
        </div>

        {/* kit list */}
        <div className="space-y-3">
          {launchKits.map((kit) => (
            <KitCard
              key={kit.id}
              kit={kit}
              onOpen={() => openKit(kit)}
              onDelete={() => deleteLaunchKit(kit.projectId).catch(() => {})}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Kit Card ──────────────────────────────────────────── */
function KitCard({
  kit, onOpen, onDelete,
}: {
  kit: LaunchKit;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const isDraft = kit.status === "draft";
  const isArchived = kit.status === "archived";
  const strategy = kit.strategyId ? STRATEGY_MAP[kit.strategyId] : null;
  const Icon = (kit.strategyId && STRATEGY_ICONS[kit.strategyId]) ?? Rocket;
  const done = kit.assets.filter((a) => a.status === "done").length;
  const total = kit.assets.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden hover:border-white/[0.1] transition-colors">
      <button
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer text-left"
        onClick={onOpen}
      >
        <div className={`p-2.5 rounded-xl shrink-0 ${isDraft || isArchived ? "bg-white/[0.06] text-white/40" : "bg-purple-500/10 text-purple-400"}`}>
          {isDraft ? <PenLine className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-white truncate">{kit.briefing.productName || "Lançamento sem nome"}</span>
            {isDraft ? (
              <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/40 text-[9px] font-semibold uppercase tracking-wide">Rascunho</span>
            ) : isArchived ? (
              <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/40 text-[9px] font-semibold uppercase tracking-wide">Arquivado</span>
            ) : (
              <span className="text-[10px] text-white/30 shrink-0">{strategy?.label}</span>
            )}
          </div>
          {isDraft ? (
            <p className="text-[10px] text-white/25 mt-1.5">Continue o briefing para ativar este lançamento</p>
          ) : isArchived ? (
            <p className="text-[10px] text-white/25 mt-1.5">Somente leitura</p>
          ) : (
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden max-w-[160px]">
                <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-white/30">{done}/{total} ativos</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); if (window.confirm("Apagar este kit?")) onDelete(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); if (window.confirm("Apagar este kit?")) onDelete(); } }}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/20 hover:text-red-400 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </div>
          <ChevronRight className="w-4 h-4 text-white/20" />
        </div>
      </button>
    </div>
  );
}


/* ── Empty State ───────────────────────────────────────── */
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-4">
          <Rocket className="w-7 h-7 text-purple-400" />
        </div>
        <h2 className="text-[16px] font-bold text-white mb-2">Nenhum kit ainda</h2>
        <p className="text-[12px] text-white/40 leading-relaxed mb-6">
          Crie seu primeiro kit de lançamento. O sistema monta automaticamente todos os ativos — criativos, carrosséis, emails e copy — baseados na sua estratégia.
        </p>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[13px] font-semibold transition-colors cursor-pointer mx-auto"
        >
          <Plus className="w-4 h-4" /> Criar Kit de Lançamento
        </button>

        <div className="mt-8 grid grid-cols-1 gap-2 text-left">
          {LAUNCH_STRATEGIES.map((s) => {
            const Icon = STRATEGY_ICONS[s.id];
            return (
              <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <Icon className="w-4 h-4 text-white/30 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold text-white/60">{s.label}</p>
                  <p className="text-[10px] text-white/30">{s.tagline}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
