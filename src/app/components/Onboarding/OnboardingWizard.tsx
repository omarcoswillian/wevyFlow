"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Rocket, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { LaunchTypeSelector } from "../LaunchTypeSelector";
import { useAppContext } from "../../(app)/_context";
import { LAUNCH_STRATEGIES } from "../../lib/launch-strategies";
import type { StrategyId } from "../../lib/types-kit";
import { emptyBriefing, mergeBriefing, type LaunchBriefing } from "../../lib/launch-briefing";

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
  error,
}: {
  state: OnboardingState;
  isCreating: boolean;
  error: string | null;
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

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
          {error} — seus dados continuam preenchidos, tente novamente.
        </div>
      )}

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
  const { persistLaunch, navigate, launchKits } = useAppContext();
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const clientTokenRef = useRef<string>("");
  const draftProjectIdRef = useRef<string | null>(null);
  // Full persisted briefing of the draft being resumed (if any) — kept
  // separate from `state`, which only has slots for the onboarding form's
  // own fields. Every save merges onto this instead of `emptyBriefing()`,
  // so fields the Home form captures but onboarding doesn't show
  // (description, mecanismo, preco, provas, referenceImages, copyDocument,
  // logoUrl, launchType, referenceUrl) survive a resume-then-save instead
  // of being wiped back to blank (see launches review item B).
  const existingBriefingRef = useRef<LaunchBriefing>(emptyBriefing());
  // Set synchronously at the very start of handleConfirm (before any
  // `await`), mirroring LaunchWizard's defense against the same race (see
  // review item C / item 4): without it, "Voltar" during activation returns
  // to step 3, where the X reappears and only checks `saving` — closing
  // there fires a draft-save that can land after the activation PATCH and
  // silently revert the just-activated launch back to `draft`.
  const activatingRef = useRef(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const meta = data.user?.user_metadata;
        setUserName(meta?.full_name ?? meta?.name ?? data.user?.email ?? null);
      });
  }, []);

  // Resume the most recently persisted draft instead of always starting
  // from a blank form — a previous session (or a close before this fix)
  // may have already saved one, and silently starting over would look like
  // data loss. Runs once per open, never re-clobbers in-progress edits.
  useEffect(() => {
    if (!open || draftProjectIdRef.current) return;
    const existingDraft = launchKits.find((k) => k.status === "draft");
    if (!existingDraft) return;
    draftProjectIdRef.current = existingDraft.projectId;
    existingBriefingRef.current = existingDraft.briefing;
    const b = existingDraft.briefing;
    setState((prev) => ({
      ...prev,
      productName: b.productName || prev.productName,
      niche: b.niche || prev.niche,
      targetAudience: b.targetAudience || prev.targetAudience,
      transformation: b.transformation || prev.transformation,
      primaryColor: b.primaryColor || prev.primaryColor,
      secondaryColor: b.secondaryColor || prev.secondaryColor,
      selectedStrategy: existingDraft.strategyId ?? prev.selectedStrategy,
      step: (b.productName && b.niche && b.targetAudience && b.transformation ? 3 : prev.step) as OnboardingStep,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patch = useCallback((p: Partial<OnboardingState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  /** Saves the current product-info fields as a draft — used by both
   * "Continuar" and the close button, so leaving step 2 or closing the
   * modal early never silently drops what the user typed. Runs the actual
   * network call outside any setState updater (React may invoke an
   * updater more than once, e.g. under Strict Mode), and the caller always
   * awaits its result before advancing or closing. */
  const persistDraftIfNeeded = useCallback(async (): Promise<boolean> => {
    // Save as soon as ANY field has content — a draft can be (and often
    // is) incomplete; only *activation* requires all four. Requiring every
    // field before saving anything meant typing just a product name and
    // niche, then closing/reloading, silently lost that input (see
    // launches review item A).
    //
    // Once a draft is already persisted, ALWAYS save on close/advance —
    // not just when the four text fields are non-empty. Otherwise clearing
    // a field back to empty (or only touching color/font/style, which
    // aren't part of `hasAnyContent`) silently fails to persist that edit,
    // because it looks like "nothing to save" (see review pendency 5).
    const hasAnyContent = !!(
      state.productName.trim() || state.niche.trim() ||
      state.targetAudience.trim() || state.transformation.trim()
    );
    if (!draftProjectIdRef.current && !hasAnyContent) {
      return true; // no draft yet and nothing meaningful typed — don't create an empty one
    }
    if (!clientTokenRef.current) clientTokenRef.current = crypto.randomUUID();
    // Merge onto the full previously-persisted briefing (not emptyBriefing())
    // so fields onboarding doesn't show don't get wiped — see item B.
    const briefing = mergeBriefing(existingBriefingRef.current, {
      productName: state.productName,
      niche: state.niche,
      targetAudience: state.targetAudience,
      transformation: state.transformation,
      primaryColor: state.primaryColor,
      secondaryColor: state.secondaryColor,
      fontChoice: existingBriefingRef.current.fontChoice || "sora",
      stylePreset: existingBriefingRef.current.stylePreset || "dark-premium",
    });
    setSaving(true);
    try {
      const launch = await persistLaunch({
        projectId: draftProjectIdRef.current,
        clientToken: clientTokenRef.current,
        briefing,
        strategyId: state.selectedStrategy ?? undefined,
        status: "draft",
      });
      draftProjectIdRef.current = launch.projectId;
      existingBriefingRef.current = launch.briefing;
      setSaveError(null);
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar rascunho.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [state, persistLaunch]);

  const goNext = useCallback(async () => {
    const ok = await persistDraftIfNeeded();
    if (!ok) return; // keep the user on the current step so nothing typed is lost
    setState((prev) => ({ ...prev, step: Math.min(prev.step + 1, TOTAL_STEPS) as OnboardingStep }));
  }, [persistDraftIfNeeded]);

  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.max(prev.step - 1, 1) as OnboardingStep,
    }));
  }, []);

  const handleClose = useCallback(async () => {
    if (activatingRef.current) return; // activation in flight — never race it with a draft-save
    const ok = await persistDraftIfNeeded();
    if (!ok) return; // stay open with the error visible instead of discarding the input
    onClose();
  }, [persistDraftIfNeeded, onClose]);

  const handleConfirm = useCallback(async () => {
    if (!state.selectedStrategy) return;
    activatingRef.current = true;
    setIsCreating(true);
    setCreateError(null);

    if (!clientTokenRef.current) clientTokenRef.current = crypto.randomUUID();

    // Same merge-onto-existing rule as persistDraftIfNeeded (item B) — the
    // confirm step must not discard richer briefing fields either.
    const briefing = mergeBriefing(existingBriefingRef.current, {
      productName: state.productName,
      niche: state.niche,
      targetAudience: state.targetAudience,
      transformation: state.transformation,
      primaryColor: state.primaryColor,
      secondaryColor: state.secondaryColor,
      fontChoice: existingBriefingRef.current.fontChoice || "sora",
      stylePreset: existingBriefingRef.current.stylePreset || "dark-premium",
    });

    try {
      const launch = await persistLaunch({
        projectId: draftProjectIdRef.current,
        clientToken: clientTokenRef.current,
        briefing,
        strategyId: state.selectedStrategy,
        status: "active",
      });
      draftProjectIdRef.current = launch.projectId;
      existingBriefingRef.current = launch.briefing;
      onClose();
      navigate("lancamentos", launch.projectId);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao criar o lançamento.");
    } finally {
      activatingRef.current = false;
      setIsCreating(false);
    }
  }, [state, persistLaunch, navigate, onClose]);

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
              onClick={handleClose}
              disabled={saving || isCreating}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/35 hover:text-white/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
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
          {saveError && state.step !== 4 && (
            <div className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
              {saveError} — seus dados continuam preenchidos, tente novamente.
            </div>
          )}
          {state.step === 1 && <StepWelcome userName={userName} />}
          {state.step === 2 && <StepProduct state={state} onChange={patch} />}
          {state.step === 3 && (
            <StepStrategy
              selected={state.selectedStrategy}
              onSelect={(id) => patch({ selectedStrategy: id })}
            />
          )}
          {state.step === 4 && <StepConfirm state={state} isCreating={isCreating} error={createError} />}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] shrink-0">
          <button
            onClick={goBack}
            disabled={state.step === 1 || isCreating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium text-white/45 hover:text-white/75 disabled:opacity-0 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Voltar
          </button>

          {state.step < TOTAL_STEPS ? (
            <button
              onClick={goNext}
              disabled={!canProceed || saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-semibold transition-colors cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Continuar <ChevronRight className="w-3.5 h-3.5" /></>}
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
