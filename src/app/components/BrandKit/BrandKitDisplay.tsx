"use client";

import { cn } from "@/lib/utils";
import { RotateCcw, Download } from "lucide-react";

export interface BrandDNA {
  name: string;
  niche: string;
  tagline: string;
  personality: { moderno: number; premium: number; minimalista: number; racional: number };
  voiceTones: string[];
  visualStyle: "dark-premium" | "light-clean" | "luxury" | "tech" | "vibrant" | "organic";
  primaryColor: string;
  logoType: "wordmark" | "lettermark" | "combination" | "symbol";
  variant: "dark" | "light";
}

export interface GeneratedLogo {
  b64: string;
  mimeType: string;
  variant: "dark" | "light";
}

export interface BrandKitDisplayProps {
  dna: BrandDNA;
  logos: GeneratedLogo[];
  isGeneratingVariant: boolean;
  onGenerateVariant: (variant: "dark" | "light") => void;
  onReset: () => void;
  onSave: () => void;
  isSaving: boolean;
  onApply?: () => void;
}

const TYPOGRAPHY_MAP: Record<BrandDNA["visualStyle"], { heading: string; body: string }> = {
  "dark-premium": { heading: "Sora", body: "Inter" },
  "light-clean": { heading: "Inter", body: "Inter" },
  luxury: { heading: "Playfair Display", body: "Sora" },
  tech: { heading: "Space Grotesk", body: "Inter" },
  vibrant: { heading: "Poppins", body: "Inter" },
  organic: { heading: "Montserrat", body: "Inter" },
};

const VISUAL_STYLE_LABELS: Record<BrandDNA["visualStyle"], string> = {
  "dark-premium": "Dark Premium",
  "light-clean": "Light Clean",
  luxury: "Luxury",
  tech: "Tech",
  vibrant: "Vibrant",
  organic: "Organic",
};

const PERSONALITY_LABELS: Record<keyof BrandDNA["personality"], string> = {
  moderno: "Moderno",
  premium: "Premium",
  minimalista: "Minimalista",
  racional: "Racional",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function blendWithWhite(hex: string, opacity: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const r = Math.round(rgb.r * opacity + 255 * (1 - opacity));
  const g = Math.round(rgb.g * opacity + 255 * (1 - opacity));
  const b = Math.round(rgb.b * opacity + 255 * (1 - opacity));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function SectionHeader({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-[9px] uppercase tracking-widest text-white/25 font-medium">{index}</span>
      <div className="h-px flex-1 bg-white/[0.05]" />
      <span className="text-[11px] font-medium text-white/50 uppercase tracking-widest">{label}</span>
    </div>
  );
}

function BarScale({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-1.5 w-5 rounded-full",
            i < value ? "bg-white/70" : "bg-white/[0.08]"
          )}
        />
      ))}
    </div>
  );
}

