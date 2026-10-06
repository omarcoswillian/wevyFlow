"use client";

import { Copy, Check, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdCopyOption } from "../../lib/copy/generate-ads";

/** Limites instruídos ao modelo em lib/copy/generate-ads.ts (HEADLINE_MAX /
 * CTA_MAX). Duplicados aqui de propósito: aquele arquivo importa o SDK de
 * servidor e não pode ir pro bundle do client. */
export const HEADLINE_LIMIT = 70;
export const CTA_LIMIT = 25;

/** Títulos salvos seguem "<tipo> — <produto>". Separa os dois pra hierarquia
 * visual (tipo vira etiqueta pequena, produto vira o título). */
export function splitTitle(title: string): { kind: string; name: string } {
  const i = title.indexOf(" — ");
  if (i === -1) return { kind: "Anúncios", name: title };
  return { kind: title.slice(0, i), name: title.slice(i + 3) || title };
}

const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

/** "há 3 horas", "ontem", "há 2 semanas". `now` vem do chamador (estado criado
 * uma vez) — Date.now() não pode ser chamado durante o render. */
export function relativeDate(ts: number, now: number): string {
  const diff = ts - now;
  const abs = Math.abs(diff);
  const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
  if (abs < MIN) return "agora há pouco";
  if (abs < HOUR) return rtf.format(Math.round(diff / MIN), "minute");
  if (abs < DAY) return rtf.format(Math.round(diff / HOUR), "hour");
  if (abs < 7 * DAY) return rtf.format(Math.round(diff / DAY), "day");
  if (abs < 30 * DAY) return rtf.format(Math.round(diff / (7 * DAY)), "week");
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function modelLabel(model: string | null | undefined): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  if (m.includes("opus")) return "Claude Opus";
  if (m.includes("sonnet")) return "Claude Sonnet";
  if (m.includes("haiku")) return "Claude Haiku";
  if (m.includes("gpt")) return "GPT";
  if (m.includes("gemini")) return "Gemini";
  return model;
}

interface Tone { chip: string; dot: string }

// Classes escritas por extenso (o Tailwind só gera o que enxerga no código).
const TONES: { match: RegExp; tone: Tone }[] = [
  { match: /transforma|resultado/i, tone: { chip: "bg-emerald-500/10 text-emerald-300", dot: "bg-emerald-400" } },
  { match: /curios/i, tone: { chip: "bg-sky-500/10 text-sky-300", dot: "bg-sky-400" } },
  { match: /\bdor\b/i, tone: { chip: "bg-rose-500/10 text-rose-300", dot: "bg-rose-400" } },
  { match: /l[óo]gica|obje[çc]/i, tone: { chip: "bg-amber-500/10 text-amber-300", dot: "bg-amber-400" } },
  { match: /prova|n[úu]mero/i, tone: { chip: "bg-violet-500/10 text-violet-300", dot: "bg-violet-400" } },
  { match: /oferta|pre[çc]o/i, tone: { chip: "bg-orange-500/10 text-orange-300", dot: "bg-orange-400" } },
  { match: /medo|escassez/i, tone: { chip: "bg-red-500/10 text-red-300", dot: "bg-red-400" } },
];
const DEFAULT_TONE: Tone = { chip: "bg-purple-500/10 text-purple-300", dot: "bg-purple-400" };

export function angleTone(angle: string): Tone {
  return TONES.find((t) => t.match.test(angle))?.tone ?? DEFAULT_TONE;
}

/** Primeira palavra-chave do ângulo, com a inicial maiúscula ("transformação/
 * resultado" -> "Transformação"), pra etiqueta curta e limpa. */
export function angleShortLabel(angle: string): string {
  const head = angle.split(/[/(]/)[0].trim();
  return head.charAt(0).toUpperCase() + head.slice(1);
}

export function optionsToText(options: AdCopyOption[]): string {
  return options.map((o, i) => `${i + 1}. ${o.headline}\n   ${o.cta}`).join("\n\n");
}

export function StatusBadge({ status }: { status: "draft" | "approved" }) {
  return status === "approved" ? (
    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 text-[10px] font-semibold">
      <CheckCircle2 className="w-3 h-3" /> Aprovada
    </span>
  ) : (
    <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.05] text-white/40 text-[10px] font-medium">
      <Clock className="w-3 h-3" /> Rascunho
    </span>
  );
}

