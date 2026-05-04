"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2, FileText, X, Plus, Rocket } from "lucide-react";

const LAUNCH_TYPES = [
  "Perpetuo", "Classico", "Semente", "Meteorico", "Pago / VSL", "Afiliados",
];

const FONT_OPTIONS = [
  { id: "sora", label: "Sora" },
  { id: "inter", label: "Inter" },
  { id: "poppins", label: "Poppins" },
  { id: "montserrat", label: "Montserrat" },
  { id: "playfair", label: "Playfair" },
  { id: "space-grotesk", label: "Space Grotesk" },
];

const STYLE_PRESETS = [
  { id: "dark-premium", label: "Dark" },
  { id: "light-clean", label: "Light" },
  { id: "glassmorphism", label: "Glass" },
  { id: "neon-tech", label: "Neon" },
  { id: "luxury", label: "Luxury" },
  { id: "brutalist", label: "Brutal" },
];

const COLOR_PRESETS = [
  { primary: "#a78bfa", secondary: "#6366f1" },
  { primary: "#3b82f6", secondary: "#06b6d4" },
  { primary: "#ec4899", secondary: "#f43f5e" },
  { primary: "#f97316", secondary: "#eab308" },
  { primary: "#10b981", secondary: "#14b8a6" },
  { primary: "#f1f5f9", secondary: "#e2e8f0" },
];

const ASSETS = ["LP Captura", "LP Vendas", "Emails", "Criativos"];

const inputCls =
  "w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors";

const labelCls = "text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block";

function SectionHeader({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[9px] font-bold text-purple-500/50 tabular-nums">{number}</span>
      <span className="text-[9px] uppercase tracking-widest text-white/30 font-semibold">{title}</span>
      <div className="flex-1 h-px bg-white/[0.04]" />
    </div>
  );
}

export interface BriefingState {
  produto: string;
  tipoLancamento: string;
  oferta: string;
  publicoAlvo: string;
  promessa: string;
  primaryColor: string;
  secondaryColor: string;
  fontChoice: string;
  stylePreset: string;
  images: { name: string; base64: string }[];
  copyDocument: string;
  copyFileName: string | null;
  copyUploading: boolean;
  copyError: string | null;
}

interface BriefingPanelProps {
  state: BriefingState;
  isLoading: boolean;
  onSubmit: () => void;
  onChange: <K extends keyof BriefingState>(key: K, value: BriefingState[K]) => void;
  onDocUpload: (file: File) => void;
  onClearDoc: () => void;
  onClearImage: (index: number) => void;
}