export function BrandKitDisplay({
  dna,
  logos,
  isGeneratingVariant,
  onGenerateVariant,
  onReset,
  onSave,
  isSaving,
  onApply,
}: BrandKitDisplayProps) {
  const typography = TYPOGRAPHY_MAP[dna.visualStyle];

  const darkLogo = logos.find((l) => l.variant === "dark");
  const lightLogo = logos.find((l) => l.variant === "light");

  const accentColor = blendWithWhite(dna.primaryColor, 0.4);

  const palette = [
    { label: "Primary", hex: dna.primaryColor, description: "Cor principal" },
    { label: "Dark", hex: "#0a0a0a", description: "Fundos escuros" },
    { label: "Light", hex: "#f8f8f8", description: "Fundos claros" },
    { label: "Accent", hex: accentColor, description: "Destaque suave" },
    { label: "Neutral", hex: "#6b7280", description: "Texto secundário" },
  ];

  const personalityEntries = Object.entries(dna.personality) as [
    keyof BrandDNA["personality"],
    number
  ][];

  return (
    <div className="bg-[#0c0c10] min-h-screen px-6 py-8">
      <div className="max-w-[760px] mx-auto space-y-0">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-10">
          <div className="space-y-1.5">
            <h1 className="text-3xl font-bold text-white leading-tight">{dna.name}</h1>
            {dna.tagline && (
              <p className="text-sm text-white/40">{dna.tagline}</p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] uppercase tracking-widest text-white/30 border border-white/[0.08] rounded px-2 py-0.5">
                {dna.niche}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-white/30 border border-white/[0.08] rounded px-2 py-0.5">
                {VISUAL_STYLE_LABELS[dna.visualStyle]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-1">
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-white/60 border border-white/[0.12] rounded-lg hover:border-white/25 hover:text-white/80 transition-colors"
            >
              <RotateCcw size={12} />
              Nova identidade
            </button>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Download size={12} />
              {isSaving ? "Salvando..." : "Salvar Brand Kit"}
            </button>
          </div>
        </div>

        {/* Section 01 — Logotipo */}
        <div className="border-t border-white/[0.05] pt-6 mt-6">
          <SectionHeader index="01" label="Logotipo" />

          <div className="flex gap-4">
            {/* Dark variant card */}
            <div className="flex-1 space-y-2">
              <div
                className={cn(
                  "w-full h-[200px] rounded-xl border border-white/[0.08] bg-[#0a0a0a] flex items-center justify-center overflow-hidden"
                )}
              >
                {darkLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:${darkLogo.mimeType};base64,${darkLogo.b64}`}
                    alt={`${dna.name} logo fundo escuro`}
                    className="max-w-[200px] max-h-[140px] object-contain"
                  />
                ) : (
                  <button
                    onClick={() => onGenerateVariant("dark")}
                    disabled={isGeneratingVariant}
                    className="px-4 py-2 text-xs text-white/50 border border-white/[0.12] rounded-lg hover:border-white/25 hover:text-white/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGeneratingVariant ? "Gerando..." : "Gerar variacao"}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/30 text-center uppercase tracking-widest">
                Fundo escuro
              </p>
            </div>

            {/* Light variant card */}
            <div className="flex-1 space-y-2">
              <div
                className={cn(
                  "w-full h-[200px] rounded-xl border border-white/[0.08] bg-white flex items-center justify-center overflow-hidden"
                )}
              >
                {lightLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:${lightLogo.mimeType};base64,${lightLogo.b64}`}
                    alt={`${dna.name} logo fundo claro`}
                    className="max-w-[200px] max-h-[140px] object-contain"
                  />
                ) : (
                  <button
                    onClick={() => onGenerateVariant("light")}
                    disabled={isGeneratingVariant}
                    className="px-4 py-2 text-xs text-black/50 border border-black/10 rounded-lg hover:border-black/20 hover:text-black/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGeneratingVariant ? "Gerando..." : "Gerar variacao"}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/30 text-center uppercase tracking-widest">
                Fundo claro
              </p>
            </div>
          </div>
        </div>

        {/* Section 02 — Paleta */}
        <div className="border-t border-white/[0.05] pt-6 mt-6">
          <SectionHeader index="02" label="Paleta" />

          <div className="flex gap-3 flex-wrap">
            {palette.map((swatch) => (
              <div key={swatch.label} className="space-y-2">
                <div
                  className="w-16 h-12 rounded-lg border border-white/[0.06]"
                  style={{ backgroundColor: swatch.hex }}
                />
                <div className="space-y-0.5">
                  <p className="text-[9px] uppercase tracking-widest text-white/25">{swatch.label}</p>
                  <p className="text-[10px] font-mono text-white/50">{swatch.hex}</p>
                  <p className="text-[9px] text-white/25">{swatch.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 03 — Tipografia */}
        <div className="border-t border-white/[0.05] pt-6 mt-6">
          <SectionHeader index="03" label="Tipografia" />

          <div className="space-y-6">
            <div className="space-y-1.5">
              <p className="text-[9px] uppercase tracking-widest text-white/25">Titulos</p>
              <p className="text-[10px] text-white/40 mb-2">{typography.heading}</p>
              <p
                className="text-white/80 leading-tight"
                style={{ fontFamily: `"${typography.heading}", sans-serif`, fontSize: 32 }}
              >
                {dna.name}
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[9px] uppercase tracking-widest text-white/25">Corpo</p>
              <p className="text-[10px] text-white/40 mb-2">{typography.body}</p>
              <p
                className="text-white/60 leading-relaxed max-w-md"
                style={{ fontFamily: `"${typography.body}", sans-serif`, fontSize: 14 }}
              >
                {dna.tagline ||
                  "Identidade visual construida para comunicar valor, autoridade e diferenciacao no mercado."}
              </p>
            </div>
          </div>
        </div>

        {/* Section 04 — Posicionamento */}
        <div className="border-t border-white/[0.05] pt-6 mt-6">
          <SectionHeader index="04" label="Posicionamento" />

          <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-6">
            {personalityEntries.map(([key, value]) => (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-white/40">
                    {PERSONALITY_LABELS[key]}
                  </span>
                  <span className="text-[10px] font-mono text-white/30">{value}/5</span>
                </div>
                <BarScale value={value} />
              </div>
            ))}
          </div>

          {dna.voiceTones.length > 0 && (
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-widest text-white/25">Tom de voz</p>
              <div className="flex flex-wrap gap-2">
                {dna.voiceTones.map((tone) => (
                  <span
                    key={tone}
                    className="px-2.5 py-1 text-[10px] font-medium text-white/60 border border-white/[0.1] rounded-full bg-white/[0.03]"
                  >
                    {tone}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.05] pt-8 mt-8 flex items-center justify-between gap-4">
          {onApply && (
            <button
              onClick={onApply}
              className="px-4 py-2.5 text-xs text-white/60 border border-white/[0.12] rounded-lg hover:border-white/25 hover:text-white/80 transition-colors"
            >
              Aplicar identidade ao proximo kit de lancamento
            </button>
          )}

          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium text-white rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Download size={12} />
            {isSaving ? "Salvando..." : "Salvar Brand Kit"}
          </button>
        </div>

      </div>
    </div>
  );
}