export function CtaPill({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-3 py-1 rounded-full bg-white text-[#0a0a0e] text-[11px] font-semibold", className)}>
      {text}
    </span>
  );
}

function CharMeter({ label, value, limit }: { label: string; value: number; limit: number }) {
  const over = value > limit;
  const pct = Math.min(100, Math.round((value / limit) * 100));
  return (
    <div className="flex items-center gap-2" title={`${label}: ${value} de ${limit} caracteres`}>
      <span className="text-[10px] text-white/30">{label}</span>
      <span className="w-9 h-1 rounded-full bg-white/[0.08] overflow-hidden">
        <span className={cn("block h-full rounded-full", over ? "bg-amber-400" : "bg-white/40")} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn("text-[10px] tabular-nums", over ? "text-amber-300" : "text-white/35")}>{value}/{limit}</span>
    </div>
  );
}

interface CopyOptionCardProps {
  option: AdCopyOption;
  selected?: boolean;
  copied?: boolean;
  compact?: boolean;
  onCopy: () => void;
  onSelect?: () => void;
}

/** Uma opção de copy (ângulo + headline + CTA) apresentada como peça: etiqueta
 * do ângulo, headline em destaque, CTA como botão, medidor de caracteres. */
export function CopyOptionCard({ option, selected, copied, compact, onCopy, onSelect }: CopyOptionCardProps) {
  const tone = angleTone(option.angle);
  return (
    <div
      className={cn(
        "rounded-2xl border transition-colors",
        compact ? "p-3.5" : "p-4",
        selected
          ? "border-purple-500/50 bg-purple-500/[0.07]"
          : "border-white/[0.07] bg-white/[0.025] hover:border-white/[0.14] hover:bg-white/[0.04]"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold", tone.chip)}>
          <span className={cn("w-1.5 h-1.5 rounded-full", tone.dot)} />
          {angleShortLabel(option.angle)}
        </span>
        {selected && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-300">
            <CheckCircle2 className="w-3 h-3" /> Escolhida
          </span>
        )}
      </div>

      <p className={cn("font-semibold text-white leading-[1.35] tracking-[-0.01em]", compact ? "text-[14px]" : "text-[16px]")}>
        {option.headline}
      </p>
      <div className="mt-3">
        <CtaPill text={option.cta} />
      </div>

      <div className="mt-3.5 pt-3 border-t border-white/[0.05] flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4">
          <CharMeter label="Título" value={option.headline.length} limit={HEADLINE_LIMIT} />
          <CharMeter label="CTA" value={option.cta.length} limit={CTA_LIMIT} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onCopy}
            aria-label="Copiar título e CTA"
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer",
              copied ? "bg-emerald-500/15 text-emerald-300" : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
            )}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          {onSelect && (
            <button
              onClick={onSelect}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer",
                selected ? "bg-purple-500/25 text-purple-200" : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white"
              )}
            >
              {selected ? "Desmarcar" : "Escolher"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Mock simples de anúncio de feed (nome da página, "Patrocinado", área de
 * mídia com o headline e a barra de CTA) pra ver a copy como o público verá. */
export function AdPreview({ option, pageName }: { option: AdCopyOption; pageName: string }) {
  const initial = (pageName.trim().charAt(0) || "W").toUpperCase();
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#111114] overflow-hidden">
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white text-[12px] font-semibold flex items-center justify-center">{initial}</div>
        <div className="leading-tight min-w-0">
          <p className="text-[12px] font-semibold text-white/90 truncate">{pageName}</p>
          <p className="text-[10px] text-white/35">Patrocinado</p>
        </div>
      </div>
      <div className="aspect-[1.91/1] bg-gradient-to-br from-[#1d1530] via-[#14101f] to-[#0c0a14] flex items-center justify-center px-8 text-center">
        <p className="text-[19px] font-semibold text-white leading-[1.25] tracking-[-0.015em]">{option.headline}</p>
      </div>
      <div className="flex items-center justify-between gap-3 px-3.5 py-3 bg-white/[0.03]">
        <p className="text-[11px] text-white/50 truncate">{pageName}</p>
        <span className="shrink-0 px-3 py-1.5 rounded-md bg-white/[0.1] text-white text-[11px] font-semibold">{option.cta}</span>
      </div>
    </div>
  );
}

/* ── Carrosséis e Thumbs ─────────────────────────────────── */

