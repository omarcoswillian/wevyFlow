"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Rocket, Zap, Sprout, PlayCircle, Repeat, Check, Upload, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppContext } from "../(app)/_context";
import { LAUNCH_STRATEGIES } from "../lib/launch-strategies";
import type { StrategyId } from "../lib/types-kit";
import { emptyBriefing, type LaunchBriefing } from "../lib/launch-briefing";

const STYLE_PRESETS = [
  { id: "dark-premium", label: "Dark Premium" },
  { id: "light-clean", label: "Light Clean" },
  { id: "bold-vibrant", label: "Bold Vibrant" },
  { id: "minimal-elegant", label: "Minimal Elegant" },
];

const FONT_OPTIONS = [
  { id: "sora", label: "Sora" },
  { id: "montserrat", label: "Montserrat" },
  { id: "inter", label: "Inter" },
  { id: "poppins", label: "Poppins" },
];

const STRATEGY_ICONS: Record<StrategyId, React.ElementType> = {
  classico: Rocket,
  meteorico: Zap,
  semente: Sprout,
  "pago-vsl": PlayCircle,
  perpetuo: Repeat,
};

interface WizardLocalState {
  step: 1 | 2 | 3;
  briefing: LaunchBriefing;
  selectedStrategy: StrategyId | null;
}

