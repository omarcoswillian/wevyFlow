"use client";

import { useState } from "react";
import { Mail, Zap, Loader2, Copy, Check, ChevronDown, ChevronUp, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppContext } from "../(app)/_context";
import type { BrandInfo } from "../lib/types-kit";

type SequenceType = "cpl" | "vendas" | "recuperacao";

interface EmailItem {
  subject: string;
  subject_b?: string;
  subject_c?: string;
  preview: string;
  preview_b?: string;
  body: string;
  cta?: string;
  cta_b?: string;
  ps?: string;
}

const TABS: { id: SequenceType; label: string; count: number; description: string }[] = [
  { id: "cpl", label: "Pré-Lançamento", count: 5, description: "Aquecimento antes do carrinho abrir" },
  { id: "vendas", label: "Vendas", count: 7, description: "Sequência durante o carrinho aberto" },
  { id: "recuperacao", label: "Recuperação", count: 3, description: "Carrinho abandonado" },
];

interface Props {
  brandInfo: BrandInfo;
}

export function EmailSequencePanel({ brandInfo }: Props) {
  const { apiKey, aiProvider: provider, aiModel: model } = useAppContext() as {
    apiKey: string;
    aiProvider: string;
    aiModel: string;
  };

  const [activeTab, setActiveTab] = useState<SequenceType>("cpl");
  const [emails, setEmails] = useState<Record<SequenceType, EmailItem[]>>({
    cpl: [], vendas: [], recuperacao: [],
  });
  const [loading, setLoading] = useState<SequenceType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [copied, setCopied] = useState<string | null>(null);

  const currentEmails = emails[activeTab];

  const generate = async () => {
    setLoading(activeTab);
    setError(null);
    try {
      const res = await fetch("/api/generate-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandInfo,          // already includes mecanismo, preco, provas if filled
          sequenceType: activeTab,
          apiKey: apiKey || undefined,
          aiProvider: apiKey ? provider : undefined,
          aiModel: apiKey ? model : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erro ao gerar emails");
      }
      const data = await res.json();
      setEmails((prev) => ({ ...prev, [activeTab]: data.emails }));
      setExpanded(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(null);
    }
  };

  const formatEmailText = (email: EmailItem, idx: number, label?: string) => {
    const lines: string[] = [];
    lines.push(`=== EMAIL ${idx + 1}${label ? ` — ${label.toUpperCase()}` : ""} ===`);
    lines.push(`ASSUNTO A: ${email.subject}`);
    if (email.subject_b) lines.push(`ASSUNTO B: ${email.subject_b}`);
    if (email.subject_c) lines.push(`ASSUNTO C: ${email.subject_c}`);
    lines.push(`PRÉ-HEADER A: ${email.preview}`);
    if (email.preview_b) lines.push(`PRÉ-HEADER B: ${email.preview_b}`);
    lines.push("", email.body);
    if (email.cta) lines.push("", `CTA A: ${email.cta}`);
    if (email.cta_b) lines.push(`CTA B: ${email.cta_b}`);
    if (email.ps) lines.push("", `P.S.: ${email.ps}`);
    return lines.join("\n");
  };

  const copyEmail = async (email: EmailItem, idx: number) => {
    const text = formatEmailText(email, idx);
    await navigator.clipboard.writeText(text);
    setCopied(`${activeTab}-${idx}`);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyAll = async () => {
    if (currentEmails.length === 0) return;
    const tab = TABS.find((t) => t.id === activeTab)!;
    const text = currentEmails
      .map((e, i) => formatEmailText(e, i, tab.label))
      .join("\n\n" + "─".repeat(60) + "\n\n");
    await navigator.clipboard.writeText(text);
    setCopied("all");
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadAll = () => {
    if (currentEmails.length === 0) return;
    const tab = TABS.find((t) => t.id === activeTab)!;
    const text = currentEmails
      .map((e, i) => formatEmailText(e, i, tab.label))
      .join("\n\n" + "─".repeat(60) + "\n\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${brandInfo.productName.replace(/\s+/g, "-").toLowerCase()}-emails-${activeTab}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl bg-[#18181b] border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-white/30" />
          <span className="text-[13px] font-semibold text-white">Sequências de Email</span>
        </div>
        {currentEmails.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={copyAll}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-[11px] font-medium hover:text-white/70 hover:border-white/15 transition-colors cursor-pointer"
            >
              {copied === "all" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              Copiar tudo
            </button>
            <button
              onClick={downloadAll}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-[11px] font-medium hover:text-white/70 hover:border-white/15 transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3" />
              .txt
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.05]">
        {TABS.map((tab) => {
          const hasDone = emails[tab.id].length > 0;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setError(null); }}
              className={cn(
                "flex-1 flex flex-col items-center py-2.5 px-2 text-center transition-colors cursor-pointer border-b-2",
                activeTab === tab.id
                  ? "border-purple-500 text-white"
                  : "border-transparent text-white/30 hover:text-white/50"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold">{tab.label}</span>
                <span className={cn(
                  "text-[9px] px-1.5 py-0.5 rounded-full font-semibold",
                  hasDone
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-white/[0.06] text-white/30"
                )}>
                  {tab.count}
                </span>
              </div>
              <span className="text-[9px] text-white/25 mt-0.5 hidden sm:block">{tab.description}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-4">
        {currentEmails.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <Mail className="w-5 h-5 text-white/20" />
            </div>
            <p className="text-[12px] text-white/30 text-center max-w-[220px]">
              Gere {TABS.find((t) => t.id === activeTab)!.count} emails para a sequência de{" "}
              {TABS.find((t) => t.id === activeTab)!.label.toLowerCase()}
            </p>
            {error && (
              <p className="text-[11px] text-red-400 text-center px-4">{error}</p>
            )}
            <button
              onClick={generate}
              disabled={loading !== null}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all cursor-pointer",
                loading !== null
                  ? "bg-white/[0.04] text-white/20 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-500 text-white"
              )}
            >
              {loading === activeTab ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
              ) : (
                <><Zap className="w-3.5 h-3.5" /> Gerar sequência</>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {currentEmails.map((email, idx) => (
              <EmailCard
                key={idx}
                email={email}
                index={idx}
                expanded={expanded === idx}
                onToggle={() => setExpanded(expanded === idx ? null : idx)}
                onCopy={() => copyEmail(email, idx)}
                copied={copied === `${activeTab}-${idx}`}
              />
            ))}
            <button
              onClick={generate}
              disabled={loading !== null}
              className={cn(
                "w-full mt-3 flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-medium border border-white/[0.06] transition-all cursor-pointer",
                loading !== null
                  ? "text-white/20 cursor-not-allowed"
                  : "text-white/35 hover:text-white/60 hover:border-white/15"
              )}
            >
              {loading === activeTab ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Regenerando...</>
              ) : (
                <><Zap className="w-3 h-3" /> Regenerar sequência</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Email Card ─────────────────────────────────────────── */
function VariantRow({ label, values }: { label: string; values: (string | undefined)[] }) {
  const valid = values.filter(Boolean) as string[];
  if (valid.length === 0) return null;
  return (
    <div className="mb-3">
      <span className="text-[9px] uppercase tracking-widest text-white/20 font-semibold block mb-1.5">{label}</span>
      <div className="space-y-1">
        {valid.map((v, i) => (
          <div key={i} className="flex items-start gap-2">
            {valid.length > 1 && (
              <span className="shrink-0 mt-0.5 text-[8px] font-bold text-white/20 w-3">{String.fromCharCode(65 + i)}</span>
            )}
            <p className="text-[12px] text-white/70 leading-snug">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmailCard({
  email, index, expanded, onToggle, onCopy, copied,
}: {
  email: EmailItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border transition-colors",
      expanded ? "border-white/[0.1] bg-white/[0.03]" : "border-white/[0.05] bg-white/[0.015] hover:border-white/[0.08]"
    )}>
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer"
        onClick={onToggle}
      >
        <span className="shrink-0 w-5 h-5 rounded-md bg-purple-500/10 text-purple-400 text-[9px] font-bold flex items-center justify-center">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-white truncate">{email.subject}</p>
          <p className="text-[10px] text-white/30 truncate mt-0.5">{email.preview}</p>
        </div>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-white/20 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-white/20 shrink-0" />
        }
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-white/[0.05]">
          <div className="flex items-start justify-between gap-2 pt-2.5 mb-3">
            <div className="flex-1 space-y-0">
              <VariantRow label="Assunto" values={[email.subject, email.subject_b, email.subject_c]} />
              <VariantRow label="Pré-header" values={[email.preview, email.preview_b]} />
            </div>
            <button
              onClick={onCopy}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-[10px] font-medium hover:text-white/70 hover:border-white/15 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>

          <div className="mb-3">
            <span className="text-[9px] uppercase tracking-widest text-white/20 font-semibold block mb-2">Corpo do email</span>
            <div className="bg-black/20 rounded-lg px-3 py-3">
              {email.body.split("\n\n").map((para, i) => (
                <p key={i} className="text-[12px] text-white/60 leading-relaxed mb-2 last:mb-0">{para}</p>
              ))}
            </div>
          </div>

          {(email.cta || email.cta_b) && (
            <VariantRow label="CTA" values={[email.cta, email.cta_b]} />
          )}

          {email.ps && (
            <div>
              <span className="text-[9px] uppercase tracking-widest text-white/20 font-semibold block mb-1">P.S.</span>
              <p className="text-[11px] text-white/40 italic leading-snug">{email.ps}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
