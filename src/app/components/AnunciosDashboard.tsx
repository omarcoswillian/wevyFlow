"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Megaphone, BarChart3, Info, Search, X, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";
import type { AdCreative, AdFilters, DatePreset, DateRange, SortDirection, SortKey } from "./anuncios/types";
import { resolveDateRange, isCreativeInRange } from "./anuncios/date-range";
import { AdDateRangeFilter } from "./anuncios/AdDateRangeFilter";
import { AdsTable } from "./anuncios/AdsTable";
import { AdPreviewModal } from "./anuncios/AdPreviewModal";
import { MetaAdsConnectionCard } from "./anuncios/MetaAdsConnectionCard";

const AdsMetrics = dynamic(() => import("./anuncios/AdsMetrics"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 flex items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
    </div>
  ),
});

type Row = Database["public"]["Tables"]["ad_watch_creatives"]["Row"];

/* Realistic Brazilian infoproduct-style placeholders — clearly labeled as
 * mock in the UI. Seeded once per user on first visit (source: "mock") so
 * the screen isn't empty while no real data source (Meta Ad Library API /
 * Foreplay) is connected yet. Swap this out once a real ingestion pipeline
 * exists — see memória project-roadmap-ads-loop. Same thumbnail URLs as the
 * backfill in supabase/migrations/20260910000007, so fresh seeds and
 * already-seeded rows look the same. */
/* IDs fixos (não gen_random_uuid()) — necessário pra seedMockCreatives
 * poder fazer upsert idempotente (ver comentário lá) em vez de insert puro,
 * que duplicava as 7 linhas quando o efeito de carga rodava duas vezes
 * (Strict Mode) ou em duas abas ao mesmo tempo. */
const MOCK_SEED: Omit<AdCreative, "daysRunning" | "isFavorite">[] = [
  {
    id: "00000000-0000-4000-a000-000000000001",
    source: "mock", advertiserName: "Método Ascensão", platforms: ["facebook", "instagram"], status: "active",
    headline: "Como sair do zero a R$10k/mês em 90 dias",
    body: "Chega de trabalhar pro patrão. Turma nova abre HOJE — vagas limitadas.",
    thumbnailUrl: "/library-seed/formagios/AD01V1-FEED.jpg", startedAt: Date.now() - 42 * 86400000, stoppedAt: null,
  },
  {
    id: "00000000-0000-4000-a000-000000000002",
    source: "mock", advertiserName: "Método Ascensão", platforms: ["instagram"], status: "active",
    headline: "3 erros que travam seu primeiro cliente",
    body: "Descobri isso depois de 2 anos apanhando. Você não precisa passar pelo mesmo.",
    thumbnailUrl: "/library-seed/formagios/AD02.jpg", startedAt: Date.now() - 28 * 86400000, stoppedAt: null,
  },
  {
    id: "00000000-0000-4000-a000-000000000003",
    source: "mock", advertiserName: "Carla Nutri Fit", platforms: ["facebook", "instagram"], status: "active",
    headline: "Reeducação alimentar sem passar fome",
    body: "Protocolo de 21 dias. Mais de 4.000 alunas já fizeram.",
    thumbnailUrl: "/library-seed/luana/AD02.png", startedAt: Date.now() - 19 * 86400000, stoppedAt: null,
  },
  {
    id: "00000000-0000-4000-a000-000000000004",
    source: "mock", advertiserName: "Carla Nutri Fit", platforms: ["facebook"], status: "inactive",
    headline: "Chá que acelera o metabolismo",
    body: "Testado por 30 dias. Resultado no espelho.",
    thumbnailUrl: "/library-seed/luana/AD05.png", startedAt: Date.now() - 35 * 86400000, stoppedAt: Date.now() - 31 * 86400000,
  },
  {
    id: "00000000-0000-4000-a000-000000000005",
    source: "mock", advertiserName: "Direito Fácil Concursos", platforms: ["instagram"], status: "active",
    headline: "Passei em 8 meses estudando 2h por dia",
    body: "O plano de estudos que uso com meus mentorados. Aula gratuita amanhã às 20h.",
    thumbnailUrl: "/library-seed/ed/ED-dark-001.png", startedAt: Date.now() - 6 * 86400000, stoppedAt: null,
  },
  {
    id: "00000000-0000-4000-a000-000000000006",
    source: "mock", advertiserName: "Direito Fácil Concursos", platforms: ["facebook", "instagram"], status: "active",
    headline: "Edital publicado — o que estudar primeiro",
    body: "Baixe o cronograma gratuito antes que todo mundo comece.",
    thumbnailUrl: "/library-seed/ed/ED-white-001.png", startedAt: Date.now() - 2 * 86400000, stoppedAt: null,
  },
  {
    id: "00000000-0000-4000-a000-000000000007",
    source: "mock", advertiserName: "Loja Bela Pele", platforms: ["instagram"], status: "inactive",
    headline: "Sérum que sumiu com minhas manchas",
    body: "Frete grátis só hoje. Estoque limitado.",
    thumbnailUrl: "/library-seed/rpe/RPE-white-001.png", startedAt: Date.now() - 12 * 86400000, stoppedAt: Date.now() - 9 * 86400000,
  },
];

