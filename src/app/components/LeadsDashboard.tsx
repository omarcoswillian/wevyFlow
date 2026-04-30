"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Download, Trash2, RefreshCw, Mail, Phone, Search, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  page_slug: string | null;
  page_title: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  extra: Record<string, string> | null;
  utm_source: string | null;
  utm_campaign: string | null;
  created_at: string;
}

export function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSlug, setFilterSlug] = useState<string>("all");

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      if (!res.ok) return;
      const data = await res.json();
      setLeads(data.leads ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const slugs = ["all", ...Array.from(new Set(leads.map((l) => l.page_slug).filter(Boolean)))] as string[];

  const filtered = leads.filter((l) => {
    if (filterSlug !== "all" && l.page_slug !== filterSlug) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q) ||
      l.phone?.includes(q) ||
      l.page_slug?.includes(q)
    );
  });

  const handleExportCSV = () => {
    const rows = [
      ["Nome", "Email", "Telefone", "Página", "Fonte", "Campanha", "Data"],
      ...filtered.map((l) => [
        l.name ?? "",
        l.email ?? "",
        l.phone ?? "",
        l.page_slug ?? "",
        l.utm_source ?? "",
        l.utm_campaign ?? "",
        new Date(l.created_at).toLocaleString("pt-BR"),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-wevyflow-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Apagar este lead?")) return;
    await fetch("/api/leads", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setLeads((prev) => prev.filter((l) => l.id !== id));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 text-white/20 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[20px] font-bold text-white">Leads Capturados</h1>
            <p className="text-[12px] text-white/40 mt-0.5">{leads.length} lead{leads.length !== 1 ? "s" : ""} no total</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadLeads} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-colors cursor-pointer" title="Atualizar">
              <RefreshCw className="w-4 h-4" />
            </button>
            {filtered.length > 0 && (
              <button onClick={handleExportCSV} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold transition-colors cursor-pointer">
                <Download className="w-3.5 h-3.5" /> Exportar CSV
              </button>
            )}
          </div>
        </div>

        {leads.length === 0 ? (
          <EmptyLeads />
        ) : (
          <>
            {/* filters */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nome, email..."
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg pl-9 pr-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30"
                />
              </div>
              <div className="flex gap-1">
                {slugs.map((s) => (
                  <button key={s} onClick={() => setFilterSlug(s)}
                    className={cn("px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                      filterSlug === s ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-white/40 hover:text-white/60 hover:bg-white/[0.04]")}>
                    {s === "all" ? "Todos" : s}
                  </button>
                ))}
              </div>
            </div>

            {/* table */}
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Contato</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Página</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider hidden md:table-cell">Origem</th>
                    <th className="text-left px-4 py-3 text-[10px] font-semibold text-white/30 uppercase tracking-wider hidden lg:table-cell">Data</th>
                    <th className="px-4 py-3 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead, i) => (
                    <tr key={lead.id} className={cn("border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors", i === filtered.length - 1 && "border-0")}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 text-[10px] font-bold">
                            {(lead.name || lead.email || "?")[0].toUpperCase()}
                          </div>
                          <div>
                            {lead.name && <p className="text-[12px] font-medium text-white/80">{lead.name}</p>}
                            {lead.email && (
                              <div className="flex items-center gap-1">
                                <Mail className="w-2.5 h-2.5 text-white/25" />
                                <span className="text-[11px] text-white/45">{lead.email}</span>
                              </div>
                            )}
                            {lead.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5 text-white/25" />
                                <span className="text-[11px] text-white/45">{lead.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {lead.page_slug ? (
                          <a href={`/p/${lead.page_slug}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300">
                            {lead.page_title || lead.page_slug} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ) : <span className="text-[11px] text-white/20">—</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {lead.utm_source ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-white/40">{lead.utm_source}{lead.utm_campaign ? ` / ${lead.utm_campaign}` : ""}</span>
                        ) : <span className="text-[11px] text-white/20">orgânico</span>}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-white/30 hidden lg:table-cell">
                        {new Date(lead.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(lead.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/15 hover:text-red-400 transition-colors cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyLeads() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <Users className="w-6 h-6 text-white/20" />
      </div>
      <h3 className="text-[14px] font-semibold text-white/60 mb-1">Nenhum lead ainda</h3>
      <p className="text-[11px] text-white/30 max-w-xs leading-relaxed">
        Publique uma página de captura na WevyFlow — quando alguém preencher o formulário, o lead aparece aqui automaticamente.
      </p>
    </div>
  );
}
