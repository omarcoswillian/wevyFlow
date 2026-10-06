"use client";

import { useState } from "react";
import { Video as VideoIcon, Megaphone, Star, Copy, Check, ImagePlus, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, Flame, FlaskConical, Pause, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdCreative, SortDirection, SortKey } from "./types";
import { formatDatePtBr } from "./date-range";
import { CONFIDENCE_LABEL, VERDICT_LABEL, formatMoney, formatRoas } from "./format";

const SOURCE_LABELS: Record<AdCreative["source"], string> = {
  mock: "Demo",
  meta_ad_library: "Meta Library",
  foreplay: "Foreplay",
  meta_ads_api: "Meta Ads",
};

const PAGE_SIZE_OPTIONS = [25, 50, 100];

function VerdictPill({ creative }: { creative: AdCreative }) {
  if (!creative.verdict) return <span className="text-white/20">—</span>;
  const tone =
    creative.verdict === "winner" ? "bg-emerald-500/15 text-emerald-300"
    : creative.verdict === "loser" ? "bg-red-500/15 text-red-300"
    : "bg-white/[0.06] text-white/45";
  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap w-fit", tone)}>{VERDICT_LABEL[creative.verdict]}</span>
      {creative.confidence && creative.verdict !== "insufficient" && (
        <span className="text-[9px] text-white/30 whitespace-nowrap">{CONFIDENCE_LABEL[creative.confidence]}</span>
      )}
    </div>
  );
}

function StatusPill({ creative }: { creative: AdCreative }) {
  if (creative.status === "inactive") {
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40 text-[10px] font-semibold whitespace-nowrap">
        <Pause className="w-3 h-3" /> Pausado
      </span>
    );
  }
  if (creative.daysRunning >= 14) {
    return (
      <span title="Sinal baseado em tempo no ar — não representa vendas ou ROAS" className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold whitespace-nowrap">
        <Flame className="w-3 h-3" /> Provável vencedor
      </span>
    );
  }
  return (
    <span title="Sinal baseado em tempo no ar — não representa vendas ou ROAS" className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 text-[10px] font-semibold whitespace-nowrap">
      <FlaskConical className="w-3 h-3" /> Em teste
    </span>
  );
}

