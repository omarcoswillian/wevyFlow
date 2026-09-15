"use client";

import { useState } from "react";
import { PenTool, Sparkles, Megaphone, Copy, Check, Trash2, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopyDocuments, type CopyDocument } from "../lib/copy/useCopyDocuments";
import { AdCopyModal } from "./AdCopyModal";

const TYPE_META: Record<CopyDocument["type"], { icon: React.ElementType; label: string }> = {
  ads: { icon: Megaphone, label: "Anúncios" },
};

function DocumentCard({ doc, onClick }: { doc: CopyDocument; onClick: () => void }) {
  const meta = TYPE_META[doc.type];
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      className="text-left rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all p-4 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Icon className="w-3 h-3 text-purple-400" />
          </div>
          <p className="text-[12px] font-semibold text-white/90 truncate">{doc.title}</p>
        </div>
        {doc.status === "approved" ? (
          <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-semibold">
            <CheckCircle2 className="w-2.5 h-2.5" /> Aprovado
          </span>
        ) : (
          <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/[0.04] text-white/30 text-[9px] font-medium">
            <Clock className="w-2.5 h-2.5" /> Rascunho
          </span>
        )}
      </div>
      <p className="text-[11px] text-white/35">{doc.options.length} opções · {meta.label}</p>
    </button>
  );
}

function DocumentDetail({ doc, onClose, onUpdate, onDelete }: {
  doc: CopyDocument;
  onClose: () => void;
  onUpdate: (patch: Partial<{ status: "draft" | "approved"; selected: { headline: string; cta: string } | null }>) => void;
  onDelete: () => void;
}) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (headline: string, cta: string, i: number) => {
    navigator.clipboard.writeText(`${headline}\n${cta}`);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <>
      <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[301] flex items-center justify-center p-6 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-[520px] rounded-2xl bg-[#18181c] border border-white/[0.08] shadow-2xl shadow-black/60 overflow-hidden max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
            <h2 className="text-[13px] font-semibold text-white">{doc.title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all cursor-pointer">✕</button>
          </div>

          <div className="px-5 py-5 space-y-2 overflow-y-auto flex-1">
            {doc.options.map((opt, i) => {
              const isSelected = doc.selected?.headline === opt.headline && doc.selected?.cta === opt.cta;
              return (
                <div key={i} className={cn("rounded-xl border px-4 py-3 transition-colors",
                  isSelected ? "border-purple-500/40 bg-purple-500/[0.06]" : "border-white/[0.06] bg-white/[0.02]")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[9px] uppercase tracking-widest text-purple-400/70 font-semibold mb-1">{opt.angle}</p>
                      <p className="text-[13px] font-semibold text-white leading-snug">{opt.headline}</p>
                      <p className="text-[11px] text-white/40 mt-1">{opt.cta}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopy(opt.headline, opt.cta, i)}
                        className={cn("p-1.5 rounded-lg transition-all cursor-pointer",
                          copiedIndex === i ? "bg-emerald-500/20 text-emerald-400" : "text-white/30 hover:text-white/60 hover:bg-white/[0.05]")}
                      >
                        {copiedIndex === i ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => onUpdate({ selected: isSelected ? null : { headline: opt.headline, cta: opt.cta } })}
                        className={cn("px-2 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer",
                          isSelected ? "bg-purple-500/20 text-purple-300" : "bg-white/[0.04] text-white/40 hover:bg-white/[0.08]")}
                      >
                        {isSelected ? "Escolhida" : "Escolher"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.06] shrink-0">
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
            <button
              onClick={() => onUpdate({ status: doc.status === "approved" ? "draft" : "approved" })}
              className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer",
                doc.status === "approved" ? "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]" : "bg-emerald-600 hover:bg-emerald-500 text-white")}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {doc.status === "approved" ? "Voltar pra rascunho" : "Aprovar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function CopyView() {
  const { documents, loading, reload, update, remove } = useCopyDocuments();
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [openDocId, setOpenDocId] = useState<string | null>(null);

  const openDoc = documents.find((d) => d.id === openDocId) || null;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0e]">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.05] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <PenTool className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-white/90">Copy</h1>
            <p className="text-[11px] text-white/30">Headlines, CTAs e roteiros — texto, separado do visual</p>
          </div>
        </div>
        <button
          onClick={() => setGeneratorOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-semibold transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" /> Nova copy
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-5 h-5 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 flex flex-col items-center gap-3 text-center">
            <PenTool className="w-8 h-8 text-white/15" />
            <p className="text-[13px] text-white/50">Nenhuma copy ainda</p>
            <p className="text-[11px] text-white/25 max-w-xs">Gere headlines e CTAs pra anúncios — avulso ou puxando o briefing de um Lançamento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onClick={() => setOpenDocId(doc.id)} />
            ))}
          </div>
        )}
      </div>

      {generatorOpen && (
        <AdCopyModal onClose={() => { setGeneratorOpen(false); reload(); }} />
      )}

      {openDoc && (
        <DocumentDetail
          doc={openDoc}
          onClose={() => setOpenDocId(null)}
          onUpdate={(patch) => update(openDoc.id, patch)}
          onDelete={() => { remove(openDoc.id); setOpenDocId(null); }}
        />
      )}
    </div>
  );
}
