import type { AdCreative, DatePreset, DateRange } from "./types";

const MS_PER_DAY = 86400000;

function localMidnight(year: number, monthIndex0: number, day: number): number {
  return new Date(year, monthIndex0, day, 0, 0, 0, 0).getTime();
}

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return localMidnight(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Uses Date's own day-rollover (not raw ms + N*86400000) so this stays
 * correct across DST transitions in timezones that still observe it. */
function addLocalDays(ms: number, days: number): number {
  const d = new Date(ms);
  return localMidnight(d.getFullYear(), d.getMonth(), d.getDate() + days);
}

export const PRESET_LABELS: Record<DatePreset, string> = {
  "30d": "Últimos 30 dias",
  "15d": "Últimos 15 dias",
  "7d": "Últimos 7 dias",
  yesterday: "Ontem",
  today: "Hoje",
  ytd: "Desde jan.",
  custom: "Personalizado",
};

export const DATE_PRESET_OPTIONS: { id: Exclude<DatePreset, "custom">; label: string }[] = [
  { id: "30d", label: PRESET_LABELS["30d"] },
  { id: "15d", label: PRESET_LABELS["15d"] },
  { id: "7d", label: PRESET_LABELS["7d"] },
  { id: "yesterday", label: PRESET_LABELS.yesterday },
  { id: "today", label: PRESET_LABELS.today },
  { id: "ytd", label: PRESET_LABELS.ytd },
];

export function getPresetRange(preset: Exclude<DatePreset, "custom">, now: number = Date.now()): DateRange {
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = addLocalDays(todayStart, 1);
  switch (preset) {
    case "today":
      return { start: todayStart, endExclusive: tomorrowStart, label: PRESET_LABELS.today };
    case "yesterday":
      return { start: addLocalDays(todayStart, -1), endExclusive: todayStart, label: PRESET_LABELS.yesterday };
    case "7d":
      return { start: addLocalDays(todayStart, -6), endExclusive: tomorrowStart, label: PRESET_LABELS["7d"] };
    case "15d":
      return { start: addLocalDays(todayStart, -14), endExclusive: tomorrowStart, label: PRESET_LABELS["15d"] };
    case "30d":
      return { start: addLocalDays(todayStart, -29), endExclusive: tomorrowStart, label: PRESET_LABELS["30d"] };
    case "ytd": {
      const d = new Date(now);
      return { start: localMidnight(d.getFullYear(), 0, 1), endExclusive: tomorrowStart, label: PRESET_LABELS.ytd };
    }
  }
}

/** startMs/endMs are inclusive calendar days (Y included fully) — the
 * caller gets them from parseDateInputValue on two <input type="date">. */
export function getCustomRange(startMs: number, endMs: number): DateRange {
  return {
    start: startOfLocalDay(startMs),
    endExclusive: addLocalDays(startOfLocalDay(endMs), 1),
    label: PRESET_LABELS.custom,
  };
}

export function resolveDateRange(
  preset: DatePreset,
  customRange: DateRange | null,
  now: number = Date.now()
): DateRange {
  if (preset === "custom") return customRange ?? getPresetRange("30d", now);
  return getPresetRange(preset, now);
}

/** Parses a `<input type="date">` value ("YYYY-MM-DD") as a LOCAL calendar
 * day. Never `new Date(str)` — that parses as UTC midnight, which lands on
 * the previous day in negative-UTC-offset timezones like Brazil's. */
export function parseDateInputValue(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const ms = localMidnight(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(ms) ? null : ms;
}

/** Default param (not an explicit Date.now() call at the render-body call
 * site) keeps this usable directly from a component's render without
 * tripping the "no impure calls during render" rule — see getPresetRange. */
export function todayDateInputValue(now: number = Date.now()): string {
  return formatDateInputValue(now);
}

export function formatDateInputValue(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDatePtBr(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR");
}

/** A creative "belongs" to a range when it was live at ANY point inside the
 * window — not just when it started inside it. A 60-day-old still-active
 * winner must still show up under "Últimos 7 dias"; filtering only by
 * startedAt would hide exactly the longest-running (most interesting)
 * creatives. */
export function isCreativeInRange(
  creative: Pick<AdCreative, "startedAt" | "stoppedAt">,
  range: DateRange
): boolean {
  const stillRunningOrStoppedAfterStart = creative.stoppedAt === null || creative.stoppedAt >= range.start;
  return creative.startedAt < range.endExclusive && stillRunningOrStoppedAfterStart;
}

/** Intersects a creative's known lifetime with the selected range, in days
 * — used for the duration histogram so a long runner viewed inside a short
 * window contributes its time IN the window, not its whole lifetime. */
export function clampDaysInRange(
  creative: Pick<AdCreative, "startedAt" | "stoppedAt">,
  range: DateRange,
  now: number
): number {
  const end = Math.min(creative.stoppedAt ?? now, range.endExclusive);
  const start = Math.max(creative.startedAt, range.start);
  return Math.max(0, Math.round((end - start) / MS_PER_DAY));
}

export function daysBetween(startMs: number, endMs: number): number {
  return Math.max(0, Math.round((endMs - startMs) / MS_PER_DAY));
}