function Thumbnail({ creative }: { creative: AdCreative }) {
  const [broken, setBroken] = useState(false);
  if (!creative.thumbnailUrl || broken) {
    return (
      <div className="w-16 h-16 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
        <Megaphone className="w-5 h-5 text-white/15" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={creative.thumbnailUrl}
      alt={creative.headline ?? creative.advertiserName}
      onError={() => setBroken(true)}
      className="w-16 h-16 rounded-xl object-cover border border-white/[0.06] shrink-0"
    />
  );
}

function SortHeader({ label, sortKey, activeKey, direction, onSort }: {
  label: string; sortKey: SortKey; activeKey: SortKey; direction: SortDirection; onSort: (key: SortKey) => void;
}) {
  const active = sortKey === activeKey;
  return (
    <th
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
      className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold whitespace-nowrap"
    >
      <button
        onClick={() => onSort(sortKey)}
        className="flex items-center gap-1 cursor-pointer hover:text-white/60 transition-colors"
      >
        {label}
        {active ? (direction === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-2.5 h-2.5 opacity-30" />}
      </button>
    </th>
  );
}

interface AdsTableProps {
  creatives: AdCreative[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  hasAnyCreatives: boolean;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onPreview: (creative: AdCreative) => void;
  onToggleFavorite: (creative: AdCreative) => void;
  onUseAsReference: (creative: AdCreative) => void;
  showPerformance?: boolean;
  currency?: string | null;
}

export function AdsTable({
  creatives, loading, error, onRetry, hasAnyCreatives, onClearFilters, hasActiveFilters,
  sortKey, sortDirection, onSort, page, pageSize, onPageChange, onPageSizeChange,
  onPreview, onToggleFavorite, onUseAsReference, showPerformance = false, currency = null,
}: AdsTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyErrorId, setCopyErrorId] = useState<string | null>(null);

  const handleCopy = async (creative: AdCreative) => {
    const text = [creative.headline, creative.body].filter(Boolean).join("\n\n");
    if (!text) return;
    try {
      // Aguarda a Promise — sem isso, "Copiado!" aparecia mesmo quando a
      // permissão de clipboard falhava (ex: iframe, HTTP sem foco).
      await navigator.clipboard.writeText(text);
      setCopiedId(creative.id);
      setTimeout(() => setCopiedId((id) => (id === creative.id ? null : id)), 1800);
    } catch {
      setCopyErrorId(creative.id);
      setTimeout(() => setCopyErrorId((id) => (id === creative.id ? null : id)), 1800);
    }
  };

  const total = creatives.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = creatives.slice(startIdx, startIdx + pageSize);

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-16 h-16 rounded-xl bg-white/[0.05] shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 rounded bg-white/[0.05]" />
                <div className="h-3 w-2/3 rounded bg-white/[0.04]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] px-6 py-10 flex flex-col items-center gap-3 text-center">
        <p className="text-[13px] text-red-300">Não deu pra carregar os anúncios: {error}</p>
        <button onClick={onRetry} className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/70 text-[11px] font-medium cursor-pointer transition-colors">
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!hasAnyCreatives) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-14 flex flex-col items-center gap-2 text-center">
        <Megaphone className="w-7 h-7 text-white/10" />
        <p className="text-[13px] text-white/30">Nenhuma fonte de anúncios conectada ainda.</p>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-14 flex flex-col items-center gap-3 text-center">
        <Megaphone className="w-7 h-7 text-white/10" />
        <p className="text-[13px] text-white/30">Nenhum anúncio corresponde aos filtros.</p>
        {hasActiveFilters && (
          <button onClick={onClearFilters} className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/70 text-[11px] font-medium cursor-pointer transition-colors">
            Limpar filtros
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]" style={{ minWidth: showPerformance ? 1560 : 1240 }}>
            <thead className="bg-[#111116] sticky top-0 z-10">
              <tr className="border-b border-white/[0.06]">
                <th className="w-10 px-3 py-2.5" />
                <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">Criativo</th>
                <SortHeader label="Anunciante" sortKey="advertiserName" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">Texto</th>
                <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">Plataformas</th>
                <SortHeader label="Status" sortKey="status" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                {showPerformance && <SortHeader label="Gasto" sortKey="spend" activeKey={sortKey} direction={sortDirection} onSort={onSort} />}
                {showPerformance && <SortHeader label="Compras" sortKey="purchases" activeKey={sortKey} direction={sortDirection} onSort={onSort} />}
                {showPerformance && <SortHeader label="ROAS" sortKey="roas" activeKey={sortKey} direction={sortDirection} onSort={onSort} />}
                {showPerformance && <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">Resultado</th>}
                <SortHeader label="Início" sortKey="startedAt" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                <SortHeader label="Término" sortKey="stoppedAt" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                <SortHeader label="Tempo no ar" sortKey="daysRunning" activeKey={sortKey} direction={sortDirection} onSort={onSort} />
                <th className="text-left px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">Fonte</th>
                <th className="text-right px-3 py-2.5 text-[10px] uppercase tracking-wider text-white/35 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c) => (
                <tr key={c.id} className="border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-2.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleFavorite(c); }}
                      title={c.isFavorite ? "Remover dos favoritos" : "Favoritar"}
                      className="cursor-pointer"
                    >
                      <Star className={cn("w-4 h-4 transition-colors", c.isFavorite ? "fill-amber-400 text-amber-400" : "text-white/15 hover:text-white/40")} />
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => onPreview(c)} className="cursor-pointer">
                      <Thumbnail creative={c} />
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-white/70 font-medium max-w-[160px] truncate">{c.advertiserName}</td>
                  <td className="px-3 py-2.5 max-w-[260px]">
                    {c.headline || c.body ? (
                      <>
                        {c.headline && <p className="text-white/80 line-clamp-2 leading-snug">{c.headline}</p>}
                        {c.body && <p className="text-white/35 line-clamp-2 leading-snug mt-0.5">{c.body}</p>}
                      </>
                    ) : (
                      <span className="text-white/20">Sem texto</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      {c.platforms.map((p) => (
                        <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/40 uppercase font-semibold">{p.slice(0, 2)}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <StatusPill creative={c} />
                      {c.mediaType === "video" && (
                        <span className="flex items-center gap-1 text-[9px] text-white/35"><VideoIcon className="w-3 h-3" /> Vídeo</span>
                      )}
                    </div>
                  </td>
                  {showPerformance && <td className="px-3 py-2.5 text-white/70 whitespace-nowrap">{c.metrics ? formatMoney(c.metrics.spend, currency) : "—"}</td>}
                  {showPerformance && <td className="px-3 py-2.5 text-white/70">{c.metrics ? c.metrics.purchases : "—"}</td>}
                  {showPerformance && <td className="px-3 py-2.5 text-white/80 font-medium whitespace-nowrap">{c.metrics ? formatRoas(c.metrics.roas) : "—"}</td>}
                  {showPerformance && <td className="px-3 py-2.5"><VerdictPill creative={c} /></td>}
                  <td className="px-3 py-2.5 text-white/45 whitespace-nowrap">{formatDatePtBr(c.startedAt)}</td>
                  <td className="px-3 py-2.5 text-white/45 whitespace-nowrap">{c.stoppedAt ? formatDatePtBr(c.stoppedAt) : "—"}</td>
                  <td className="px-3 py-2.5 text-white/70 font-medium whitespace-nowrap">{c.daysRunning}d</td>
                  <td className="px-3 py-2.5">
                    <span className={cn("text-[10px] font-semibold whitespace-nowrap", c.source === "mock" ? "text-amber-400" : "text-white/40")}>
                      {SOURCE_LABELS[c.source]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(c); }}
                        title="Copiar texto"
                        disabled={!c.headline && !c.body}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        {copiedId === c.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : copyErrorId === c.id ? <AlertCircle className="w-3.5 h-3.5 text-red-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onUseAsReference(c); }}
                        title={c.thumbnailUrl ? "Usar como referência nos geradores" : "Sem imagem pra usar como referência"}
                        disabled={!c.thumbnailUrl}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-purple-300 hover:bg-purple-500/10 transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ImagePlus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-[11px] text-white/30">
          <span>{total === 0 ? "0" : `${startIdx + 1}–${Math.min(startIdx + pageSize, total)}`} de {total}</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-[11px] text-white/50 outline-none cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}/página</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-white/40 px-1">{currentPage} / {totalPages}</span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
