"use client";

import { useState, useCallback } from "react";
import { X, Megaphone, Sparkles, Copy, Check, Loader2, AlertCircle, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopyDocuments, type CopyType } from "../lib/copy/useCopyDocuments";
import type { AdCopyOption } from "../lib/copy/generate-ads";
import { CopyOptionCard, ContentOptionCard, optionToText, optionsToTextFor } from "./copy/copy-ui";

interface LaunchFacts {
  productName: string;
  niche: string;
  targetAudience: string;
  transformation: string;
}

const TIPO_COPY: Record<CopyType, { modalTitle: string; saveTitle: string; button: string }> = {
  ads: { modalTitle: "Copy de anúncios", saveTitle: "Anúncios", button: "Gerar copy" },
  carrossel: { modalTitle: "Copy de carrossel", saveTitle: "Carrossel", button: "Gerar carrosséis" },
  thumb: { modalTitle: "Texto de thumb", saveTitle: "Thumb", button: "Gerar textos de thumb" },
};

interface AdCopyModalProps {
  /** Pasta da copy: criativos (ads), carrossel ou thumb. */
  tipo?: CopyType;
  onClose: () => void;
  /** When provided, facts come from the launch briefing (read-only) instead of a free-form form. */
  projectId?: string;
  launchFacts?: LaunchFacts;
}

export function AdCopyModal({ tipo = "ads", onClose, projectId, launchFacts }: AdCopyModalProps) {
  const labels = TIPO_COPY[tipo];
  const isLaunchMode = Boolean(projectId && launchFacts);
  const { save } = useCopyDocuments();

  const [productName, setProductName] = useState(launchFacts?.productName || "");
  const [niche, setNiche] = useState(launchFacts?.niche || "");
  const [targetAudience, setTargetAudience] = useState(launchFacts?.targetAudience || "");
  const [transformation, setTransformation] = useState(launchFacts?.transformation || "");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<AdCopyOption[] | null>(null);
  const [context, setContext] = useState<Record<string, unknown>>({});
  const [model, setModel] = useState<string | undefined>(undefined);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/copy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isLaunchMode
            ? { type: tipo, projectId }
            : { type: tipo, productName, niche, targetAudience, transformation }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar copy");
      setOptions(data.options);
      setContext(data.context || {});
      setModel(data.model);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [isLaunchMode, projectId, tipo, productName, niche, targetAudience, transformation]);

  const handleCopy = useCallback((option: AdCopyOption, index: number) => {
    navigator.clipboard.writeText(optionToText(option));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const handleSave = useCallback(async () => {
    if (!options) return;
    const title = (isLaunchMode ? launchFacts?.productName : productName) || niche || labels.modalTitle;
    const doc = await save({
      type: tipo,
      title: `${labels.saveTitle} — ${title}`,
      context,
      options,
      model,
      projectId: isLaunchMode ? projectId : null,
    });
    if (doc) setSaved(true);
  }, [options, context, model, save, tipo, labels, isLaunchMode, projectId, launchFacts, productName, niche]);

  const canGenerate = isLaunchMode || Boolean(productName.trim() || niche.trim());

  return (
    <>
      <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[301] flex items-center justify-center p-6 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[560px] rounded-2xl bg-[#18181c] border border-white/[0.08] shadow-2xl shadow-black/60 overflow-hidden max-h-[85vh] flex flex-col">

          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
                <Megaphone className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <h2 className="text-[13px] font-semibold text-white">{labels.modalTitle}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-5 space-y-4 overflow-y-auto flex-1">
            {isLaunchMode ? (
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold mb-1.5">Briefing do lançamento</p>
                <p className="text-[12px] text-white/70"><span className="text-white/40">Produto:</span> {launchFacts!.productName || "—"}</p>
                <p className="text-[12px] text-white/70"><span className="text-white/40">Nicho:</span> {launchFacts!.niche || "—"}</p>
                {launchFacts!.targetAudience && <p className="text-[12px] text-white/70"><span className="text-white/40">Público:</span> {launchFacts!.targetAudience}</p>}
                {launchFacts!.transformation && <p className="text-[12px] text-white/70"><span className="text-white/40">Benefício:</span> {launchFacts!.transformation}</p>}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-1.5">Produto</label>
                  <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ex: Método Alpha"
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-1.5">Nicho</label>
                  <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ex: Fitness, finanças, desenvolvimento pessoal..."
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-1.5">Público-alvo</label>
                  <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} placeholder="Ex: Empreendedores iniciantes"
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-1.5">Benefício / transformação</label>
                  <input value={transformation} onChange={(e) => setTransformation(e.target.value)} placeholder="Ex: Do zero ao primeiro R$ 10k em 60 dias"
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors" />
                </div>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading || !canGenerate}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-[12px] font-semibold transition-colors cursor-pointer"
            >
              {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</> : <><Sparkles className="w-3.5 h-3.5" /> {options ? "Gerar de novo" : labels.button}</>}
            </button>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
              </div>
            )}

            {options && options.length > 0 && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">{options.length} opções geradas</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(optionsToTextFor(options)); setCopiedIndex(-1); setTimeout(() => setCopiedIndex(null), 2000); }}
                    className={cn("flex items-center gap-1.5 text-[10px] font-medium transition-colors cursor-pointer",
                      copiedIndex === -1 ? "text-emerald-300" : "text-white/40 hover:text-white/70")}
                  >
                    {copiedIndex === -1 ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedIndex === -1 ? "Copiadas" : "Copiar todas"}
                  </button>
                </div>
                {options.map((opt, i) => tipo === "ads" ? (
                  <CopyOptionCard
                    key={i}
                    option={opt}
                    compact
                    copied={copiedIndex === i}
                    onCopy={() => handleCopy(opt, i)}
                  />
                ) : (
                  <ContentOptionCard key={i} option={opt} copied={copiedIndex === i} onCopy={() => handleCopy(opt, i)} />
                ))}
              </div>
            )}

            {options && options.length > 0 && (
              <button
                onClick={handleSave}
                disabled={saved}
                className={cn("w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-semibold transition-colors cursor-pointer",
                  saved ? "bg-emerald-500/15 text-emerald-400 cursor-default" : "bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white/70")}
              >
                {saved ? <><Check className="w-3.5 h-3.5" /> Salvo em Copy</> : <><Save className="w-3.5 h-3.5" /> Salvar em Copy</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