/** Texto copiável de uma opção: carrossel inclui os slides. */
export function optionToText(o: AdCopyOption): string {
  if (o.slides?.length) {
    return [`Capa: ${o.headline}`, ...o.slides.map((s, i) => `Slide ${i + 2}: ${s}`), `Final: ${o.cta}`].join("\n");
  }
  return o.cta ? `${o.headline}\n${o.cta}` : o.headline;
}

export function optionsToTextFor(options: AdCopyOption[]): string {
  return options.map((o, i) => `${i + 1}. ${optionToText(o).replace(/\n/g, "\n   ")}`).join("\n\n");
}

/** Cartão de opção de Carrossel ou Thumb: ângulo, headline (capa ou texto da thumb),
 * slides numerados quando houver e CTA/complemento. */
export function ContentOptionCard({ option, selected, copied, onCopy, onSelect }: {
  option: AdCopyOption; selected?: boolean; copied?: boolean; onCopy: () => void; onSelect?: () => void;
}) {
  const tone = angleTone(option.angle);
  return (
    <div className={cn("rounded-2xl border p-4 transition-colors flex flex-col",
      selected ? "border-purple-500/50 bg-purple-500/[0.07]" : "border-white/[0.07] bg-white/[0.025] hover:border-white/[0.14] hover:bg-white/[0.04]")}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold", tone.chip)}>
          <span className={cn("w-1.5 h-1.5 rounded-full", tone.dot)} />
          {angleShortLabel(option.angle)}
        </span>
        {selected && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-300"><CheckCircle2 className="w-3 h-3" /> Escolhida</span>}
      </div>

      <p className="text-[15px] font-semibold text-white leading-[1.3] tracking-[-0.01em]">{option.headline}</p>

      {option.slides && option.slides.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {option.slides.map((s, i) => (
            <li key={i} className="flex gap-2 text-[12px] text-white/60 leading-snug">
              <span className="shrink-0 w-4 text-right text-white/25 tabular-nums">{i + 2}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}

      {option.cta && <div className="mt-3"><CtaPill text={option.cta} /></div>}

      <div className="mt-3.5 pt-3 border-t border-white/[0.05] flex items-center justify-between gap-3">
        <span className="text-[10px] text-white/30">
          {option.slides ? `${option.slides.length + 2} slides` : `${option.headline.length} caracteres`}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={onCopy} aria-label="Copiar"
            className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer",
              copied ? "bg-emerald-500/15 text-emerald-300" : "text-white/40 hover:text-white/70 hover:bg-white/[0.06]")}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied ? "Copiado" : "Copiar"}
          </button>
          {onSelect && (
            <button onClick={onSelect}
              className={cn("px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer",
                selected ? "bg-purple-500/25 text-purple-200" : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1] hover:text-white")}>
              {selected ? "Desmarcar" : "Escolher"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Mock de thumbnail 16:9: o texto como o público vai ver, com o selo no canto. */
export function ThumbPreview({ option }: { option: AdCopyOption }) {
  return (
    <div className="relative aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-[#2a1747] via-[#171021] to-[#0b0911] flex items-center px-6 border border-white/[0.08]">
      <p className="max-w-[75%] text-[26px] leading-[1.05] font-extrabold text-white uppercase tracking-[-0.02em]">{option.headline}</p>
      {option.cta && <span className="absolute top-3 right-3 px-2 py-1 rounded bg-yellow-400 text-black text-[11px] font-extrabold uppercase">{option.cta}</span>}
      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-semibold">12:34</span>
    </div>
  );
}

/** Faixa de slides 4:5 do carrossel, na ordem de leitura. */
export function CarouselPreview({ option }: { option: AdCopyOption }) {
  const slides = [option.headline, ...(option.slides ?? []), option.cta];
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-2">
      {slides.map((text, i) => (
        <div key={i} className="shrink-0 w-[150px] aspect-[4/5] rounded-xl border border-white/[0.08] bg-gradient-to-b from-[#1d1530] to-[#0f0c18] p-3 flex flex-col">
          <span className="text-[9px] text-white/25 tabular-nums">{i + 1}/{slides.length}</span>
          <p className={cn("flex-1 flex items-center text-white leading-snug", i === 0 ? "text-[14px] font-bold" : i === slides.length - 1 ? "text-[12px] font-semibold text-purple-200" : "text-[11px] text-white/80")}>{text}</p>
        </div>
      ))}
    </div>
  );
}
