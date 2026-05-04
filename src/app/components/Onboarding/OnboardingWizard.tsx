"use client";

import { useState, useCallback, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Rocket, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { LaunchTypeSelector } from "../LaunchTypeSelector";
import { useAppContext } from "../../(app)/_context";
import { LAUNCH_STRATEGIES } from "../../lib/launch-strategies";
import type { BrandInfo, LaunchKit, StrategyId } from "../../lib/types-kit";

type OnboardingStep = 1 | 2 | 3 | 4;

interface OnboardingState {
  step: OnboardingStep;
  productName: string;
  niche: string;
  targetAudience: string;
  transformation: string;
  primaryColor: string;
  secondaryColor: string;
  selectedStrategy: StrategyId | null;
}

const DEFAULT_STATE: OnboardingState = {
  step: 1,
  productName: "",
  niche: "",
  targetAudience: "",
  transformation: "",
  primaryColor: "#a78bfa",
  secondaryColor: "#6366f1",
  selectedStrategy: null,
};

const COLOR_PAIRS = [
  { primary: "#a78bfa", secondary: "#6366f1", label: "Roxo" },
  { primary: "#3b82f6", secondary: "#06b6d4", label: "Azul" },
  { primary: "#ec4899", secondary: "#f43f5e", label: "Rosa" },
  { primary: "#f97316", secondary: "#eab308", label: "Laranja" },
  { primary: "#10b981", secondary: "#14b8a6", label: "Verde" },
  { primary: "#f1f5f9", secondary: "#e2e8f0", label: "Branco" },
];

const TOTAL_STEPS = 4;

const STEP_TITLES: Record<OnboardingStep, string> = {
  1: "Bem-vindo",
  2: "Seu produto",
  3: "Estrategia",
  4: "Confirmacao",
};

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-white/50 mb-1.5">
        {label}
        {required && <span className="text-purple-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/90 placeholder:text-white/25 focus:outline-none focus:border-purple-500/40 transition-colors";

function StepWelcome({ userName }: { userName: string | null }) {
  return (
    <div className="flex flex-col items-center text-center gap-6 py-4">
      <div className="w-16 h-16 rounded-2xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
        <Rocket className="w-8 h-8 text-purple-400" />
      </div>
      <div>
        <h2 className="text-[20px] font-semibold text-white mb-2">
          {userName ? `Bem-vindo, ${userName.split(" ")[0]}` : "Bem-vindo ao WevyFlow"}
        </h2>
        <p className="text-[13px] text-white/45 max-w-sm leading-relaxed">
          Em menos de 2 minutos vamos configurar seu primeiro kit de lancamento — com todas as
          paginas, criativos e emails prontos para gerar.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {[
          "Landing pages de alta conversao",
          "Criativos para redes sociais",
          "Sequencia de emails automatizada",
          "Identidade visual consistente",
        ].map((item) => (
          <div key={item} className="flex items-center gap-2.5 text-left">
            <div className="w-4 h-4 rounded-full bg-purple-500/20 flex items-center justify-center shrink-0">
              <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                <path
                  d="M1 3.5L3 5.5L6 1.5"
                  stroke="#a78bfa"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-[12px] text-white/55">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepProduct({
  state,
  onChange,
}: {
  state: OnboardingState;
  onChange: (patch: Partial<OnboardingState>) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[14px] font-semibold text-white mb-1">Sobre o seu produto</h3>
        <p className="text-[11px] text-white/40">
          Essas informacoes guiam a IA na criacao de todos os ativos do kit.
        </p>
      </div>

      <Field label="Nome do produto" required>
        <input
          value={state.productName}
          onChange={(e) => onChange({ productName: e.target.value })}
          placeholder="Ex: Metodo Forca Interior"
          className={inputCls}
          autoFocus
        />
      </Field>

      <Field label="Nicho" required>
        <input
          value={state.niche}
          onChange={(e) => onChange({ niche: e.target.value })}
          placeholder="Ex: Desenvolvimento pessoal, fitness, financas..."
          className={inputCls}
        />
      </Field>

      <Field label="Publico-alvo" required>
        <input
          value={state.targetAudience}
          onChange={(e) => onChange({ targetAudience: e.target.value })}
          placeholder="Ex: Mulheres 30-50 anos que querem emagrecer"
          className={inputCls}
        />
      </Field>

      <Field label="Transformacao prometida" required>
        <textarea
          value={state.transformation}
          onChange={(e) => onChange({ transformation: e.target.value })}
          rows={2}
          placeholder="Ex: Perca 10kg em 90 dias sem academia ou dietas restritivas"
          className={cn(inputCls, "resize-none")}
        />
      </Field>

      <div>
        <label className="block text-[11px] font-medium text-white/50 mb-2">
          Cor da marca
        </label>
        <div className="flex items-center gap-2 flex-wrap">
          {COLOR_PAIRS.map((cp) => (
            <button
              key={cp.primary}
              onClick={() => onChange({ primaryColor: cp.primary, secondaryColor: cp.secondary })}
              title={cp.label}
              className={cn(
                "w-7 h-7 rounded-lg border-2 transition-all cursor-pointer hover:scale-110",
                state.primaryColor === cp.primary
                  ? "border-white/60 scale-110 shadow-lg"
                  : "border-transparent"
              )}
              style={{ background: `linear-gradient(135deg, ${cp.primary}, ${cp.secondary})` }}
            />
          ))}
          <input
            type="color"
            value={state.primaryColor}
            onChange={(e) => onChange({ primaryColor: e.target.value })}
            className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border border-white/10"
            title="Cor personalizada"
          />
        </div>
      </div>
    </div>
  );
}

function StepStrategy({
  selected,
  onSelect,
}: {
  selected: StrategyId | null;
  onSelect: (id: StrategyId) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-[14px] font-semibold text-white mb-1">Estrategia de lancamento</h3>
        <p className="text-[11px] text-white/40">
          O kit sera montado com todos os ativos da estrategia escolhida.
        </p>
      </div>
      <LaunchTypeSelector selected={selected} onSelect={onSelect} />
    </div>
  );
}

function StepConfirm({
  state,
  isCreating,
}: {
  state: OnboardingState;
  isCreating: boolean;
}) {
  const strategy = state.selectedStrategy
    ? LAUNCH_STRATEGIES.find((s) => s.id === state.selectedStrategy)
    : null;

  const pages = strategy?.assets.filter((a) => a.type === "page") ?? [];
  const criativos = strategy?.assets.filter((a) => a.type === "criativo") ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[14px] font-semibold text-white mb-1">Tudo pronto</h3>
        <p className="text-[11px] text-white/40">Revise as informacoes antes de criar o kit.</p>
      </div>

      {isCreating ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <p className="text-[13px] text-white/50">Criando seu kit de lancamento...</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
            {[
              { label: "Produto", value: state.productName },
              { label: "Nicho", value: state.niche },
              { label: "Publico", value: state.targetAudience },
              { label: "Estrategia", value: strategy?.label ?? "" },
              {
                label: "Total de ativos",
                value: strategy
                  ? `${strategy.assets.length} (${pages.length} paginas · ${criativos.length} criativos)`
                  : "",
              },
            ].map(({ label, value }) =>
              value ? (
                <div key={label} className="flex items-start justify-between gap-4">
                  <span className="text-[11px] text-white/35 shrink-0">{label}</span>
                  <span className="text-[11px] text-white/80 text-right">{value}</span>
                </div>
              ) : null
            )}
          </div>

          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-md border border-white/20"
              style={{ background: state.primaryColor }}
            />
            <span className="text-[11px] text-white/40 font-mono">{state.primaryColor}</span>
            <div
              className="w-5 h-5 rounded-md border border-white/20"
              style={{ background: state.secondaryColor }}
            />
            <span className="text-[11px] text-white/40 font-mono">{state.secondaryColor}</span>
          </div>

          {strategy && (
            <div className="grid grid-cols-2 gap-2">
              {[
                { title: "Paginas", items: pages.map((a) => a.label) },
                { title: "Criativos", items: criativos.map((a) => a.label) },
              ].map(({ title, items }) => (
                <div
                  key={title}
                  className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3"
                >
                  <p className="text-[11px] font-semibold text-white/50 mb-2">
                    {title} ({items.length})
                  </p>
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li key={item} className="flex items-center gap-1.5 text-[10px] text-white/35">
                        <div className="w-1 h-1 rounded-full bg-purple-500/50 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingWizard({ open, onClose }: OnboardingWizardProps) {
  const { saveLaunchKit, navigate } = useAppContext();
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [isCreating, setIsCreating] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const meta = data.user?.user_metadata;
        setUserName(meta?.full_name ?? meta?.name ?? data.user?.email ?? null);
      });
  }, []);

  const patch = useCallback((p: Partial<OnboardingState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  const goNext = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.min(prev.step + 1, TOTAL_STEPS) as OnboardingStep,
    }));
  }, []);

  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.max(prev.step - 1, 1) as OnboardingStep,
    }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!state.selectedStrategy) return;
    setIsCreating(true);

    const strategy = LAUNCH_STRATEGIES.find((s) => s.id === state.selectedStrategy)!;
    const brand: BrandInfo = {
      productName: state.productName,
      niche: state.niche,
      targetAudience: state.targetAudience,
      transformation: state.transformation,
      primaryColor: state.primaryColor,
      secondaryColor: state.secondaryColor,
      fontChoice: "sora",
      stylePreset: "dark-premium",
    };
    const now = new Date().toISOString();
    const kit: LaunchKit = {
      id: crypto.randomUUID(),
      strategyId: state.selectedStrategy,
      brandInfo: brand,
      assets: strategy.assets.map((a) => ({ assetId: a.id, status: "pending" })),
      createdAt: now,
      updatedAt: now,
    };

    saveLaunchKit(kit);

    try {
      localStorage.setItem("wf_onboarding_done", "1");
    } catch {
      // storage unavailable
    }

    setIsCreating(false);
    onClose();
    navigate("lancamentos");
  }, [state, saveLaunchKit, navigate, onClose]);

  const canProceed =
    state.step === 1
      ? true
      : state.step === 2
      ? !!state.productName.trim() &&
        !!state.niche.trim() &&
        !!state.targetAudience.trim() &&
        !!state.transformation.trim()
      : state.step === 3
      ? !!state.selectedStrategy
      : true;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-lg mx-4 bg-[#0f0f14] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div>
            <h2 className="text-[14px] font-semibold text-white">{STEP_TITLES[state.step]}</h2>
            <p className="text-[10px] text-white/35 mt-0.5">
              Passo {state.step} de {TOTAL_STEPS}
            </p>
          </div>
          {state.step !== 4 && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/35 hover:text-white/60 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* progress bar */}
        <div className="flex gap-1 px-6 pt-4 shrink-0">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 rounded-full flex-1 transition-all duration-300",
                i < state.step ? "bg-purple-500" : "bg-white/[0.07]"
              )}
            />
          ))}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {state.step === 1 && <StepWelcome userName={userName} />}
          {state.step === 2 && <StepProduct state={state} onChange={patch} />}
          {state.step === 3 && (
            <StepStrategy
              selected={state.selectedStrategy}
              onSelect={(id) => patch({ selectedStrategy: id })}
            />
          )}
          {state.step === 4 && <StepConfirm state={state} isCreating={isCreating} />}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] shrink-0">
          <button
            onClick={goBack}
            disabled={state.step === 1}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium text-white/45 hover:text-white/75 disabled:opacity-0 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Voltar
          </button>

          {state.step < TOTAL_STEPS ? (
            <button
              onClick={goNext}
              disabled={!canProceed}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-semibold transition-colors cursor-pointer"
            >
              Continuar <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={isCreating}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[12px] font-semibold transition-colors cursor-pointer"
            >
              {isCreating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              {isCreating ? "Criando..." : "Criar Kit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
