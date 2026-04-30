"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sparkles, RefreshCw, CheckCircle2, Loader2, AlertCircle,
  Type, Palette, Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LaunchKit, BrandIdentity, BrandLogo, BrandFont } from "../lib/types-kit";

/* ── Google Font loader ─────────────────────────────────── */

function loadGoogleFont(fonts: BrandFont[]) {
  if (typeof document === "undefined") return;
  fonts.forEach((f) => {
    const key = `gf-${f.name}`;
    if (document.querySelector(`link[data-gf="${key}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${f.googleFont}&display=swap`;
    link.dataset.gf = key;
    document.head.appendChild(link);
  });
}

/* ── Logo renderer ──────────────────────────────────────── */

function LogoRenderer({
  logo,
  size = "md",
  onDark,
}: {
  logo: BrandLogo;
  size?: "sm" | "md" | "lg";
  onDark: boolean;
}) {
  const fontSize = size === "lg" ? 44 : size === "md" ? 32 : 22;
  const subtextSize = Math.round(fontSize * 0.22);

  const textColor = onDark ? "#ffffff" : "#111827";
  const accentColorResolved = logo.accentColor || (onDark ? "rgba(255,255,255,0.55)" : logo.mainColor);

  const idx = logo.accentText ? logo.text.indexOf(logo.accentText) : -1;
  const before = idx >= 0 ? logo.text.slice(0, idx) : logo.text;
  const accentPart = idx >= 0 ? logo.accentText! : "";
  const after = idx >= 0 ? logo.text.slice(idx + (logo.accentText?.length ?? 0)) : "";

  const baseStyle: React.CSSProperties = {
    fontFamily: `'${logo.fontFamily}', 'Sora', sans-serif`,
    fontSize,
    fontWeight: parseInt(logo.fontWeight) || 700,
    letterSpacing: logo.letterSpacing,
    textTransform: logo.textTransform === "uppercase" ? "uppercase" : "none",
    color: textColor,
    lineHeight: 1,
    display: "block",
  };

  return (
    <div style={{ fontFamily: `'${logo.fontFamily}', 'Sora', sans-serif` }}>
      <span style={baseStyle}>
        {before}
        {accentPart && (
          <span style={{
            fontWeight: parseInt(logo.accentFontWeight || logo.fontWeight) || 400,
            fontStyle: logo.accentItalic ? "italic" : "normal",
            color: accentColorResolved,
          }}>
            {accentPart}
          </span>
        )}
        {after}
      </span>
      {logo.subtext && (
        <span style={{
          display: "block",
          fontFamily: `'${logo.fontFamily}', 'Sora', sans-serif`,
          fontSize: subtextSize,
          letterSpacing: logo.subtextSpacing || "0.18em",
          textTransform: "uppercase",
          color: onDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
          marginTop: Math.round(fontSize * 0.18),
          fontWeight: 400,
        }}>
          {logo.subtext}
        </span>
      )}
    </div>
  );
}

/* ── Logo card ──────────────────────────────────────────── */

function LogoCard({
  logo, bgType, primaryHex,
}: {
  logo: BrandLogo;
  bgType: "dark" | "light" | "brand";
  primaryHex: string;
}) {
  const bg =
    bgType === "dark" ? "#0c0c10" :
    bgType === "light" ? "#f5f4f0" :
    primaryHex;

  const label =
    bgType === "dark" ? "Fundo escuro" :
    bgType === "light" ? "Fundo claro" :
    "Fundo da marca";

  const onDark = bgType !== "light";

  return (
    <div
      className="flex-1 min-w-0 rounded-xl overflow-hidden border border-white/[0.07]"
      style={{ background: bg }}
    >
      <div className="flex items-center justify-center px-6 py-7 min-h-[96px]">
        <LogoRenderer logo={logo} size="md" onDark={onDark} />
      </div>
      <div
        className="px-3 py-1.5 text-[9px] uppercase tracking-widest font-semibold border-t"
        style={{
          borderColor: onDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)",
          color: onDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* ── Color swatch ───────────────────────────────────────── */

function ColorSwatch({ name, hex, usage }: { name: string; hex: string; usage: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(hex).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      onClick={copy}
      className="flex-1 min-w-0 group rounded-xl overflow-hidden border border-white/[0.06] hover:border-white/[0.14] transition-colors cursor-pointer"
    >
      <div
        className="w-full h-16"
        style={{ background: hex }}
      />
      <div className="px-2.5 py-2 bg-[#18181b]">
        <p className="text-[11px] font-semibold text-white/80 truncate leading-tight">{name}</p>
        <p className="text-[10px] font-mono text-white/35 group-hover:text-white/60 transition-colors mt-0.5">
          {copied ? "Copiado!" : hex}
        </p>
        <p className="text-[9px] uppercase tracking-widest text-white/20 mt-0.5">{usage}</p>
      </div>
    </button>
  );
}

/* ── Font card ──────────────────────────────────────────── */

function FontCard({ font }: { font: BrandFont }) {
  const label = font.usage === "display" ? "Títulos & Logo" : "Textos & Corpo";
  return (
    <div className="flex-1 rounded-xl bg-[#18181b] border border-white/[0.06] p-4 min-w-0">
      <p className="text-[9px] uppercase tracking-widest text-white/25 font-semibold mb-3">{label}</p>
      <div
        className="text-[42px] leading-none text-white/90 mb-3"
        style={{ fontFamily: `'${font.name}', 'Sora', sans-serif`, fontWeight: font.usage === "display" ? 700 : 400 }}
      >
        Aa
      </div>
      <p className="text-[12px] font-semibold text-white/70 truncate">{font.name}</p>
      <p
        className="text-[11px] text-white/40 mt-1 leading-relaxed line-clamp-2"
        style={{ fontFamily: `'${font.name}', 'Sora', sans-serif` }}
      >
        {font.usage === "display"
          ? "Transforme sua presença"
          : "A consistência constrói autoridade e gera resultados."}
      </p>
    </div>
  );
}

/* ── Skeleton loading ───────────────────────────────────── */

function IdentitySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-12 bg-white/[0.04] rounded-xl w-3/4" />
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-1 h-28 bg-white/[0.04] rounded-xl" />
        ))}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex-1 h-20 bg-white/[0.04] rounded-xl" />
        ))}
      </div>
      <div className="flex gap-3">
        <div className="flex-1 h-28 bg-white/[0.04] rounded-xl" />
        <div className="flex-1 h-28 bg-white/[0.04] rounded-xl" />
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */

