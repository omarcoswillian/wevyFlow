"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2, ChevronRight, ChevronLeft, Upload, X as XIcon } from "lucide-react";

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
  referenceImages?: string[];
  referenceBrands?: string;
}

interface BrandWizardProps {
  onComplete: (dna: BrandDNA) => void;
  isGenerating: boolean;
}

const COLOR_PRESETS = [
  { primary: "#a78bfa", secondary: "#6366f1" },
  { primary: "#3b82f6", secondary: "#06b6d4" },
  { primary: "#ec4899", secondary: "#f43f5e" },
  { primary: "#f97316", secondary: "#eab308" },
  { primary: "#10b981", secondary: "#14b8a6" },
  { primary: "#c9a96e", secondary: "#b8860b" },
];

const VOICE_TONES = [
  "Autoritário", "Inspirador", "Direto", "Sofisticado",
  "Energético", "Confiante", "Inovador", "Acessível",
];

const VISUAL_STYLES: {
  id: BrandDNA["visualStyle"];
  label: string;
  desc: string;
  bg: string;
  text: string;
  border: string;
}[] = [
  {
    id: "dark-premium",
    label: "Dark Premium",
    desc: "Elegância e poder",
    bg: "#0a0a0a",
    text: "#ffffff",
    border: "#2a2a2a",
  },
  {
    id: "light-clean",
    label: "Light Clean",
    desc: "Clareza e sofisticação",
    bg: "#ffffff",
    text: "#111111",
    border: "#e5e7eb",
  },
  {
    id: "luxury",
    label: "Luxury",
    desc: "Ultra-refinamento",
    bg: "#f5f0e8",
    text: "#3d2c00",
    border: "#c9a96e",
  },
  {
    id: "tech",
    label: "Tech",
    desc: "Precisão digital",
    bg: "#0f172a",
    text: "#38bdf8",
    border: "#1e3a5f",
  },
  {
    id: "vibrant",
    label: "Vibrant",
    desc: "Energia e impacto",
    bg: "linear-gradient(135deg,#7c3aed,#ec4899)",
    text: "#ffffff",
    border: "#a855f7",
  },
  {
    id: "organic",
    label: "Organic",
    desc: "Humano e natural",
    bg: "#f2ede6",
    text: "#5c4a32",
    border: "#c4a882",
  },
];

const LOGO_TYPES: {
  id: BrandDNA["logoType"];
  label: string;
  desc: string;
  preview: string;
}[] = [
  { id: "wordmark", label: "Wordmark", desc: "Apenas o nome estilizado", preview: "Abc" },
  { id: "lettermark", label: "Lettermark", desc: "Iniciais / monograma", preview: "AB" },
  { id: "combination", label: "Simbolo + Texto", desc: "Marca + nome", preview: "◆ Abc" },
  { id: "symbol", label: "Simbolo", desc: "Apenas a marca", preview: "◆" },
];

const STEP_LABELS = ["Referencias", "Essencia", "Personalidade", "Direcao Visual", "Revisao"];

