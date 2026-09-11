"use client";

import { Fragment, useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import {
  Activity, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, ExternalLink, Loader2, Clock,
  Timer, ShieldAlert, Lock, LockOpen, AlertTriangle, Siren, Globe, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Monitor = Database["public"]["Tables"]["page_monitors"]["Row"];
type Incident = Database["public"]["Tables"]["page_monitor_incidents"]["Row"];
type PageStatus = NonNullable<Monitor["page_status"]>;
type SslStatus = NonNullable<Monitor["ssl_status"]>;

/* Mesmo limiar de "lento" usado no check (ver src/lib/page-monitor/server.ts) —
 * duplicado aqui só pra classificar "muito lento" (1.5x) na seção de risco,
 * igual à referência (monitora-prymo). */
const SLOW_THRESHOLD_MS = 3000;

const STATUS_CONFIG: Record<PageStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  ONLINE: { label: "Online", color: "text-emerald-400", bg: "bg-emerald-500/15", icon: CheckCircle2 },
  LENTO: { label: "Lento", color: "text-amber-400", bg: "bg-amber-500/15", icon: Timer },
  OFFLINE: { label: "Offline", color: "text-red-400", bg: "bg-red-500/15", icon: XCircle },
  BLOQUEADO: { label: "Bloqueado", color: "text-purple-400", bg: "bg-purple-500/15", icon: ShieldAlert },
  TIMEOUT: { label: "Timeout", color: "text-white/40", bg: "bg-white/[0.06]", icon: Clock },
};

const SSL_LABEL: Record<SslStatus, string> = {
  valid: "SSL ok",
  expiring_soon: "SSL vence em breve",
  critical: "SSL crítico",
  expired: "SSL expirado",
  error: "SSL — erro na checagem",
  no_ssl: "Sem HTTPS",
};

function sslColor(status: SslStatus): string {
  if (status === "valid") return "text-emerald-400/70";
  if (status === "expiring_soon") return "text-amber-400/70";
  if (status === "critical" || status === "expired") return "text-red-400/80";
  return "text-white/25";
}

function scoreColor(score: number | null): string {
  if (score === null) return "text-white/20";
  if (score >= 90) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "nunca verificado";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora mesmo";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

interface RiskReason { monitor: Monitor; reasons: string[] }

/** Mesmo critério de "em risco" da referência (monitora-prymo/app/page.tsx,
 * attentionCount): status ruim, resposta muito lenta (1.5x o limiar),
 * SSL crítico/expirado, ou falhas consecutivas >= 2 — mesmo que o status
 * atual já tenha "cicatrizado" num check isolado. */
function computeRisk(m: Monitor): string[] {
  const reasons: string[] = [];
  if (m.page_status === "OFFLINE") reasons.push(m.is_soft_404 ? "Soft 404" : "Offline");
  if (m.page_status === "BLOQUEADO") reasons.push("Bloqueado (WAF/CAPTCHA)");
  if (m.page_status === "TIMEOUT") reasons.push("Timeout");
  if (m.response_time_ms !== null && m.response_time_ms > SLOW_THRESHOLD_MS * 1.5) reasons.push(`Resposta muito lenta (${m.response_time_ms}ms)`);
  if (m.ssl_status === "critical" || m.ssl_status === "expired") reasons.push(m.ssl_status === "expired" ? "SSL expirado" : `SSL crítico (${m.ssl_days_remaining}d)`);
  if (m.consecutive_failures >= 2) reasons.push(`${m.consecutive_failures} falhas seguidas`);
  return reasons;
}

export function PageMonitorView() {
  const supabase = useMemo(() => createClient(), []);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [urlInput, setUrlInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [openIncidentsByMonitor, setOpenIncidentsByMonitor] = useState<Map<string, Incident[]>>(new Map());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: incidents }] = await Promise.all([
      supabase.from("page_monitors").select("*").order("created_at", { ascending: false }),
      supabase.from("page_monitor_incidents").select("*").is("resolved_at", null),
    ]);
    setMonitors(data ?? []);
    const byMonitor = new Map<string, Incident[]>();
    for (const inc of incidents ?? []) {
      const list = byMonitor.get(inc.page_monitor_id) ?? [];
      list.push(inc);
      byMonitor.set(inc.page_monitor_id, list);
    }
    setOpenIncidentsByMonitor(byMonitor);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setAdding(true);
    setAddError(null);
    try {
      const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      new URL(normalized); // valida formato antes de gravar
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada — faça login novamente.");
      const { data, error } = await supabase
        .from("page_monitors")
        .insert({ user_id: user.id, url: normalized, label: labelInput.trim() || null })
        .select()
        .single();
      if (error) throw new Error(error.message);
      setMonitors((prev) => [data, ...prev]);
      setUrlInput("");
      setLabelInput("");
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "URL inválida.");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    setMonitors((prev) => prev.filter((m) => m.id !== id));
    await supabase.from("page_monitors").delete().eq("id", id);
  };

  const handleCheck = async (id: string) => {
    setCheckingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/page-monitors/${id}/check`, { method: "POST" });
      if (res.ok) {
        // Não só atualiza a linha — uma checagem pode abrir/fechar um
        // incidente, então recarrega tudo pra refletir isso também.
        await load();
      }
    } catch {
      /* falha na checagem fica visível pelo estado não atualizado — usuário tenta de novo */
    } finally {
      setCheckingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const counts = useMemo(() => {
    const c = { total: monitors.length, online: 0, offline: 0, lento: 0, soft404: 0, timeout: 0, bloqueado: 0 };
    for (const m of monitors) {
      if (m.page_status === "ONLINE") c.online += 1;
      else if (m.page_status === "LENTO") c.lento += 1;
      else if (m.page_status === "OFFLINE") { c.offline += 1; if (m.is_soft_404) c.soft404 += 1; }
      else if (m.page_status === "TIMEOUT") c.timeout += 1;
      else if (m.page_status === "BLOQUEADO") c.bloqueado += 1;
    }
    return c;
  }, [monitors]);

  const atRisk: RiskReason[] = useMemo(() => {
    return monitors
      .map((m) => ({ monitor: m, reasons: computeRisk(m) }))
      .filter((r) => r.reasons.length > 0)
      .sort((a, b) => b.reasons.length - a.reasons.length);
  }, [monitors]);

  const hasProblems = counts.offline + counts.timeout + counts.bloqueado > 0;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0e]">
      <div className="flex items-center gap-3 px-8 py-5 border-b border-white/[0.05] shrink-0">
        <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
          <Activity className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold text-white/90">Monitoramento</h1>
          <p className="text-[11px] text-white/30">Status e SSL checados automaticamente 1x/dia · PageSpeed sob demanda</p>
        </div>
      </div>

      <div className="shrink-0 px-8 pt-5 flex items-start gap-2 flex-wrap">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !adding) handleAdd(); }}
          placeholder="URL da página do cliente (ex: sitedocliente.com.br)"
          className="flex-1 min-w-[240px] px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[12px] text-white placeholder:text-white/20 outline-none focus:border-purple-500/30"
        />
        <input
          value={labelInput}
          onChange={(e) => setLabelInput(e.target.value)}
          placeholder="Nome do cliente (opcional)"
          className="w-[220px] px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[12px] text-white placeholder:text-white/20 outline-none focus:border-purple-500/30"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !urlInput.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Adicionar
        </button>
      </div>
      {addError && <p className="px-8 pt-2 text-[11px] text-red-400">{addError}</p>}

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-5 h-5 text-white/30 animate-spin" />
          </div>
        ) : monitors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
            <Activity className="w-8 h-8 text-white/10" />
            <p className="text-[13px] text-white/30">Nenhuma página monitorada ainda — cola a URL de um cliente acima.</p>
          </div>
        ) : (
          <>
            {/* Cards de contagem — mesma ideia da home do monitora-prymo */}
            <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
              {([
                { label: "Total", value: counts.total, icon: Globe, tone: "neutral" as const },
                { label: "Online", value: counts.online, icon: CheckCircle2, tone: "ok" as const },
                { label: "Offline", value: counts.offline, icon: XCircle, tone: "danger" as const },
                { label: "Lento", value: counts.lento, icon: Timer, tone: "warning" as const },
                { label: "Soft 404", value: counts.soft404, icon: AlertTriangle, tone: "danger" as const },
                { label: "Timeout", value: counts.timeout, icon: Clock, tone: "danger" as const },
                { label: "Bloqueado", value: counts.bloqueado, icon: ShieldAlert, tone: "danger" as const },
              ]).map((card) => (
                <div
                  key={card.label}
                  className={cn(
                    "rounded-2xl border px-3.5 py-3 flex flex-col gap-2",
                    card.tone === "danger" && card.value > 0 ? "border-red-500/25 bg-red-500/[0.05]" :
                    card.tone === "warning" && card.value > 0 ? "border-amber-500/25 bg-amber-500/[0.05]" :
                    card.tone === "ok" && card.value > 0 ? "border-emerald-500/20 bg-emerald-500/[0.04]" :
                    "border-white/[0.06] bg-white/[0.02]"
                  )}
                >
                  <card.icon className={cn(
                    "w-4 h-4",
                    card.tone === "danger" && card.value > 0 ? "text-red-400" :
                    card.tone === "warning" && card.value > 0 ? "text-amber-400" :
                    card.tone === "ok" && card.value > 0 ? "text-emerald-400" : "text-white/25"
                  )} />
                  <div>
                    <p className="text-[20px] font-bold text-white/90 leading-none tabular-nums">{card.value}</p>
                    <p className="text-[9px] text-white/30 uppercase tracking-wide mt-1">{card.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {hasProblems && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-[12px] text-red-300">
                  Atenção: {counts.offline + counts.timeout + counts.bloqueado} página(s) com problema detectado agora.
                </p>
              </div>
            )}

            {/* Páginas em risco — mesmo critério da referência: status ruim,
                resposta 1.5x acima do limiar, SSL crítico, ou 2+ falhas seguidas. */}
            {atRisk.length > 0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-500/10">
                  <Siren className="w-3.5 h-3.5 text-amber-400" />
                  <p className="text-[12px] font-semibold text-amber-300">Páginas em risco ({atRisk.length})</p>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {atRisk.slice(0, 6).map(({ monitor: m, reasons }) => (
                    <button
                      key={m.id}
                      onClick={() => setExpandedId(m.id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <span className="text-[11px] text-white/70 truncate">{m.label || new URL(m.url).hostname}</span>
                      <span className="text-[10px] text-amber-400/80 shrink-0 truncate max-w-[50%]">{reasons.join(" · ")}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tabela de páginas monitoradas */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wide">Páginas monitoradas</p>
                <span className="text-[10px] text-white/25">{monitors.length} página{monitors.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]" style={{ minWidth: 980 }}>
                  <thead className="bg-[#111116]">
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">Página</th>
                      <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">Status</th>
                      <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">HTTP</th>
                      <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">Tempo</th>
                      <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">SSL</th>
                      <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">PageSpeed</th>
                      <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">Checagem</th>
                      <th className="text-right px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitors.map((m) => {
                      const isChecking = checkingIds.has(m.id);
                      const neverChecked = !m.last_checked_at;
                      const status = m.page_status;
                      const StatusIcon = status ? STATUS_CONFIG[status].icon : Clock;
                      const openIncidents = openIncidentsByMonitor.get(m.id) ?? [];
                      const isUrgent = status === "OFFLINE" || status === "BLOQUEADO";
                      const isWarning = status === "LENTO" || status === "TIMEOUT";
                      const isExpanded = expandedId === m.id;
                      const detailReason = m.blocked ? m.block_reason : m.is_soft_404 ? "Soft 404 detectado (página de erro disfarçada de HTTP 200)" : !m.is_up ? m.check_error : null;

                      return (
                        <Fragment key={m.id}>
                          <tr
                            onClick={() => setExpandedId(isExpanded ? null : m.id)}
                            className={cn(
                              "border-b border-white/[0.04] last:border-b-0 cursor-pointer transition-colors",
                              isUrgent ? "bg-red-500/[0.04] hover:bg-red-500/[0.07]" : isWarning ? "bg-amber-500/[0.03] hover:bg-amber-500/[0.06]" : "hover:bg-white/[0.02]"
                            )}
                          >
                            <td className="px-3 py-2.5 max-w-[220px]">
                              <div className="flex items-center gap-1.5">
                                <p className="text-white/80 font-medium truncate">{m.label || new URL(m.url).hostname}</p>
                                <a href={m.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-white/25 hover:text-white/60 shrink-0">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                                {isExpanded ? <ChevronUp className="w-3 h-3 text-white/20 shrink-0" /> : <ChevronDown className="w-3 h-3 text-white/20 shrink-0" />}
                              </div>
                              <p className="text-[10px] text-white/25 truncate">{m.url}</p>
                            </td>
                            <td className="px-3 py-2.5">
                              {neverChecked ? (
                                <span className="flex items-center gap-1 text-[10px] text-white/30"><Clock className="w-3 h-3" /> Não verificado</span>
                              ) : status ? (
                                <span className={cn("flex items-center gap-1 w-fit text-[10px] font-semibold px-1.5 py-0.5 rounded-full", STATUS_CONFIG[status].bg, STATUS_CONFIG[status].color)}>
                                  <StatusIcon className="w-3 h-3" /> {STATUS_CONFIG[status].label}
                                </span>
                              ) : null}
                              {openIncidents.length > 0 && (
                                <span className="flex items-center gap-1 text-[9px] text-red-400/80 mt-1"><Siren className="w-2.5 h-2.5" /> {openIncidents.length > 1 ? `${openIncidents.length} incidentes` : "Incidente aberto"}</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-white/50 whitespace-nowrap">{m.http_status ?? "—"}</td>
                            <td className="px-3 py-2.5 text-white/50 whitespace-nowrap">{m.response_time_ms !== null ? `${m.response_time_ms}ms` : "—"}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {m.ssl_status ? (
                                <span className={cn("flex items-center gap-1 text-[10px]", sslColor(m.ssl_status))} title={m.ssl_issuer ?? undefined}>
                                  {m.ssl_status === "valid" ? <Lock className="w-3 h-3" /> : m.ssl_status === "no_ssl" ? <LockOpen className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                  {m.ssl_days_remaining !== null && m.ssl_status !== "no_ssl" && m.ssl_status !== "error" ? `${m.ssl_days_remaining}d` : SSL_LABEL[m.ssl_status]}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-2.5">
                              {m.pagespeed_performance !== null ? (
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("text-[11px] font-bold tabular-nums", scoreColor(m.pagespeed_performance))} title="Performance">{m.pagespeed_performance}</span>
                                  <span className={cn("text-[11px] font-bold tabular-nums", scoreColor(m.pagespeed_seo))} title="SEO">{m.pagespeed_seo}</span>
                                  <span className={cn("text-[11px] font-bold tabular-nums", scoreColor(m.pagespeed_accessibility))} title="Acessibilidade">{m.pagespeed_accessibility}</span>
                                  <span className={cn("text-[11px] font-bold tabular-nums", scoreColor(m.pagespeed_best_practices))} title="Boas Práticas">{m.pagespeed_best_practices}</span>
                                </div>
                              ) : m.pagespeed_error ? (
                                <span className="text-[9px] text-amber-400/70">Falhou</span>
                              ) : (
                                <span className="text-[10px] text-white/20">Pendente</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-white/30 whitespace-nowrap text-[10px]">{timeAgo(m.last_checked_at)}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCheck(m.id); }}
                                  disabled={isChecking}
                                  title="Verificar agora"
                                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white/80 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                  {isChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemove(m.id); }}
                                  title="Remover"
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-black/20 border-b border-white/[0.04]">
                              <td colSpan={8} className="px-4 py-3">
                                <div className="grid grid-cols-3 gap-4 text-[11px]">
                                  <div>
                                    <p className="text-white/25 text-[9px] uppercase tracking-wide mb-1">Web Vitals</p>
                                    <p className="text-white/60">LCP {m.pagespeed_lcp ?? "—"}ms · CLS {m.pagespeed_cls ?? "—"} · TBT {m.pagespeed_tbt ?? "—"}ms</p>
                                  </div>
                                  {detailReason && (
                                    <div>
                                      <p className="text-white/25 text-[9px] uppercase tracking-wide mb-1">Motivo</p>
                                      <p className="text-red-400/80">{detailReason}</p>
                                    </div>
                                  )}
                                  {openIncidents.length > 0 && (
                                    <div>
                                      <p className="text-white/25 text-[9px] uppercase tracking-wide mb-1">Incidentes abertos</p>
                                      {openIncidents.map((inc) => (
                                        <p key={inc.id} className="text-red-400/70">{inc.type === "SSL" ? "SSL" : "Uptime"} desde {timeAgo(inc.started_at)}{inc.probable_cause ? ` — ${inc.probable_cause}` : ""}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
