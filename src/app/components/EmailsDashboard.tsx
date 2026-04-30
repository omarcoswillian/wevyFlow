"use client";

import { useState } from "react";
import { Mail, Plus, Rocket, Zap, Sprout, PlayCircle, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppContext } from "../(app)/_context";
import { EmailSequencePanel } from "./EmailSequencePanel";
import type { BrandInfo, StrategyId } from "../lib/types-kit";

const STRATEGY_ICONS: Record<StrategyId, React.ElementType> = {
  classico: Rocket,
  meteorico: Zap,
  semente: Sprout,
  "pago-vsl": PlayCircle,
  perpetuo: Repeat,
};

const EMPTY_BRAND: BrandInfo = {
  productName: "",
  niche: "",
  targetAudience: "",
  transformation: "",
  primaryColor: "#a78bfa",
  secondaryColor: "#6366f1",
  fontChoice: "sora",
  stylePreset: "dark-premium",
};

export function EmailsDashboard() {
  const { launchKits, setShowLaunchWizard } = useAppContext();

  const [selectedKitId, setSelectedKitId] = useState<string | "manual">(
    launchKits.length > 0 ? launchKits[0].id : "manual"
  );

  // Manual form state (used when no kit is selected)
  const [manual, setManual] = useState<BrandInfo>({ ...EMPTY_BRAND });
  const [manualReady, setManualReady] = useState(false);

  const selectedKit = launchKits.find((k) => k.id === selectedKitId);
  const activeBrand: BrandInfo | null = selectedKit
    ? selectedKit.brandInfo
    : manualReady
    ? manual
    : null;

  const manualValid =
    manual.productName.trim().length > 1 &&
    manual.niche.trim().length > 1 &&
    manual.targetAudience.trim().length > 1 &&
    manual.transformation.trim().length > 1;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-[20px] font-bold text-white">Sequências de Email</h1>
            <p className="text-[12px] text-white/40 mt-0.5">
              Pré-lançamento, vendas e recuperação de carrinho
            </p>
          </div>
        </div>

        {/* Kit selector */}
        <div className="mb-6">
          <p className="text-[9px] uppercase tracking-widest text-white/25 font-semibold mb-2">
            Para qual produto?
          </p>

          <div className="flex flex-wrap gap-2">
            {launchKits.map((kit) => {
              const Icon = STRATEGY_ICONS[kit.strategyId] ?? Rocket;
              return (
                <button
                  key={kit.id}
                  onClick={() => { setSelectedKitId(kit.id); setManualReady(false); }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-medium transition-all cursor-pointer",
                    selectedKitId === kit.id && selectedKitId !== "manual"
                      ? "bg-purple-500/15 border-purple-500/30 text-white"
                      : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/15"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {kit.brandInfo.productName}
                </button>
              );
            })}

            <button
              onClick={() => { setSelectedKitId("manual"); setManualReady(false); }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border text-[12px] font-medium transition-all cursor-pointer",
                selectedKitId === "manual"
                  ? "bg-white/[0.06] border-white/[0.12] text-white"
                  : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/15"
              )}
            >
              <Mail className="w-3.5 h-3.5" />
              Informar manualmente
            </button>

            <button
              onClick={() => setShowLaunchWizard(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-white/[0.08] text-white/25 hover:text-white/50 hover:border-white/20 text-[12px] font-medium transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Novo kit
            </button>
          </div>
        </div>

        {/* Manual form */}
        {selectedKitId === "manual" && !manualReady && (
          <div className="mb-6 rounded-xl bg-[#18181b] border border-white/[0.06] p-4 space-y-3">
            <p className="text-[11px] text-white/40">Preencha o briefing do produto para gerar as sequências:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium block mb-1">Nome do produto</label>
                <input
                  value={manual.productName}
                  onChange={(e) => setManual((p) => ({ ...p, productName: e.target.value }))}
                  placeholder="Ex: Método Alpha"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium block mb-1">Nicho</label>
                <input
                  value={manual.niche}
                  onChange={(e) => setManual((p) => ({ ...p, niche: e.target.value }))}
                  placeholder="Ex: emagrecimento, finanças"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium block mb-1">Público-alvo</label>
                <input
                  value={manual.targetAudience}
                  onChange={(e) => setManual((p) => ({ ...p, targetAudience: e.target.value }))}
                  placeholder="Ex: mulheres 30-45 anos"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium block mb-1">Transformação prometida</label>
                <input
                  value={manual.transformation}
                  onChange={(e) => setManual((p) => ({ ...p, transformation: e.target.value }))}
                  placeholder="Ex: perder 10kg em 60 dias"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors"
                />
              </div>
            </div>
            <button
              onClick={() => setManualReady(true)}
              disabled={!manualValid}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all cursor-pointer",
                manualValid
                  ? "bg-purple-600 hover:bg-purple-500 text-white"
                  : "bg-white/[0.04] text-white/20 cursor-not-allowed"
              )}
            >
              Continuar
            </button>
          </div>
        )}

        {/* Email panel */}
        {activeBrand && (
          <div>
            {/* Selected brand info pill */}
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] w-fit">
              <Mail className="w-3.5 h-3.5 text-white/30" />
              <span className="text-[12px] text-white/60 font-medium">{activeBrand.productName}</span>
              <span className="text-white/15">·</span>
              <span className="text-[11px] text-white/30">{activeBrand.niche}</span>
            </div>
            <EmailSequencePanel brandInfo={activeBrand} />
          </div>
        )}

        {/* Empty state — no kits, manual not filled */}
        {!activeBrand && selectedKitId !== "manual" && launchKits.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <Mail className="w-6 h-6 text-white/20" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-white/60 mb-1">Nenhum kit de lançamento ainda</p>
              <p className="text-[12px] text-white/30 max-w-xs">
                Crie um kit de lançamento para gerar as sequências automaticamente, ou use a opção "Informar manualmente".
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