interface Props {
  kit: LaunchKit;
  onUpdate: (updated: LaunchKit) => void;
  apiKey?: string;
  aiProvider?: string;
  aiModel?: string;
}

export function BrandIdentityStudio({ kit, onUpdate, apiKey, aiProvider, aiModel }: Props) {
  const identity = kit.brandIdentity;
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Google Fonts when identity is available
  useEffect(() => {
    if (identity?.fonts?.length) {
      loadGoogleFont(identity.fonts);
    }
    // Also load logo font if specified
    if (identity?.logo?.fontFamily) {
      const matchedFont = identity.fonts?.find((f) => f.name === identity.logo.fontFamily);
      if (!matchedFont) {
        // Load directly from logo font name
        const encoded = identity.logo.fontFamily.replace(/ /g, "+");
        const weights = [identity.logo.fontWeight, identity.logo.accentFontWeight]
          .filter(Boolean).join(";");
        loadGoogleFont([{
          name: identity.logo.fontFamily,
          googleFont: `${encoded}:wght@${weights || "400;700"}`,
          usage: "display",
        }]);
      }
    }
  }, [identity]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);

    // Optimistic: mark as generating in kit
    const withGenerating: LaunchKit = {
      ...kit,
      brandIdentity: kit.brandIdentity
        ? { ...kit.brandIdentity, status: "generating" }
        : {
            status: "generating",
            concept: "",
            words: [],
            colors: [],
            fonts: [],
            logo: { type: "wordmark", text: kit.brandInfo.productName, fontFamily: "Sora", fontWeight: "700", letterSpacing: "-0.03em", textTransform: "none", mainColor: kit.brandInfo.primaryColor },
            createdAt: new Date().toISOString(),
          },
    };
    onUpdate(withGenerating);

    try {
      const res = await fetch("/api/generate-brand-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandInfo: kit.brandInfo,
          ...(apiKey ? { apiKey, aiProvider, aiModel } : {}),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const newIdentity: BrandIdentity = await res.json();
      onUpdate({ ...kit, brandIdentity: newIdentity });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setError(msg);
      onUpdate({ ...kit, brandIdentity: kit.brandIdentity ? { ...kit.brandIdentity, status: "draft" } : undefined });
    } finally {
      setGenerating(false);
    }
  }, [kit, apiKey, aiProvider, aiModel, onUpdate]);

  const approve = useCallback(() => {
    if (!identity) return;
    onUpdate({
      ...kit,
      brandIdentity: { ...identity, status: "approved", approvedAt: new Date().toISOString() },
    });
  }, [kit, identity, onUpdate]);

  const primaryColor = identity?.colors.find((c) => c.usage === "primary")?.hex
    ?? kit.brandInfo.primaryColor
    ?? "#6366f1";

  /* ── No identity yet ── */
  if (!identity || identity.status === "generating" && !identity.concept) {
    return (
      <div className="space-y-3">
        {generating || identity?.status === "generating" ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
              <span className="text-[11px] text-white/40">Criando identidade visual...</span>
            </div>
            <IdentitySkeleton />
          </>
        ) : (
          <button
            onClick={generate}
            disabled={generating}
            className="w-full flex flex-col items-center gap-3 px-6 py-8 rounded-xl border border-dashed border-white/[0.1] hover:border-purple-500/40 hover:bg-purple-500/[0.04] transition-all group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-semibold text-white/80">Criar Identidade Visual</p>
              <p className="text-[11px] text-white/35 mt-1">
                Logo, paleta de cores e tipografia gerados por IA com base no seu briefing
              </p>
            </div>
            <span className="px-4 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300 text-[11px] font-medium">
              Gerar agora
            </span>
          </button>
        )}

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/8 border border-red-500/15">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-400/80">{error}</p>
          </div>
        )}
      </div>
    );
  }

  /* ── Loading state (regenerating with existing identity) ── */
  const isLoading = generating || identity.status === "generating";

  const displayFont = identity.fonts.find((f) => f.usage === "display");
  const bodyFont = identity.fonts.find((f) => f.usage === "body");

  return (
    <div className="space-y-4">
      {/* Status + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {identity.status === "approved" ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
              <CheckCircle2 className="w-3 h-3" /> Aprovada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-semibold">
              Rascunho
            </span>
          )}
          {isLoading && (
            <span className="flex items-center gap-1 text-[10px] text-purple-400">
              <Loader2 className="w-3 h-3 animate-spin" /> Atualizando...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={generate}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-white/40 text-[11px] font-medium hover:text-white/70 hover:border-white/15 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} /> Regenerar
          </button>

          {identity.status !== "approved" && (
            <button
              onClick={approve}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/25 transition-colors cursor-pointer disabled:opacity-40"
            >
              <CheckCircle2 className="w-3 h-3" /> Aprovar
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <IdentitySkeleton />
      ) : (
        <div className="space-y-4">
          {/* Concept */}
          {identity.concept && (
            <div className="flex gap-3 px-4 py-3.5 rounded-xl bg-[#18181b] border border-white/[0.06]">
              <Quote className="w-4 h-4 text-white/15 shrink-0 mt-0.5" />
              <p className="text-[12px] text-white/55 leading-relaxed italic">{identity.concept}</p>
            </div>
          )}

          {/* Logo previews */}
          {identity.logo && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Type className="w-3 h-3 text-white/20" />
                <span className="text-[9px] uppercase tracking-widest text-white/25 font-semibold">Logo</span>
              </div>
              <div className="flex gap-2">
                <LogoCard logo={identity.logo} bgType="dark" primaryHex={primaryColor} />
                <LogoCard logo={identity.logo} bgType="light" primaryHex={primaryColor} />
                <LogoCard logo={identity.logo} bgType="brand" primaryHex={primaryColor} />
              </div>
            </div>
          )}

          {/* Color palette */}
          {identity.colors.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Palette className="w-3 h-3 text-white/20" />
                <span className="text-[9px] uppercase tracking-widest text-white/25 font-semibold">Paleta</span>
              </div>
              <div className="flex gap-2">
                {identity.colors.map((c) => (
                  <ColorSwatch key={c.usage} name={c.name} hex={c.hex} usage={c.usage} />
                ))}
              </div>
            </div>
          )}

          {/* Typography */}
          {(displayFont || bodyFont) && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Type className="w-3 h-3 text-white/20" />
                <span className="text-[9px] uppercase tracking-widest text-white/25 font-semibold">Tipografia</span>
              </div>
              <div className="flex gap-3">
                {displayFont && <FontCard font={displayFont} />}
                {bodyFont && <FontCard font={bodyFont} />}
              </div>
            </div>
          )}

          {/* Brand words */}
          {identity.words.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {identity.words.map((word) => (
                <span
                  key={word}
                  className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.07] text-[11px] text-white/40 font-medium tracking-wide"
                >
                  {word}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/8 border border-red-500/15">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-400/80">{error}</p>
        </div>
      )}
    </div>
  );
}