const PERSONALITY_AXES: {
  key: keyof BrandDNA["personality"];
  left: string;
  right: string;
}[] = [
  { key: "moderno", left: "Classico", right: "Moderno" },
  { key: "premium", left: "Popular", right: "Premium" },
  { key: "minimalista", left: "Arrojado", right: "Minimalista" },
  { key: "racional", left: "Emocional", right: "Racional" },
];

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              i === current
                ? "bg-purple-400 scale-125"
                : i < current
                ? "bg-purple-500/50"
                : "bg-white/10"
            )}
          />
          <span
            className={cn(
              "text-[10px] font-medium tracking-wide transition-colors duration-200",
              i === current ? "text-purple-300" : "text-white/20"
            )}
          >
            {label.toUpperCase()}
          </span>
          {i < STEP_LABELS.length - 1 && (
            <div
              className={cn(
                "w-6 h-px ml-1 transition-colors duration-300",
                i < current ? "bg-purple-500/40" : "bg-white/[0.06]"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

async function resizeImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = url;
  });
}

export function BrandWizard({ onComplete, isGenerating }: BrandWizardProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);

  // Step 0 — Referências visuais
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceBrands, setReferenceBrands] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [niche, setNiche] = useState("");
  const [tagline, setTagline] = useState("");

  const [personality, setPersonality] = useState<BrandDNA["personality"]>({
    moderno: 3,
    premium: 3,
    minimalista: 3,
    racional: 3,
  });
  const [voiceTones, setVoiceTones] = useState<string[]>([]);

  const [visualStyle, setVisualStyle] = useState<BrandDNA["visualStyle"]>("dark-premium");
  const [primaryColor, setPrimaryColor] = useState(COLOR_PRESETS[0].primary);
  const [logoType, setLogoType] = useState<BrandDNA["logoType"] | null>(null);

  const [variant, setVariant] = useState<BrandDNA["variant"]>("dark");

  function transition(next: number) {
    setVisible(false);
    setTimeout(() => {
      setStep(next);
      setVisible(true);
    }, 180);
  }

  async function handleImageFiles(files: FileList | null) {
    if (!files) return;
    const remaining = 4 - referenceImages.length;
    if (remaining <= 0) return;
    const selected = Array.from(files).slice(0, remaining);
    const resized = await Promise.all(selected.map(resizeImage));
    setReferenceImages((prev) => [...prev, ...resized].slice(0, 4));
  }

  function removeImage(idx: number) {
    setReferenceImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleTone(tone: string) {
    setVoiceTones((prev) => {
      if (prev.includes(tone)) return prev.filter((t) => t !== tone);
      if (prev.length >= 3) return prev;
      return [...prev, tone];
    });
  }

  function handleComplete() {
    if (!logoType) return;
    onComplete({
      name,
      niche,
      tagline,
      personality,
      voiceTones,
      visualStyle,
      primaryColor,
      logoType,
      variant,
      referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
      referenceBrands: referenceBrands.trim() || undefined,
    });
  }

  const inputCls =
    "w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white/80 placeholder:text-white/20 outline-none focus:border-white/[0.14] transition-colors";

  return (
    <div className="w-full max-w-[580px] mx-auto">
      <div className="bg-[#18181b] border border-white/[0.07] rounded-2xl p-6">
        <StepDots current={step} />

        <div
          className="transition-opacity duration-200"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {/* Step 0 — Referencias visuais */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[15px] font-semibold text-white/80 mb-1">
                  Referencias visuais
                </h2>
                <p className="text-[11px] text-white/30">
                  Quanto mais referencias, melhor sua identidade
                </p>
              </div>

              {/* Drop zone */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer",
                  isDragging
                    ? "border-purple-500/60 bg-purple-500/[0.06]"
                    : "border-white/[0.08] hover:border-white/[0.14] hover:bg-white/[0.02]"
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  await handleImageFiles(e.dataTransfer.files);
                }}
              >
                <Upload size={18} className="mx-auto mb-2 text-white/25" />
                <p className="text-[12px] text-white/50 font-medium">
                  Arraste imagens ou clique para selecionar
                </p>
                <p className="text-[10px] text-white/25 mt-1">
                  JPG, PNG ou WEBP — max. 4 imagens
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => handleImageFiles(e.target.files)}
                />
              </div>

              {/* Thumbnails */}
              {referenceImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {referenceImages.map((src, idx) => (
                    <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/[0.08] group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Referencia ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XIcon size={10} className="text-white" />
                      </button>
                    </div>
                  ))}
                  {referenceImages.length < 4 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-lg border border-dashed border-white/[0.08] hover:border-white/[0.18] flex items-center justify-center transition-colors text-white/25 hover:text-white/50"
                    >
                      <Upload size={16} />
                    </button>
                  )}
                </div>
              )}

              {/* Marcas de referencia */}
              <div>
                <label className="block text-[11px] text-white/30 mb-1.5">
                  Marcas que voce admira (opcional)
                </label>
                <input
                  className={inputCls}
                  placeholder="Ex: Nike, Apple, Headspace"
                  value={referenceBrands}
                  onChange={(e) => setReferenceBrands(e.target.value)}
                />
              </div>

              <div className="flex justify-between pt-1">
                <button
                  onClick={() => transition(1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50 transition-all"
                >
                  Pular
                </button>
                <button
                  onClick={() => transition(1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 transition-all"
                >
                  Proximo <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Step 1 — Essencia */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[15px] font-semibold text-white/80 mb-1">
                  Qual e o nome da sua marca?
                </h2>
                <p className="text-[11px] text-white/30">
                  Comece pela essencia — nome, nicho e posicionamento
                </p>
              </div>

              <div className="space-y-3">
                <input
                  className={inputCls}
                  placeholder="Ex: Metodo Forca Interior"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className={inputCls}
                  placeholder="Ex: Desenvolvimento pessoal, Fitness, Marketing Digital..."
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                />
                <input
                  className={inputCls}
                  placeholder="Ex: Resultados reais. Sem desculpas. (opcional)"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                />
              </div>

              <div className="flex justify-between pt-1">
                <button
                  onClick={() => transition(0)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50 transition-all"
                >
                  <ChevronLeft size={13} /> Voltar
                </button>
                <button
                  disabled={!name.trim()}
                  onClick={() => transition(2)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium transition-all",
                    name.trim()
                      ? "bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30"
                      : "bg-white/[0.03] border border-white/[0.06] text-white/20 cursor-not-allowed"
                  )}
                >
                  Proximo <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Personalidade */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[15px] font-semibold text-white/80 mb-1">
                  Como sua marca se posiciona?
                </h2>
                <p className="text-[11px] text-white/30">
                  Essas escolhas guiam a direcao criativa da identidade
                </p>
              </div>

              <div className="space-y-3">
                {PERSONALITY_AXES.map(({ key, left, right }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-[10px] text-white/30 w-16 text-right shrink-0">
                      {left}
                    </span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() =>
                            setPersonality((p) => ({ ...p, [key]: n }))
                          }
                          className={cn(
                            "w-7 h-7 rounded text-[11px] font-medium border transition-all",
                            personality[key] === n
                              ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                              : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:border-white/[0.14] hover:text-white/50"
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-white/30 w-16 shrink-0">
                      {right}
                    </span>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[11px] text-white/30 mb-2">
                  Tons de voz{" "}
                  <span className="text-white/20">(max. 3)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {VOICE_TONES.map((tone) => (
                    <button
                      key={tone}
                      onClick={() => toggleTone(tone)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all",
                        voiceTones.includes(tone)
                          ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                          : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:border-white/[0.14] hover:text-white/50"
                      )}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-1">
                <button
                  onClick={() => transition(1)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50 transition-all"
                >
                  <ChevronLeft size={13} /> Voltar
                </button>
                <button
                  onClick={() => transition(3)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 transition-all"
                >
                  Proximo <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Direcao Visual */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[15px] font-semibold text-white/80 mb-1">
                  Qual e a estetica da sua marca?
                </h2>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {VISUAL_STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setVisualStyle(style.id)}
                    className={cn(
                      "relative rounded-xl overflow-hidden border-2 transition-all h-20 text-left",
                      visualStyle === style.id
                        ? "border-purple-500/60 ring-1 ring-purple-500/30"
                        : "border-white/[0.06] hover:border-white/[0.14]"
                    )}
                    style={{
                      background: style.bg,
                      borderColor:
                        visualStyle === style.id ? undefined : style.border,
                    }}
                  >
                    <div className="absolute inset-0 p-2.5 flex flex-col justify-end">
                      <span
                        className="text-[10px] font-semibold block leading-tight"
                        style={{ color: style.text }}
                      >
                        {style.label}
                      </span>
                      <span
                        className="text-[9px] opacity-60 block"
                        style={{ color: style.text }}
                      >
                        {style.desc}
                      </span>
                    </div>
                    {visualStyle === style.id && (
                      <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-purple-400" />
                    )}
                  </button>
                ))}
              </div>

              <div>
                <p className="text-[11px] text-white/30 mb-2">Cor principal</p>
                <div className="flex items-center gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.primary}
                      onClick={() => setPrimaryColor(preset.primary)}
                      className={cn(
                        "w-7 h-7 rounded-full border-2 transition-all",
                        primaryColor === preset.primary
                          ? "border-white/60 scale-110"
                          : "border-white/[0.08] hover:scale-105"
                      )}
                      style={{ background: preset.primary }}
                    />
                  ))}
                  <label className="relative cursor-pointer">
                    <div
                      className="w-7 h-7 rounded-full border-2 border-white/[0.08] overflow-hidden hover:scale-105 transition-all"
                      style={{ background: primaryColor }}
                    />
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </label>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-white/30 mb-2">Tipo de logo</p>
                <div className="grid grid-cols-2 gap-2">
                  {LOGO_TYPES.map((lt) => (
                    <button
                      key={lt.id}
                      onClick={() => setLogoType(lt.id)}
                      className={cn(
                        "flex flex-col items-start gap-1 p-3 rounded-xl border transition-all",
                        logoType === lt.id
                          ? "bg-purple-500/20 border-purple-500/40"
                          : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.14]"
                      )}
                    >
                      <span
                        className={cn(
                          "text-[15px] font-bold tracking-tight",
                          logoType === lt.id ? "text-purple-300" : "text-white/40"
                        )}
                      >
                        {lt.preview}
                      </span>
                      <span
                        className={cn(
                          "text-[11px] font-semibold",
                          logoType === lt.id ? "text-purple-200" : "text-white/60"
                        )}
                      >
                        {lt.label}
                      </span>
                      <span className="text-[10px] text-white/25">{lt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between pt-1">
                <button
                  onClick={() => transition(2)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50 transition-all"
                >
                  <ChevronLeft size={13} /> Voltar
                </button>
                <button
                  disabled={!logoType}
                  onClick={() => transition(4)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium border transition-all",
                    logoType
                      ? "bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500/30"
                      : "bg-white/[0.03] border-white/[0.06] text-white/20 cursor-not-allowed"
                  )}
                >
                  Proximo <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — Revisao */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-[15px] font-semibold text-white/80 mb-1">
                  Sua identidade em construcao
                </h2>
                <p className="text-[11px] text-white/30">
                  Revise o briefing antes de gerar
                </p>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-2.5">
                <SummaryRow label="Marca" value={name || "—"} />
                <SummaryRow label="Nicho" value={niche || "—"} />
                {tagline && <SummaryRow label="Tagline" value={tagline} />}
                <SummaryRow
                  label="Estilo"
                  value={
                    VISUAL_STYLES.find((s) => s.id === visualStyle)?.label ?? "—"
                  }
                />
                <SummaryRow
                  label="Logo"
                  value={
                    LOGO_TYPES.find((l) => l.id === logoType)?.label ?? "—"
                  }
                />
                <SummaryRow
                  label="Personalidade"
                  value={`Moderno ${personality.moderno}/5 · Premium ${personality.premium}/5`}
                />
                {voiceTones.length > 0 && (
                  <SummaryRow label="Tons" value={voiceTones.join(", ")} />
                )}
                {referenceImages.length > 0 && (
                  <SummaryRow label="Referencias" value={`${referenceImages.length} imagem${referenceImages.length > 1 ? "ns" : ""}`} />
                )}
                {referenceBrands.trim() && (
                  <SummaryRow label="Marcas ref." value={referenceBrands} />
                )}
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[10px] text-white/30 w-24 shrink-0">Cor principal</span>
                  <div
                    className="w-4 h-4 rounded-full border border-white/[0.1]"
                    style={{ background: primaryColor }}
                  />
                  <span className="text-[11px] text-white/50">{primaryColor}</span>
                </div>
              </div>

              <div>
                <p className="text-[11px] text-white/30 mb-2">Fundo da identidade</p>
                <div className="flex gap-2">
                  {(["dark", "light"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVariant(v)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-[12px] font-medium border transition-all",
                        variant === v
                          ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                          : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:border-white/[0.14] hover:text-white/50"
                      )}
                    >
                      {v === "dark" ? "Fundo escuro" : "Fundo claro"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  disabled={isGenerating || !logoType}
                  onClick={handleComplete}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold transition-all",
                    "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
                    "hover:from-purple-400 hover:to-pink-400",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Construindo sua identidade...
                    </>
                  ) : (
                    "Gerar Identidade Visual"
                  )}
                </button>
                <p className="text-center text-[10px] text-white/20">
                  A IA vai construir seu logo com base nesse briefing estrategico
                </p>
              </div>

              <div className="flex justify-start">
                <button
                  onClick={() => transition(3)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium bg-white/[0.03] border border-white/[0.06] text-white/30 hover:text-white/50 transition-all"
                >
                  <ChevronLeft size={13} /> Voltar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[10px] text-white/30 w-24 shrink-0 pt-px">{label}</span>
      <span className="text-[11px] text-white/60 leading-snug">{value}</span>
    </div>
  );
}