function daysBetween(startMs: number, endMs: number): number {
  return Math.max(0, Math.round((endMs - startMs) / 86400000));
}

function mapRow(row: Row, now: number): AdCreative {
  const startedAt = new Date(row.started_at).getTime();
  const stoppedAt = row.stopped_at ? new Date(row.stopped_at).getTime() : null;
  return {
    id: row.id,
    source: row.source,
    advertiserName: row.advertiser_name,
    headline: row.headline,
    body: row.body,
    thumbnailUrl: row.thumbnail_url,
    platforms: row.platforms,
    status: row.status,
    startedAt,
    stoppedAt,
    daysRunning: daysBetween(startedAt, stoppedAt ?? now),
    isFavorite: row.is_favorite,
  };
}

/** Supabase caps unbounded selects at 1000 rows server-side — page through
 * with .range() so a growing watchlist never silently truncates. */
async function fetchAllCreatives(supabase: SupabaseClient<Database>): Promise<Row[]> {
  const PAGE = 1000;
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("ad_watch_creatives")
      .select("*")
      // Desempate por id: sem ele, empates em started_at na fronteira de
      // duas páginas do .range() não têm ordem garantida — uma linha pode
      // repetir ou sumir entre páginas.
      .order("started_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** IDs fixos + upsert com ignoreDuplicates: duas execuções concorrentes do
 * seed (efeito rodando duas vezes em Strict Mode, ou duas abas abertas ao
 * mesmo tempo) colidem no id e a segunda é ignorada pelo Postgres, em vez
 * de duplicar as 7 linhas. Não confia no retorno do upsert (PostgREST só
 * devolve as linhas de fato inseridas com ignoreDuplicates) — busca de
 * novo pra ter o estado real, seja ele de quem chegou primeiro. */
async function seedMockCreatives(supabase: SupabaseClient<Database>, userId: string): Promise<Row[]> {
  const seedRows = MOCK_SEED.map((c) => ({
    id: c.id,
    user_id: userId,
    source: c.source,
    advertiser_name: c.advertiserName,
    headline: c.headline,
    body: c.body,
    thumbnail_url: c.thumbnailUrl,
    platforms: c.platforms,
    status: c.status,
    started_at: new Date(c.startedAt).toISOString(),
    stopped_at: c.stoppedAt ? new Date(c.stoppedAt).toISOString() : null,
  }));
  const { error } = await supabase.from("ad_watch_creatives").upsert(seedRows, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
  return fetchAllCreatives(supabase);
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const EMPTY_FILTERS: AdFilters = { search: "", status: "all", platform: "all", favoritesOnly: false };

export type AdsVisao = "todos" | "melhores" | "piores";

const VISAO_COPY: Record<AdsVisao, { title: string; subtitle: string }> = {
  todos: { title: "Gerenciador de Anúncios", subtitle: "Longevidade dos criativos como sinal de performance" },
  melhores: { title: "Melhores anúncios", subtitle: "Ativos há 14+ dias — sinal de que provavelmente estão vendendo" },
  piores: { title: "Piores anúncios", subtitle: "Pausados rápido — sinal de que provavelmente não performaram" },
};

interface AnunciosDashboardProps {
  visao?: AdsVisao;
}

export function AnunciosDashboard({ visao = "todos" }: AnunciosDashboardProps) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"ads" | "metrics">("ads");
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);

  const [creatives, setCreatives] = useState<AdCreative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [filters, setFilters] = useState<AdFilters>(EMPTY_FILTERS);
  // "Melhores"/"Piores" já chegam ordenados pelo sinal que define o recorte
  // (tempo no ar) — "Todos" mantém o padrão neutro de sempre.
  const [sortKey, setSortKey] = useState<SortKey>("daysRunning");
  const [sortDirection, setSortDirection] = useState<SortDirection>(visao === "piores" ? "asc" : "desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [previewCreativeId, setPreviewCreativeId] = useState<string | null>(null);
  const [referenceNotice, setReferenceNotice] = useState<string | null>(null);
  const [pendingFavoriteIds, setPendingFavoriteIds] = useState<Set<string>>(new Set());

  const range = useMemo(() => resolveDateRange(preset, customRange), [preset, customRange]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Sessão expirada — faça login novamente."); return; }

      let rows = await fetchAllCreatives(supabase);
      if (rows.length === 0) {
        rows = await seedMockCreatives(supabase, user.id);
      }
      const loadedAt = Date.now();
      setCreatives(rows.map((r) => mapRow(r, loadedAt)));
      setNow(loadedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const hasMockData = creatives.some((c) => c.source === "mock");

  const periodFiltered = useMemo(() => creatives.filter((c) => isCreativeInRange(c, range)), [creatives, range]);

  const filtered = useMemo(() => {
    let list = periodFiltered;
    if (filters.status !== "all") list = list.filter((c) => c.status === filters.status);
    if (filters.platform !== "all") list = list.filter((c) => c.platforms.includes(filters.platform));
    if (filters.favoritesOnly) list = list.filter((c) => c.isFavorite);
    const q = filters.search.trim();
    if (q) {
      const nq = normalize(q);
      list = list.filter((c) =>
        normalize(c.advertiserName).includes(nq) ||
        (c.headline && normalize(c.headline).includes(nq)) ||
        (c.body && normalize(c.body).includes(nq))
      );
    }
    return list;
  }, [periodFiltered, filters]);

  // "Melhores"/"Piores" restringem o recorte pelo mesmo sinal usado no resto
  // da tela (tempo no ar) — não é venda/receita real, só o proxy disponível
  // hoje. Os filtros manuais (busca, status, plataforma, favoritos) do
  // topo continuam se aplicando por cima, pra refinar dentro do recorte.
  const visaoFiltered = useMemo(() => {
    if (visao === "melhores") return filtered.filter((c) => c.status === "active" && c.daysRunning >= 14);
    if (visao === "piores") return filtered.filter((c) => c.status === "inactive");
    return filtered;
  }, [filtered, visao]);

  const sorted = useMemo(() => {
    const list = [...visaoFiltered];
    list.sort((a, b) => {
      // "Ainda no ar" (stoppedAt null) sempre conta como "mais recente" que
      // qualquer data real — nunca Infinity - Infinity (NaN) quando os dois
      // lados estão em veiculação.
      let cmp = 0;
      switch (sortKey) {
        case "advertiserName": cmp = a.advertiserName.localeCompare(b.advertiserName, "pt-BR"); break;
        case "startedAt": cmp = a.startedAt - b.startedAt; break;
        case "stoppedAt":
          if (a.stoppedAt === null && b.stoppedAt === null) cmp = 0;
          else if (a.stoppedAt === null) cmp = 1;
          else if (b.stoppedAt === null) cmp = -1;
          else cmp = a.stoppedAt - b.stoppedAt;
          break;
        case "daysRunning": cmp = a.daysRunning - b.daysRunning; break;
        case "status": cmp = a.status.localeCompare(b.status); break;
      }
      // A direção só inverte a comparação principal — o desempate (mais
      // recente primeiro) fica fixo, senão "desc" o transformava em "asc".
      if (sortDirection === "desc") cmp = -cmp;
      if (cmp === 0) cmp = b.startedAt - a.startedAt;
      return cmp;
    });
    return list;
  }, [visaoFiltered, sortKey, sortDirection]);

  const hasActiveFilters = !!filters.search.trim() || filters.status !== "all" || filters.platform !== "all" || filters.favoritesOnly;

  const handlePresetChange = (p: DatePreset) => {
    setPreset(p);
    setPage(1);
    // Refresca "now"/daysRunning mesmo se for o mesmo preset já ativo — sem
    // isso, "Hoje" clicado de novo depois da meia-noite não muda nada, e a
    // tela fica com o relógio congelado no momento do carregamento inicial.
    load();
  };
  const handleCustomApply = (r: DateRange) => { setCustomRange(r); setPreset("custom"); setPage(1); };
  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDirection("desc"); }
    setPage(1);
  };
  const handlePageSizeChange = (n: number) => { setPageSize(n); setPage(1); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setPage(1); };
  const updateFilters = (patch: Partial<AdFilters>) => { setFilters((f) => ({ ...f, ...patch })); setPage(1); };

  // Trava por anúncio evita que dois cliques rápidos no mesmo item disparem
  // updates concorrentes que podem voltar fora de ordem. previewCreativeId
  // (não o objeto inteiro) garante que o modal sempre reflita o estado mais
  // recente de creatives — nunca uma cópia que o rollback não alcança.
  const toggleFavorite = useCallback(async (creative: AdCreative) => {
    if (pendingFavoriteIds.has(creative.id)) return;
    setPendingFavoriteIds((prev) => new Set(prev).add(creative.id));
    const next = !creative.isFavorite;
    setCreatives((prev) => prev.map((c) => (c.id === creative.id ? { ...c, isFavorite: next } : c)));
    try {
      const { error: updErr } = await supabase.from("ad_watch_creatives").update({ is_favorite: next }).eq("id", creative.id);
      if (updErr) {
        setCreatives((prev) => prev.map((c) => (c.id === creative.id ? { ...c, isFavorite: !next } : c)));
        setReferenceNotice("Não deu pra salvar o favorito — tente de novo.");
      }
    } finally {
      setPendingFavoriteIds((prev) => { const next2 = new Set(prev); next2.delete(creative.id); return next2; });
    }
  }, [supabase, pendingFavoriteIds]);

  const useAsReference = useCallback((creative: AdCreative) => {
    if (!creative.thumbnailUrl) return;
    try {
      sessionStorage.setItem("wevyflow:pending-ad-reference", JSON.stringify({
        url: creative.thumbnailUrl,
        name: creative.headline || creative.advertiserName,
        adId: creative.id,
      }));
    } catch {
      setReferenceNotice("Não foi possível preparar a referência — tente novamente.");
      return;
    }
    router.push("/criativos?tipo=criativos");
  }, [router]);

  const previewCreative = useMemo(
    () => (previewCreativeId ? creatives.find((c) => c.id === previewCreativeId) ?? null : null),
    [creatives, previewCreativeId]
  );

  return (
    <div className="flex flex-col h-full bg-[#0a0a0e]">
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.05] shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            {visao === "melhores" ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : visao === "piores" ? <TrendingDown className="w-4 h-4 text-red-400" /> : <Megaphone className="w-4 h-4 text-purple-400" />}
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-white/90">{VISAO_COPY[visao].title}</h1>
            <p className="text-[11px] text-white/30">{VISAO_COPY[visao].subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
          <button
            onClick={() => setActiveTab("ads")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all cursor-pointer",
              activeTab === "ads" ? "bg-purple-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.4)]" : "text-white/40 hover:text-white/70")}
          >
            <Megaphone className="w-3.5 h-3.5" /> Anúncios
          </button>
          <button
            onClick={() => setActiveTab("metrics")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all cursor-pointer",
              activeTab === "metrics" ? "bg-purple-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.4)]" : "text-white/40 hover:text-white/70")}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Métricas
          </button>
        </div>
      </div>

      <div className="shrink-0 mx-8 mt-4">
        <MetaAdsConnectionCard />
      </div>

      {hasMockData && (
        <div className="shrink-0 mx-8 mt-4 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300/80 leading-relaxed">
            Alguns anúncios são dados fictícios de demonstração (marcados &quot;Demo&quot;) — tempo no ar é só um sinal de longevidade, não representa vendas, gasto ou ROAS.
            Assim que a conexão com uma fonte real (Meta Ad Library ou Foreplay) estiver pronta, os cards viram anúncios de verdade.
          </p>
        </div>
      )}

      {referenceNotice && (
        <div className="shrink-0 mx-8 mt-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[11px] text-red-300">{referenceNotice}</p>
          <button onClick={() => setReferenceNotice(null)} className="text-red-400/60 hover:text-red-300 cursor-pointer shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="shrink-0 px-8 pt-4 flex items-center justify-between gap-3 flex-wrap">
        <AdDateRangeFilter preset={preset} range={range} onPresetChange={handlePresetChange} onCustomApply={handleCustomApply} />
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-white/25 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              placeholder="Buscar anunciante ou texto..."
              className="pl-8 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[11px] text-white placeholder:text-white/20 outline-none focus:border-purple-500/30 w-[200px]"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => updateFilters({ status: e.target.value as AdFilters["status"] })}
            className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/60 outline-none cursor-pointer"
          >
            <option value="all">Todos status</option>
            <option value="active">Ativos</option>
            <option value="inactive">Pausados</option>
          </select>
          <select
            value={filters.platform}
            onChange={(e) => updateFilters({ platform: e.target.value as AdFilters["platform"] })}
            className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/60 outline-none cursor-pointer"
          >
            <option value="all">Todas plataformas</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
          <button
            onClick={() => updateFilters({ favoritesOnly: !filters.favoritesOnly })}
            className={cn(
              "px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-colors cursor-pointer border",
              filters.favoritesOnly ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "bg-white/[0.04] border-white/[0.06] text-white/50 hover:text-white/80"
            )}
          >
            ★ Favoritos
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-[11px] text-white/30 hover:text-white/60 cursor-pointer underline underline-offset-2">
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5">
        {activeTab === "ads" ? (
          <AdsTable
            creatives={sorted}
            loading={loading}
            error={error}
            onRetry={load}
            hasAnyCreatives={creatives.length > 0}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={handlePageSizeChange}
            onPreview={(c) => setPreviewCreativeId(c.id)}
            onToggleFavorite={toggleFavorite}
            onUseAsReference={useAsReference}
          />
        ) : loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-5 h-5 rounded-full border-2 border-purple-500/30 border-t-purple-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] px-6 py-10 flex flex-col items-center gap-3 text-center">
            <p className="text-[13px] text-red-300">Não deu pra carregar os anúncios: {error}</p>
            <button onClick={load} className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/70 text-[11px] font-medium cursor-pointer transition-colors">
              Tentar novamente
            </button>
          </div>
        ) : (
          <AdsMetrics creatives={visaoFiltered} range={range} now={now} />
        )}
      </div>

      {previewCreative && (
        <AdPreviewModal
          creative={previewCreative}
          onClose={() => setPreviewCreativeId(null)}
          onToggleFavorite={toggleFavorite}
          onUseAsReference={useAsReference}
        />
      )}
    </div>
  );
}
