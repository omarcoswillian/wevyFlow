"use client";

import { useState, useMemo, useEffect } from "react";
import { PenTool, Sparkles, Search, Trash2, CheckCircle2, X, Copy, Check, LayoutGrid, MonitorSmartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopyDocuments, type CopyDocument } from "../lib/copy/useCopyDocuments";
import { AdCopyModal } from "./AdCopyModal";
import {
  AdPreview, CopyOptionCard, CtaPill, StatusBadge,
  modelLabel, optionsToText, relativeDate, splitTitle,
} from "./copy/copy-ui";

type Filter = "all" | "approved" | "draft";

/** A copy que representa o documento na lista: a escolhida, senão a primeira. */
function headlineOf(doc: CopyDocument): { headline: string; cta: string } | null {
  return doc.selected ?? (doc.options[0] ? { headline: doc.options[0].headline, cta: doc.options[0].cta } : null);
}

function DocumentCard({ doc, now, onOpen, onDelete }: { doc: CopyDocument; now: number; onOpen: () => void; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const { kind, name } = splitTitle(doc.title);
  const lead = headlineOf(doc);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className={cn(
        "group relative flex flex-col text-left rounded-2xl border p-5 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50",
        doc.status === "approved"
          ? "border-emerald-500/20 bg-emerald-500/[0.03] hover:border-emerald-500/35"
          : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.035]"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold truncate">
          {kind} <span className="text-white/15 mx-1">/</span> {relativeDate(doc.updatedAt, now)}
        </p>
        <StatusBadge status={doc.status} />
      </div>

      {lead ? (
        <>
          <p className="text-[17px] leading-[1.3] font-semibold text-white tracking-[-0.015em] line-clamp-3 min-h-[66px]">{lead.headline}</p>
          <div className="mt-3.5">
            <CtaPill text={lead.cta} />
          </div>
        </>
      ) : (
        <p className="text-[12px] text-white/30 min-h-[66px]">Sem opções nesta copy.</p>
      )}

      <div className="mt-5 pt-3.5 border-t border-white/[0.06] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-white/75 truncate">{name}</p>
          <p className="text-[10px] text-white/30 mt-0.5">
            {doc.options.length} {doc.options.length === 1 ? "ângulo" : "ângulos"}
            {doc.selected ? " · 1 escolhida" : ""}
          </p>
        </div>

        {confirming ? (
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={onDelete} className="px-2 py-1 rounded-md bg-red-500/20 text-red-300 text-[10px] font-semibold hover:bg-red-500/30 cursor-pointer">Excluir</button>
            <button onClick={() => setConfirming(false)} className="px-2 py-1 rounded-md text-white/40 text-[10px] hover:text-white/70 cursor-pointer">Cancelar</button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
            aria-label="Excluir copy"
            className="shrink-0 p-1.5 rounded-lg text-white/0 group-hover:text-white/30 hover:!text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function DocumentDrawer({ doc, now, onClose, onUpdate, onDelete }: {
  doc: CopyDocument;
  now: number;
  onClose: () => void;
  onUpdate: (patch: Partial<{ status: "draft" | "approved"; selected: { headline: string; cta: string } | null }>) => void;
  onDelete: () => void;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [view, setView] = useState<"cards" | "ads">("cards");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { kind, name } = splitTitle(doc.title);
  const ctx = doc.context as Record<string, unknown>;
  const niche = typeof ctx.niche === "string" ? ctx.niche : "";
  const audience = typeof ctx.targetAudience === "string" ? ctx.targetAudience : "";
  const gen = modelLabel(doc.model);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const flash = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800);
  };

  const isSelected = (o: { headline: string; cta: string }) => doc.selected?.headline === o.headline && doc.selected?.cta === o.cta;

  return (
    <>
      <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-[301] w-full max-w-[680px] bg-[#101014] border-l border-white/[0.08] shadow-2xl shadow-black/70 flex flex-col">
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold">{kind}</p>
              <h2 className="text-[19px] font-semibold text-white tracking-[-0.015em] mt-1 truncate">{name}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={doc.status} />
              <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-white/35 hover:text-white/70 hover:bg-white/[0.06] transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-x-4 gap-y-1.5 flex-wrap text-[11px] text-white/35">
            <span>Atualizada {relativeDate(doc.updatedAt, now)}</span>
            {gen && <span>Gerada com {gen}</span>}
            {niche && <span>Nicho: <span className="text-white/60">{niche}</span></span>}
            {audience && <span className="truncate max-w-[260px]">Público: <span className="text-white/60">{audience}</span></span>}
          </div>

          <div className="mt-4 inline-flex p-0.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            {([["cards", "Cartões", LayoutGrid], ["ads", "Como anúncio", MonitorSmartphone]] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[11px] font-medium transition-colors cursor-pointer",
                  view === id ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/70")}
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {view === "cards" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {doc.options.map((opt, i) => (
                <CopyOptionCard
                  key={i}
                  option={opt}
                  selected={isSelected(opt)}
                  copied={copiedKey === `o${i}`}
                  onCopy={() => flash(`o${i}`, `${opt.headline}\n${opt.cta}`)}
                  onSelect={() => onUpdate({ selected: isSelected(opt) ? null : { headline: opt.headline, cta: opt.cta } })}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {doc.options.map((opt, i) => (
                <div key={i}>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-white/30 font-semibold mb-2">
                    {opt.angle}{isSelected(opt) ? " · escolhida" : ""}
                  </p>
                  <AdPreview option={opt} pageName={name} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/[0.06] shrink-0">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-white/50">Excluir esta copy?</span>
              <button onClick={onDelete} className="px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-[11px] font-semibold hover:bg-red-500/30 cursor-pointer">Excluir</button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1.5 text-[11px] text-white/40 hover:text-white/70 cursor-pointer">Cancelar</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-medium text-white/35 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Excluir
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => flash("all", optionsToText(doc.options))}
              className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-colors cursor-pointer",
                copiedKey === "all" ? "bg-emerald-500/15 text-emerald-300" : "bg-white/[0.06] text-white/70 hover:bg-white/[0.1]")}
            >
              {copiedKey === "all" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === "all" ? "Copiadas" : "Copiar todas"}
            </button>
            <button
              onClick={() => onUpdate({ status: doc.status === "approved" ? "draft" : "approved" })}
              className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer",
                doc.status === "approved" ? "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]" : "bg-emerald-600 hover:bg-emerald-500 text-white")}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {doc.status === "approved" ? "Voltar pra rascunho" : "Aprovar"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export interface CopyViewLaunch {
  projectId: string;
  facts: { productName: string; niche: string; targetAudience: string; transformation: string };
}

/** Sem `launch`, é a biblioteca global de copy; com `launch`, mostra e gera só
 * as copies daquele lançamento (usado dentro da aba Copy do Hub). */
export function CopyView({ launch }: { launch?: CopyViewLaunch } = {}) {
  const { documents, loading, reload, update, remove } = useCopyDocuments(launch?.projectId);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [now] = useState(() => Date.now());

  const openDoc = documents.find((d) => d.id === openDocId) || null;

  const counts = useMemo(() => ({
    all: documents.length,
    approved: documents.filter((d) => d.status === "approved").length,
    draft: documents.filter((d) => d.status === "draft").length,
  }), [documents]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((d) => {
      if (filter !== "all" && d.status !== filter) return false;
      if (!q) return true;
      return d.title.toLowerCase().includes(q) || d.options.some((o) => o.headline.toLowerCase().includes(q));
    });
  }, [documents, filter, query]);

  const tabs: { id: Filter; label: string }[] = [
    { id: "all", label: "Todas" },
    { id: "approved", label: "Aprovadas" },
    { id: "draft", label: "Rascunhos" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0e]">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.05] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <PenTool className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-white/90">{launch ? "Copy do lançamento" : "Copy"}</h1>
            <p className="text-[11px] text-white/30">
              {launch ? `Headlines e CTAs de ${launch.facts.productName}` : "Headlines, CTAs e roteiros — texto, separado do visual"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setGeneratorOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-semibold transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" /> Nova copy
        </button>
      </div>

      {documents.length > 0 && (
        <div className="px-8 pt-5 flex items-center justify-between gap-4 flex-wrap shrink-0">
          <div className="inline-flex p-0.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={cn("flex items-center gap-2 px-3.5 py-1.5 rounded-[10px] text-[12px] font-medium transition-colors cursor-pointer",
                  filter === t.id ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/70")}
              >
                {t.label}
                <span className={cn("text-[10px] tabular-nums", filter === t.id ? "text-white/60" : "text-white/25")}>{counts[t.id]}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/25 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por produto ou headline"
              className="w-[280px] bg-white/[0.04] border border-white/[0.06] rounded-xl pl-9 pr-3 py-2 text-[12px] text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/40 transition-colors"
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-5">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-5 h-5 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-20 flex flex-col items-center gap-3 text-center">
            <PenTool className="w-8 h-8 text-white/15" />
            <p className="text-[14px] font-medium text-white/60">Nenhuma copy ainda</p>
            <p className="text-[12px] text-white/30 max-w-sm leading-relaxed">{launch ? "Gere headlines e CTAs para anúncios usando o briefing deste lançamento." : "Gere headlines e CTAs para anúncios, avulso ou puxando o briefing de um Lançamento."}</p>
            <button onClick={() => setGeneratorOpen(true)} className="mt-2 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-semibold transition-colors cursor-pointer">
              <Sparkles className="w-3.5 h-3.5" /> Criar a primeira copy
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[13px] text-white/50">Nenhuma copy encontrada.</p>
            <button onClick={() => { setFilter("all"); setQuery(""); }} className="mt-2 text-[12px] text-purple-300 hover:text-purple-200 cursor-pointer">Limpar filtros</button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                now={now}
                onOpen={() => setOpenDocId(doc.id)}
                onDelete={() => { remove(doc.id); if (openDocId === doc.id) setOpenDocId(null); }}
              />
            ))}
          </div>
        )}
      </div>

      {generatorOpen && (
        <AdCopyModal
          onClose={() => { setGeneratorOpen(false); reload(); }}
          projectId={launch?.projectId}
          launchFacts={launch?.facts}
        />
      )}

      {openDoc && (
        <DocumentDrawer
          doc={openDoc}
          now={now}
          onClose={() => setOpenDocId(null)}
          onUpdate={(patch) => update(openDoc.id, patch)}
          onDelete={() => { remove(openDoc.id); setOpenDocId(null); }}
        />
      )}
    </div>
  );
}
