"use client";

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Megaphone, Flame, Rocket, PlayCircle } from "lucide-react";
import type { AdCreative, DateRange } from "./types";
import { clampDaysInRange } from "./date-range";

const PURPLE = "#8b5cf6";
const PURPLE_DARK = "#7c3aed";
const GREEN = "#34d399";
const GRAY = "rgba(255,255,255,0.28)";

const TOOLTIP_STYLE = { background: "#15151b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, fontSize: 11, color: "#fff" };
const AXIS_TICK = { fontSize: 10, fill: "rgba(255,255,255,0.3)" };

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function addLocalDays(ms: number, days: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}
function mondayOf(ms: number): number {
  const d = new Date(startOfLocalDay(ms));
  const day = d.getDay();
  return addLocalDays(d.getTime(), day === 0 ? -6 : 1 - day);
}
function startOfMonth(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}
function addMonths(ms: number, n: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime();
}

interface StartedBucket { key: number; label: string; anuncios: number }

function buildStartedBuckets(creatives: AdCreative[], range: DateRange): StartedBucket[] {
  const spanDays = Math.max(1, Math.round((range.endExclusive - range.start) / 86400000));
  const granularity: "day" | "week" | "month" = spanDays <= 45 ? "day" : spanDays <= 180 ? "week" : "month";

  const buckets = new Map<number, StartedBucket>();
  if (granularity === "day") {
    for (let t = startOfLocalDay(range.start); t < range.endExclusive; t = addLocalDays(t, 1)) {
      buckets.set(t, { key: t, label: new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), anuncios: 0 });
    }
  } else if (granularity === "week") {
    for (let t = mondayOf(range.start); t < range.endExclusive; t = addLocalDays(t, 7)) {
      buckets.set(t, { key: t, label: new Date(t).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), anuncios: 0 });
    }
  } else {
    for (let t = startOfMonth(range.start); t < range.endExclusive; t = addMonths(t, 1)) {
      buckets.set(t, { key: t, label: new Date(t).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), anuncios: 0 });
    }
  }

  for (const c of creatives) {
    if (c.startedAt < range.start || c.startedAt >= range.endExclusive) continue;
    const key = granularity === "day" ? startOfLocalDay(c.startedAt) : granularity === "week" ? mondayOf(c.startedAt) : startOfMonth(c.startedAt);
    const bucket = buckets.get(key);
    if (bucket) bucket.anuncios += 1;
  }

  return Array.from(buckets.values()).sort((a, b) => a.key - b.key);
}

const DURATION_BUCKETS = [
  { id: "0-3", label: "0–3d", min: 0, max: 3 },
  { id: "4-7", label: "4–7d", min: 4, max: 7 },
  { id: "8-14", label: "8–14d", min: 8, max: 14 },
  { id: "15-30", label: "15–30d", min: 15, max: 30 },
  { id: "31+", label: "31d+", min: 31, max: Infinity },
];

function buildDurationBuckets(creatives: AdCreative[], range: DateRange, now: number) {
  const counts = DURATION_BUCKETS.map((b) => ({ label: b.label, anuncios: 0 }));
  for (const c of creatives) {
    const days = clampDaysInRange(c, range, now);
    const idx = DURATION_BUCKETS.findIndex((b) => days >= b.min && days <= b.max);
    if (idx >= 0) counts[idx].anuncios += 1;
  }
  return counts;
}

function buildTopAdvertisers(creatives: AdCreative[]) {
  const map = new Map<string, number>();
  for (const c of creatives) map.set(c.advertiserName, (map.get(c.advertiserName) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([name, anuncios]) => ({ name, anuncios }))
    .sort((a, b) => b.anuncios - a.anuncios)
    .slice(0, 8)
    .reverse();
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <p className="text-[11px] font-semibold text-white/50 mb-3">{title}</p>
      <div style={{ height: 220 }}>{children}</div>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[18px] font-semibold text-white/90 leading-none">{value}</p>
        <p className="text-[10px] text-white/35 mt-1">{label}</p>
      </div>
    </div>
  );
}

interface AdsMetricsProps {
  creatives: AdCreative[];
  range: DateRange;
  now: number;
}

export default function AdsMetrics({ creatives, range, now }: AdsMetricsProps) {
  if (creatives.length === 0) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 py-16 flex flex-col items-center gap-2 text-center">
        <Megaphone className="w-7 h-7 text-white/10" />
        <p className="text-[13px] text-white/30">Nenhum anúncio no período/filtros selecionados pra gerar gráficos.</p>
      </div>
    );
  }

  const startedInRange = creatives.filter((c) => c.startedAt >= range.start && c.startedAt < range.endExclusive).length;
  const activeNow = creatives.filter((c) => c.status === "active").length;
  const likelyWinners = creatives.filter((c) => c.status === "active" && c.daysRunning >= 14).length;

  const startedBuckets = buildStartedBuckets(creatives, range);
  const durationBuckets = buildDurationBuckets(creatives, range, now);
  const topAdvertisers = buildTopAdvertisers(creatives);
  const statusDonut = [
    { name: "Ativos", value: activeNow, color: GREEN },
    { name: "Pausados", value: creatives.length - activeNow, color: GRAY },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-white/25">Tempo no ar é uma heurística de longevidade, não um dado de vendas, gasto ou ROAS.</p>

      <div className="grid grid-cols-4 gap-3">
        <KpiCard icon={<Megaphone className="w-4 h-4" />} label="Anúncios no período" value={creatives.length} />
        <KpiCard icon={<Rocket className="w-4 h-4" />} label="Iniciados no período" value={startedInRange} />
        <KpiCard icon={<PlayCircle className="w-4 h-4" />} label="Ativos agora" value={activeNow} />
        <KpiCard icon={<Flame className="w-4 h-4" />} label="Prováveis vencedores" value={likelyWinners} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard title="Anúncios iniciados">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={startedBuckets}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(255,255,255,0.6)" }} />
              <Area type="monotone" dataKey="anuncios" name="Anúncios" stroke={PURPLE} fill={PURPLE} fillOpacity={0.18} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Dias em veiculação no período">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={durationBuckets}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
              <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "rgba(255,255,255,0.6)" }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="anuncios" name="Anúncios" fill={PURPLE_DARK} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Status atual">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Pie data={statusDonut} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {statusDonut.map((d) => <Cell key={d.name} fill={d.color} stroke="none" />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 -mt-2">
            {statusDonut.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-white/40">
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} /> {d.name} ({d.value})
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Top anunciantes no período">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topAdvertisers} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} width={110} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="anuncios" name="Anúncios" fill={PURPLE} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