export function BriefingPanel({
  state,
  isLoading,
  onSubmit,
  onChange,
  onDocUpload,
  onClearDoc,
  onClearImage,
}: BriefingPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const filledCount = [
    !!state.produto.trim(),
    !!state.promessa.trim(),
    !!state.oferta.trim(),
    state.images.length > 0,
    !!state.copyDocument.trim(),
  ].filter(Boolean).length;

  const canSubmit =
    !isLoading &&
    (!!state.produto.trim() || !!state.promessa.trim() || state.images.length > 0);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 500_000) return;
      const reader = new FileReader();
      reader.onload = () => {
        onChange("images", [
          ...state.images.slice(0, 4),
          { name: file.name, base64: reader.result as string },
        ]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onDocUpload(file);
    e.target.value = "";
  };

  return (
    <div className="w-full max-w-[580px] rounded-2xl bg-[#18181b] border border-white/[0.07] shadow-2xl shadow-black/70 overflow-hidden">

      {/* Header estrategico */}
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.05]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-purple-500/15 shrink-0">
                <Rocket className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white/85 leading-tight">Briefing Estrategico</p>
                <p className="text-[10px] text-white/30 leading-tight mt-0.5">A IA gera o kit completo pelo seu briefing</p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {ASSETS.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[9px] text-white/30 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-[9px] text-white/20 uppercase tracking-widest block mb-1.5">Completude</span>
            <div className="flex items-center gap-1 justify-end">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i < filledCount ? "bg-purple-400" : "bg-white/[0.08]"
                  )}
                />
              ))}
            </div>
            <span className="text-[9px] text-white/20 mt-1 block">{filledCount}/5</span>
          </div>
        </div>
      </div>

      {/* Secao 01: Produto */}
      <div className="p-4 space-y-3">
        <SectionHeader number="01" title="Produto" />

        <div>
          <label className={labelCls}>Nome do produto ou curso</label>
          <input
            value={state.produto}
            onChange={(e) => onChange("produto", e.target.value)}
            placeholder="Ex: Metodo Forca Interior, Clube do Copywriter..."
            className={inputCls}
            autoFocus
          />
        </div>

        <div>
          <label className={labelCls}>Estrategia de lancamento</label>
          <div className="flex flex-wrap gap-1">
            {LAUNCH_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => onChange("tipoLancamento", t)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer border",
                  state.tipoLancamento === t
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                    : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:text-white/55 hover:border-white/[0.12]"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Oferta e preco</label>
          <input
            value={state.oferta}
            onChange={(e) => onChange("oferta", e.target.value)}
            placeholder="Ex: R$ 997 — 4 modulos + 3 bonus + suporte 30 dias"
            className={inputCls}
          />
        </div>
      </div>

      {/* Secao 02: Audiencia & Promessa */}
      <div className="px-4 pb-4 border-t border-white/[0.05] space-y-3 pt-4">
        <SectionHeader number="02" title="Audiencia & Promessa" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Para quem e</label>
            <input
              value={state.publicoAlvo}
              onChange={(e) => onChange("publicoAlvo", e.target.value)}
              placeholder="Ex: Mulheres 30-50 anos"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Qual a transformacao prometida</label>
            <input
              value={state.promessa}
              onChange={(e) => onChange("promessa", e.target.value)}
              placeholder="Ex: Perca 10kg em 90 dias"
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Secao 03: Identidade Visual */}
      <div className="px-4 pb-4 border-t border-white/[0.05] space-y-3 pt-4">
        <SectionHeader number="03" title="Identidade Visual" />

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-white/25 uppercase tracking-widest">Cor</span>
            {COLOR_PRESETS.map((cp, i) => (
              <button
                key={i}
                onClick={() => {
                  onChange("primaryColor", cp.primary);
                  onChange("secondaryColor", cp.secondary);
                }}
                className={cn(
                  "w-5 h-5 rounded-md border transition-all cursor-pointer hover:scale-110",
                  state.primaryColor === cp.primary ? "border-white/50 scale-110" : "border-transparent"
                )}
                style={{ background: `linear-gradient(135deg, ${cp.primary}, ${cp.secondary})` }}
              />
            ))}
            <input
              type="color"
              value={state.primaryColor}
              onChange={(e) => onChange("primaryColor", e.target.value)}
              className="w-4 h-4 rounded cursor-pointer bg-transparent border-0"
            />
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[9px] text-white/25 uppercase tracking-widest mr-1">Fonte</span>
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.id}
                onClick={() => onChange("fontChoice", f.id)}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] cursor-pointer transition-all",
                  state.fontChoice === f.id
                    ? "bg-purple-500/20 text-purple-400"
                    : "text-white/25 hover:text-white/40"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[9px] text-white/25 uppercase tracking-widest mr-1">Estilo</span>
          {STYLE_PRESETS.map((s) => (
            <button
              key={s.id}
              onClick={() => onChange("stylePreset", s.id)}
              className={cn(
                "px-2 py-0.5 rounded text-[9px] cursor-pointer transition-all",
                state.stylePreset === s.id
                  ? "bg-purple-500/20 text-purple-400"
                  : "text-white/25 hover:text-white/40"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[9px] text-white/25 uppercase tracking-widest">Logo / Imgs</span>
          {state.images.map((img, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.base64}
                alt=""
                className="w-8 h-8 rounded-lg object-cover border border-white/10"
              />
              <button
                onClick={() => onClearImage(i)}
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
              >
                x
              </button>
            </div>
          ))}
          {state.images.length < 5 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-8 h-8 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-white/20 hover:text-purple-400 hover:border-purple-500/30 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Secao 04: Copy Pronta */}
      <div className="px-4 pb-4 border-t border-white/[0.05] pt-4">
        <div className="flex items-center justify-between mb-3">
          <SectionHeader number="04" title="Copy Pronta (opcional)" />
          {state.copyFileName && (
            <button
              onClick={onClearDoc}
              className="text-[9px] text-red-400/60 hover:text-red-400 transition-colors cursor-pointer flex items-center gap-1 shrink-0 ml-2 -mt-3"
            >
              <X className="w-2.5 h-2.5" /> Remover
            </button>
          )}
        </div>

        {state.copyFileName ? (
          <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span className="text-[11px] text-purple-300 truncate flex-1">{state.copyFileName}</span>
            <span className="text-[9px] text-white/25">
              {state.copyDocument.length.toLocaleString()} chars
            </span>
          </div>
        ) : (
          <button
            onClick={() => docInputRef.current?.click()}
            disabled={state.copyUploading}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-white/10 text-white/25 hover:text-purple-400 hover:border-purple-500/30 transition-all cursor-pointer text-[11px] disabled:opacity-50"
          >
            {state.copyUploading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" /> Processando...
              </>
            ) : (
              <>
                <FileText className="w-3 h-3" /> Carregar copy existente (.docx ou .pdf)
              </>
            )}
          </button>
        )}
        {state.copyError && (
          <p className="text-[10px] text-red-400/70 mt-1.5">{state.copyError}</p>
        )}
        <input
          ref={docInputRef}
          type="file"
          accept=".docx,.pdf"
          onChange={handleDocChange}
          className="hidden"
        />
      </div>

      {/* CTA */}
      <div className="px-4 pb-4 border-t border-white/[0.05] pt-3">
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className={cn(
            "w-full py-3 rounded-xl text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-2",
            canSubmit
              ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:shadow-purple-500/25 hover:scale-[1.01] active:scale-[0.99]"
              : "bg-white/[0.04] text-white/20 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Gerando kit...
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4" />
              {canSubmit ? "Gerar Kit Completo" : "Preencha o produto ou promessa"}
            </>
          )}
        </button>
        {canSubmit && (
          <p className="text-[9px] text-white/20 text-center mt-2">
            LP Captura · LP Vendas · Emails · Criativos — tudo conectado
          </p>
        )}
      </div>
    </div>
  );
}