export function LaunchWizard() {
  const {
    showLaunchWizard, setShowLaunchWizard, navigate,
    launchWizardProjectId, launchKits, persistLaunch, setActiveLaunchKit,
  } = useAppContext();

  const [wizard, setWizard] = useState<WizardLocalState>({
    step: 1,
    briefing: emptyBriefing(),
    selectedStrategy: null,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Set synchronously the instant activation starts (before the first
  // `await`), so close() has a way to refuse even if some other code path
  // calls it while the backdrop/X are already disabled by `saving` — belt
  // and suspenders against the activation-then-close race (review item C).
  const activatingRef = useRef(false);

  // The draft was already persisted (server round-trip) by whoever opened
  // this wizard (Home/KitDashboard) — this effect only loads it locally,
  // it never creates or discards anything.
  useEffect(() => {
    if (!showLaunchWizard || !launchWizardProjectId) return;
    const existing = launchKits.find((k) => k.projectId === launchWizardProjectId);
    const briefing = existing?.briefing ?? emptyBriefing();
    const briefingComplete = !!(
      briefing.productName?.trim() &&
      briefing.niche?.trim() &&
      briefing.targetAudience?.trim() &&
      briefing.transformation?.trim()
    );
    setWizard({
      step: briefingComplete ? 2 : 1,
      briefing,
      selectedStrategy: existing?.strategyId ?? null,
    });
    setSaveError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLaunchWizard, launchWizardProjectId]);

  const persistDraft = useCallback(async (patch: Partial<WizardLocalState> = {}): Promise<boolean> => {
    if (!launchWizardProjectId) return false;
    setSaving(true);
    setSaveError(null);
    try {
      await persistLaunch({
        projectId: launchWizardProjectId,
        briefing: patch.briefing ?? wizard.briefing,
        strategyId: patch.selectedStrategy !== undefined ? patch.selectedStrategy : wizard.selectedStrategy,
        status: "draft",
      });
      return true;
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar rascunho.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [launchWizardProjectId, persistLaunch, wizard.briefing, wizard.selectedStrategy]);

  const close = useCallback(async () => {
    // Fechar não equivale a concluir — mas o que já foi digitado deve
    // sobreviver, então salva o draft antes de esconder o modal. Se o
    // salvamento falhar, o modal permanece aberto com o erro visível em
    // vez de fechar e descartar o que o usuário preencheu (ver revisão
    // do Codex, item 3). Sem projectId não há o que salvar — nesse caso
    // (não deveria ocorrer, já que só se abre o wizard com um draft já
    // persistido) ainda assim permite fechar, pra nunca travar o modal.
    if (activatingRef.current) return;
    if (launchWizardProjectId) {
      const ok = await persistDraft();
      if (!ok) return;
    }
    setShowLaunchWizard(false);
    setWizard({ step: 1, briefing: emptyBriefing(), selectedStrategy: null });
  }, [persistDraft, setShowLaunchWizard, launchWizardProjectId]);

  const setBrand = useCallback((patch: Partial<LaunchBriefing>) => {
    setWizard((w) => ({ ...w, briefing: { ...w.briefing, ...patch } }));
  }, []);

  const goNext = useCallback(async () => {
    const ok = await persistDraft();
    if (!ok) return; // keep the user on the current step so nothing typed is lost
    setWizard((w) => ({ ...w, step: (Math.min(w.step + 1, 3) as 1 | 2 | 3) }));
  }, [persistDraft]);

  const goBack = useCallback(() => {
    setWizard((w) => ({ ...w, step: (Math.max(w.step - 1, 1) as 1 | 2 | 3) }));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!wizard.selectedStrategy || !launchWizardProjectId) return;
    activatingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const launch = await persistLaunch({
        projectId: launchWizardProjectId,
        briefing: wizard.briefing,
        strategyId: wizard.selectedStrategy,
        status: "active",
      });
      setActiveLaunchKit(launch);
      setShowLaunchWizard(false);
      setWizard({ step: 1, briefing: emptyBriefing(), selectedStrategy: null });
      navigate("lancamentos", launch.projectId);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao ativar o lançamento.");
    } finally {
      setSaving(false);
      activatingRef.current = false;
    }
  }, [wizard, launchWizardProjectId, persistLaunch, setActiveLaunchKit, setShowLaunchWizard, navigate]);

  if (!showLaunchWizard) return null;

  const brand = wizard.briefing;
  const step1Valid = !!(brand.productName?.trim() && brand.niche?.trim() && brand.targetAudience?.trim() && brand.transformation?.trim());
  const step2Valid = !!wizard.selectedStrategy;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      {/* backdrop — inert while saving/activating so a click can't race a
          PATCH already in flight (e.g. "Criar Kit" then immediately closing
          — see launches review item C: that could revert an
          just-activated launch back to draft). */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={saving ? undefined : close} />

      <div className="relative z-10 w-full max-w-2xl mx-4 bg-[#0f0f14] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Novo Kit de Lançamento</h2>
            <p className="text-[11px] text-white/40 mt-0.5">Passo {wizard.step} de 3</p>
          </div>
          <button onClick={close} disabled={saving} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-wait">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
          </button>
        </div>

        {/* step indicator */}
        <div className="flex gap-1.5 px-6 pt-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className={cn("h-1 rounded-full flex-1 transition-colors", s <= wizard.step ? "bg-purple-500" : "bg-white/[0.08]")} />
          ))}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {saveError && (
            <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
              {saveError} — seus dados continuam preenchidos, tente novamente.
            </div>
          )}
          {wizard.step === 1 && <StepBrand brand={brand} setBrand={setBrand} />}
          {wizard.step === 2 && <StepStrategy selected={wizard.selectedStrategy} onSelect={(id) => setWizard((w) => ({ ...w, selectedStrategy: id }))} />}
          {wizard.step === 3 && <StepConfirm brand={brand} strategyId={wizard.selectedStrategy!} />}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
          <button
            onClick={goBack}
            disabled={wizard.step === 1 || saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium text-white/50 hover:text-white/80 disabled:opacity-0 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Voltar
          </button>

          {wizard.step < 3 ? (
            <button
              onClick={goNext}
              disabled={(wizard.step === 1 ? !step1Valid : !step2Valid) || saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[12px] font-semibold transition-colors cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Continuar <ChevronRight className="w-3.5 h-3.5" /></>}
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-[12px] font-semibold transition-colors cursor-pointer"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Criar Kit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Image resize helper ────────────────────────────────── */
async function resizeImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = url;
  });
}

/* ── Step 1: Brand Info ─────────────────────────────────── */
function StepBrand({ brand, setBrand }: { brand: Partial<LaunchBriefing>; setBrand: (p: Partial<LaunchBriefing>) => void }) {
  const [refOpen, setRefOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageFiles(files: FileList | null) {
    if (!files) return;
    const current = brand.referenceImages || [];
    const remaining = 4 - current.length;
    if (remaining <= 0) return;
    const selected = Array.from(files).slice(0, remaining);
    const resized = await Promise.all(selected.map(resizeImage));
    setBrand({ referenceImages: [...current, ...resized].slice(0, 4) });
  }

  function removeImage(idx: number) {
    const current = brand.referenceImages || [];
    setBrand({ referenceImages: current.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-semibold text-white mb-0.5">Sobre o Produto</h3>
        <p className="text-[11px] text-white/40">Essas informações serão usadas em todos os criativos e páginas do kit.</p>
      </div>

      <Field label="Nome do Produto *">
        <input value={brand.productName || ""} onChange={(e) => setBrand({ productName: e.target.value })} placeholder="Ex: Método Força Interior" className={inputCls} />
      </Field>

      <Field label="Nicho *">
        <input value={brand.niche || ""} onChange={(e) => setBrand({ niche: e.target.value })} placeholder="Ex: Desenvolvimento pessoal, fitness, finanças..." className={inputCls} />
      </Field>

      <Field label="Público-alvo *">
        <input value={brand.targetAudience || ""} onChange={(e) => setBrand({ targetAudience: e.target.value })} placeholder="Ex: Mulheres 30-50 anos que querem emagrecer" className={inputCls} />
      </Field>

      <Field label="Transformação prometida *">
        <textarea value={brand.transformation || ""} onChange={(e) => setBrand({ transformation: e.target.value })} rows={2} placeholder="Ex: Perca 10kg em 90 dias sem academia ou dietas restritivas" className={cn(inputCls, "resize-none")} />
      </Field>

      <div className="pt-1 pb-0.5">
        <p className="text-[9px] uppercase tracking-widest text-purple-400/60 font-semibold">Copy — Diagnóstico do Produto</p>
        <p className="text-[10px] text-white/25 mt-0.5">Quanto mais detalhado, mais específica e persuasiva será a copy gerada.</p>
      </div>

      <Field label="Mecanismo único">
        <textarea value={brand.mecanismo || ""} onChange={(e) => setBrand({ mecanismo: e.target.value })} rows={2} placeholder="Ex: Método das 3 fases de recondicionamento metabólico — sequência específica que ativa a queima de gordura visceral sem corte calórico agressivo" className={cn(inputCls, "resize-none")} />
      </Field>

      <Field label="Preço + âncora">
        <input value={brand.preco || ""} onChange={(e) => setBrand({ preco: e.target.value })} placeholder="Ex: R$997 — de R$2.997 (parcela em 12x de R$97)" className={inputCls} />
      </Field>

      <Field label="Provas e resultados">
        <textarea value={brand.provas || ""} onChange={(e) => setBrand({ provas: e.target.value })} rows={3} placeholder={"Ex: 3.200 alunos. Ana P. (SP): perdeu 14kg em 67 dias. Carlos M. (RJ): saiu do 52 para 78kg em 4 meses. Média: 8,3kg nos primeiros 30 dias."} className={cn(inputCls, "resize-none")} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cor primária">
          <div className="flex items-center gap-2">
            <input type="color" value={brand.primaryColor || "#a78bfa"} onChange={(e) => setBrand({ primaryColor: e.target.value })} className="w-8 h-8 rounded-md border border-white/10 cursor-pointer bg-transparent" />
            <span className="text-[11px] text-white/50">{brand.primaryColor || "#a78bfa"}</span>
          </div>
        </Field>
        <Field label="Cor secundária">
          <div className="flex items-center gap-2">
            <input type="color" value={brand.secondaryColor || "#6366f1"} onChange={(e) => setBrand({ secondaryColor: e.target.value })} className="w-8 h-8 rounded-md border border-white/10 cursor-pointer bg-transparent" />
            <span className="text-[11px] text-white/50">{brand.secondaryColor || "#6366f1"}</span>
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Fonte">
          <select value={brand.fontChoice || "sora"} onChange={(e) => setBrand({ fontChoice: e.target.value })} className={selectCls}>
            {FONT_OPTIONS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </Field>
        <Field label="Estilo visual">
          <select value={brand.stylePreset || "dark-premium"} onChange={(e) => setBrand({ stylePreset: e.target.value })} className={selectCls}>
            {STYLE_PRESETS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </Field>
      </div>

      {/* Referencias visuais — colapsavel */}
      <div className="border border-white/[0.08] rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setRefOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
        >
          <div>
            <span className="text-[12px] font-medium text-white/60">Referencias Visuais</span>
            <span className="ml-2 text-[10px] text-purple-400/70">(opcional mas recomendado)</span>
          </div>
          <ChevronDown
            className={cn("w-4 h-4 text-white/30 transition-transform", refOpen && "rotate-180")}
          />
        </button>

        {refOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06]">
            <p className="text-[10px] text-white/30 pt-3">
              Imagens de marcas que inspiram voce — logos, paletas, materiais visuais
            </p>

            {/* Drop zone */}
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer",
                isDragging
                  ? "border-purple-500/60 bg-purple-500/[0.06]"
                  : "border-white/[0.08] hover:border-white/[0.14] hover:bg-white/[0.02]"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={async (e) => {
                e.preventDefault();
                setIsDragging(false);
                await handleImageFiles(e.dataTransfer.files);
              }}
            >
              <Upload size={16} className="mx-auto mb-1.5 text-white/25" />
              <p className="text-[11px] text-white/40">Arraste ou clique para selecionar</p>
              <p className="text-[10px] text-white/20 mt-0.5">JPG, PNG ou WEBP — max. 4 imagens</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => handleImageFiles(e.target.files)}
              />
            </div>

            {/* Thumbnails */}
            {(brand.referenceImages || []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(brand.referenceImages || []).map((src, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/[0.08] group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Referencia ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Field label="Marcas de referencia">
              <input
                value={brand.referenceBrands || ""}
                onChange={(e) => setBrand({ referenceBrands: e.target.value })}
                placeholder="Ex: Nike, Apple, Headspace"
                className={inputCls}
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Step 2: Strategy ───────────────────────────────────── */
function StepStrategy({ selected, onSelect }: { selected: StrategyId | null; onSelect: (id: StrategyId) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-[13px] font-semibold text-white mb-0.5">Estratégia de Lançamento</h3>
        <p className="text-[11px] text-white/40">Escolha a estratégia e o kit será montado com todos os ativos necessários.</p>
      </div>
      {LAUNCH_STRATEGIES.map((s) => {
        const Icon = STRATEGY_ICONS[s.id];
        const isSelected = selected === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              "w-full text-left px-4 py-3.5 rounded-xl border transition-all cursor-pointer",
              isSelected
                ? "bg-purple-500/10 border-purple-500/40 shadow-[0_0_0_1px_rgba(168,85,247,0.2)]"
                : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.10]"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn("p-2 rounded-lg mt-0.5", isSelected ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.06] text-white/50")}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-[13px] font-semibold", isSelected ? "text-white" : "text-white/80")}>{s.label}</span>
                  <span className="text-[10px] text-white/30 shrink-0">{s.assets.length} ativos</span>
                </div>
                <p className="text-[11px] text-white/40 mt-0.5">{s.tagline}</p>
                <p className="text-[10px] text-white/25 mt-1">{s.bestFor}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── Step 3: Confirm ────────────────────────────────────── */
function StepConfirm({ brand, strategyId }: { brand: LaunchBriefing; strategyId: StrategyId }) {
  const strategy = LAUNCH_STRATEGIES.find((s) => s.id === strategyId)!;
  const criativos = strategy.assets.filter((a) => a.type === "criativo");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[13px] font-semibold text-white mb-0.5">Confirmar Kit</h3>
        <p className="text-[11px] text-white/40">Revise antes de criar. Você poderá gerar cada ativo individualmente depois.</p>
      </div>

      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
        <Row label="Produto" value={brand.productName} />
        <Row label="Nicho" value={brand.niche} />
        <Row label="Público" value={brand.targetAudience} />
        <Row label="Estratégia" value={strategy.label} />
        <Row label="Total de ativos" value={`${strategy.assets.length} criativos`} />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <AssetSummary title="Criativos" items={criativos.map((a) => a.label)} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-[11px] text-white/40 shrink-0">{label}</span>
      <span className="text-[11px] text-white/80 text-right">{value}</span>
    </div>
  );
}

function AssetSummary({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3">
      <p className="text-[11px] font-semibold text-white/60 mb-2">{title} ({items.length})</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-1.5 text-[10px] text-white/40">
            <div className="w-1 h-1 rounded-full bg-purple-500/50 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-white/50 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/90 placeholder:text-white/25 focus:outline-none focus:border-purple-500/40 transition-colors";
const selectCls = "w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/90 focus:outline-none focus:border-purple-500/40 transition-colors appearance-none cursor-pointer";
