"use client";

import { useState, useRef } from "react";
import {
  ArrowLeft, Trash2, Clock, Loader2, CheckCircle2, AlertCircle,
  ShoppingCart, Mail, CreditCard, Play, Video, Users, ExternalLink,
  RefreshCw, Zap, Globe, Smartphone, Tv, Image, LayoutGrid,
  ChevronRight, Link,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppContext } from "../(app)/_context";
import { STRATEGY_MAP } from "../lib/launch-strategies";
import type { LaunchKit, KitAssetInstance, StrategyAsset, PageKind, CreativoFormat } from "../lib/types-kit";
import { EmailSequencePanel } from "./EmailSequencePanel";
import { BrandIdentityStudio } from "./BrandIdentityStudio";

/* ── Helpers ─────────────────────────────────────────────── */

function buildIdentityBlock(identity: import("../lib/types-kit").BrandIdentity): string {
  const primary = identity.colors.find((c) => c.usage === "primary");
  const secondary = identity.colors.find((c) => c.usage === "secondary");
  const accent = identity.colors.find((c) => c.usage === "accent");
  const light = identity.colors.find((c) => c.usage === "light");
  const dark = identity.colors.find((c) => c.usage === "dark");
  const displayFont = identity.fonts.find((f) => f.usage === "display");
  const bodyFont = identity.fonts.find((f) => f.usage === "body");

  const logo = identity.logo;
  const logoDesc = logo.type === "wordmark-accent" && logo.accentText
    ? `"${logo.text.replace(logo.accentText, "")}${logo.accentText}" — parte "${logo.accentText}" em estilo diferenciado (peso ${logo.accentFontWeight || logo.fontWeight}${logo.accentItalic ? ", itálico" : ""})`
    : `"${logo.text}"`;

  return [
    "IDENTIDADE VISUAL APROVADA (use fielmente em toda a página):",
    `Logo: ${logoDesc} | fonte: ${logo.fontFamily} | peso: ${logo.fontWeight} | letter-spacing: ${logo.letterSpacing}`,
    primary   ? `Cor primária: ${primary.hex} (${primary.name})` : "",
    secondary ? `Cor secundária: ${secondary.hex} (${secondary.name})` : "",
    accent    ? `Cor de destaque/CTA: ${accent.hex} (${accent.name})` : "",
    light     ? `Cor clara/fundo light: ${light.hex}` : "",
    dark      ? `Cor escura/texto: ${dark.hex}` : "",
    displayFont ? `Fonte de títulos: ${displayFont.name}` : "",
    bodyFont    ? `Fonte de corpo: ${bodyFont.name}` : "",
    identity.concept ? `Conceito da marca: ${identity.concept}` : "",
    identity.words.length ? `Palavras-chave: ${identity.words.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

function buildAssetPrompt(kit: LaunchKit, asset: StrategyAsset): string {
  const { brandInfo: b } = kit;

  const lines = [
    `PRODUTO: ${b.productName}`,
    `NICHO: ${b.niche}`,
    `PÚBLICO-ALVO: ${b.targetAudience}`,
    `TRANSFORMAÇÃO: ${b.transformation}`,
    b.mecanismo ? `MECANISMO ÚNICO: ${b.mecanismo}` : "",
    b.preco     ? `PREÇO + ÂNCORA: ${b.preco}` : "",
    b.provas    ? `PROVAS E RESULTADOS: ${b.provas}` : "",
    `COR PRIMÁRIA: ${b.primaryColor}`,
    `COR SECUNDÁRIA: ${b.secondaryColor}`,
    `FONTE: ${b.fontChoice}`,
    `ESTILO: ${b.stylePreset}`,
    kit.brandIdentity?.status === "approved" ? `\n${buildIdentityBlock(kit.brandIdentity)}` : "",
  ].filter(Boolean).join("\n");

  if (asset.type === "page") {
    return `${lines}\n\nCrie uma página HTML completa de alta conversão para: ${asset.label}. ${asset.description}`;
  }
  return `${lines}\n\nCrie um criativo visual formato ${asset.format ?? "stories"} para: ${asset.label}.`;
}

/* ── Metadata maps ───────────────────────────────────────── */

const STRATEGY_LABEL: Record<string, string> = {
  classico: "Clássico", meteorico: "Meteórico", semente: "Semente",
  "pago-vsl": "Pago / VSL", perpetuo: "Perpétuo",
};

const PAGE_KIND_META: Record<PageKind, { icon: React.ElementType; color: string; bg: string }> = {
  "lp-vendas":  { icon: ShoppingCart, color: "text-purple-400",  bg: "bg-purple-500/10" },
  "lp-captura": { icon: Mail,          color: "text-blue-400",    bg: "bg-blue-500/10"   },
  "obrigado":   { icon: CheckCircle2,  color: "text-emerald-400", bg: "bg-emerald-500/10"},
  "checkout":   { icon: CreditCard,    color: "text-orange-400",  bg: "bg-orange-500/10" },
  "vsl":        { icon: Play,          color: "text-pink-400",    bg: "bg-pink-500/10"   },
  "webinar":    { icon: Video,         color: "text-yellow-400",  bg: "bg-yellow-500/10" },
};

const FORMAT_META: Record<CreativoFormat, { icon: React.ElementType; dims: string; label: string }> = {
  "thumb-yt":      { icon: Tv,     dims: "1280 × 720",  label: "Thumb YT"      },
  "capa-yt":       { icon: Tv,     dims: "2560 × 1440", label: "Capa Canal"    },
  "stories":       { icon: Smartphone,  dims: "1080 × 1920", label: "Stories"       },
  "feed-quadrado": { icon: LayoutGrid,  dims: "1080 × 1080", label: "Feed Quad."    },
  "feed-retrato":  { icon: Image,       dims: "1080 × 1350", label: "Feed Retrato"  },
  "banner-google": { icon: Globe,       dims: "300 × 250",   label: "Banner Google" },
  "email":         { icon: Mail,        dims: "600 px",      label: "E-mail"        },
};

/* ── Status helpers ──────────────────────────────────────── */

function StatusBadge({ status }: { status: KitAssetInstance["status"] }) {
  if (status === "done")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium">
        <CheckCircle2 className="w-2.5 h-2.5" /> Pronto
      </span>
    );
  if (status === "generating")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] font-medium">
        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Gerando
      </span>
    );
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-[10px] font-medium">
        <AlertCircle className="w-2.5 h-2.5" /> Erro
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.04] text-white/30 text-[10px] font-medium">
      <Clock className="w-2.5 h-2.5" /> Pendente
    </span>
  );
}

/* ── Page Card ───────────────────────────────────────────── */

function PageCard({
  asset, instance, isLocallyGenerating, onGenerate, onView,
}: {
  asset: StrategyAsset;
  instance?: KitAssetInstance;
  isLocallyGenerating: boolean;
  onGenerate: (asset: StrategyAsset) => void;
  onView: (code: string, label: string) => void;
}) {
  const stored = instance?.status ?? "pending";
  // "generating" status from a previous session = treat as pending (stale)
  const status = stored === "generating" && !isLocallyGenerating ? "pending" : stored;
  const meta = PAGE_KIND_META[asset.pageKind ?? "lp-vendas"];
  const Icon = meta.icon;

  return (
    <div className={cn(
      "flex flex-col gap-3 p-4 rounded-xl border transition-colors",
      "bg-[#18181b] border-white/[0.06] hover:border-white/[0.12]",
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("shrink-0 w-8 h-8 rounded-lg flex items-center justify-center", meta.bg)}>
          <Icon className={cn("w-4 h-4", meta.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white leading-tight truncate">{asset.label}</p>
          <p className="text-[11px] text-white/35 mt-0.5 line-clamp-1">{asset.description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 pt-1 border-t border-white/[0.04]">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={status} />

          {(status === "pending") && (
            <button
              onClick={() => onGenerate(asset)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300 text-[11px] font-medium hover:bg-purple-500/25 transition-colors cursor-pointer"
            >
              <Zap className="w-3 h-3" /> Gerar
            </button>
          )}
          {status === "generating" && (
            <button disabled className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white/[0.04] text-white/20 text-[11px] cursor-not-allowed">
              <Loader2 className="w-3 h-3 animate-spin" /> Gerando…
            </button>
          )}
          {status === "done" && (
            <button
              onClick={() => instance?.generatedCode && onView(instance.generatedCode, asset.label)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/20 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" /> Abrir
            </button>
          )}
          {status === "error" && (
            <button
              onClick={() => onGenerate(asset)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> Tentar novamente
            </button>
          )}
        </div>
        {status === "error" && instance?.error && (
          <p className="text-[10px] text-red-400/60 leading-snug">{instance.error}</p>
        )}
      </div>
    </div>
  );
}

/* ── Creative Card ───────────────────────────────────────── */

function CreativeCard({
  asset, instance, isLocallyGenerating, onGenerate, onView,
}: {
  asset: StrategyAsset;
  instance?: KitAssetInstance;
  isLocallyGenerating: boolean;
  onGenerate: (asset: StrategyAsset) => void;
  onView: (code: string, label: string) => void;
}) {
  const stored = instance?.status ?? "pending";
  const status = stored === "generating" && !isLocallyGenerating ? "pending" : stored;
  const meta = FORMAT_META[asset.format ?? "stories"];
  const Icon = meta.icon;

  return (
    <div className={cn(
      "flex flex-col gap-2.5 p-3 rounded-xl border transition-colors",
      "bg-[#18181b] border-white/[0.06] hover:border-white/[0.12]",
    )}>
      <div className="flex items-center gap-2.5">
        <div className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-white/40" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-white truncate leading-tight">{asset.label}</p>
          <p className="text-[10px] text-white/30 font-mono">{meta.dims}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-1">
        <StatusBadge status={status} />

        {status === "pending" && (
          <button
            onClick={() => onGenerate(asset)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300 text-[10px] font-medium hover:bg-purple-500/25 transition-colors cursor-pointer"
          >
            <Zap className="w-2.5 h-2.5" /> Gerar
          </button>
        )}
        {status === "generating" && (
          <button disabled className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] text-white/20 text-[10px] cursor-not-allowed">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
          </button>
        )}
        {status === "done" && (
          <button
            onClick={() => instance?.generatedCode && onView(instance.generatedCode, asset.label)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium hover:bg-emerald-500/20 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-2.5 h-2.5" /> Abrir
          </button>
        )}
        {status === "error" && (
          <button
            onClick={() => onGenerate(asset)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────── */

function patchAsset(kit: LaunchKit, assetId: string, patch: Partial<KitAssetInstance>): LaunchKit {
  const exists = kit.assets.find((a) => a.assetId === assetId);
  const next = exists
    ? kit.assets.map((a) => a.assetId === assetId ? { ...a, ...patch } : a)
    : [...kit.assets, { assetId, status: "pending" as const, ...patch }];
  return { ...kit, assets: next };
}

export function LaunchHub() {
  const {
    activeLaunchKit,
    setActiveLaunchKit,
    saveLaunchKit,
    deleteLaunchKit,
    openCodeInWorkspace,
    navigate,
    apiKey,
    aiProvider,
    aiModel,
    webhookUrl,
    setWebhookUrl,
  } = useAppContext();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [webhookInput, setWebhookInput] = useState(webhookUrl);
  const [webhookSaved, setWebhookSaved] = useState(false);
  // Tracks which asset IDs are actively generating IN THIS SESSION (not persisted)
  const [localGenerating, setLocalGenerating] = useState<Set<string>>(new Set());

  // Always points to the latest kit — avoids stale closure when multiple assets generate sequentially
  const kitRef = useRef(activeLaunchKit);
  kitRef.current = activeLaunchKit;

  if (!activeLaunchKit) return null;

  const kit = activeLaunchKit;
  const strategy = STRATEGY_MAP[kit.strategyId];
  const pages = strategy.assets.filter((a) => a.type === "page");
  const criativos = strategy.assets.filter((a) => a.type === "criativo");

  const totalAssets = strategy.assets.length;
  const doneAssets = kit.assets.filter((a) => a.status === "done").length;
  const progressPct = totalAssets > 0 ? Math.round((doneAssets / totalAssets) * 100) : 0;

  const getInstance = (assetId: string): KitAssetInstance | undefined =>
    kit.assets.find((a) => a.assetId === assetId);

  const hasPendingPages = pages.some((p) => {
    const s = getInstance(p.id)?.status ?? "pending";
    return s === "pending" || s === "error";
  });
  const hasPendingCreativos = criativos.some((c) => {
    const s = getInstance(c.id)?.status ?? "pending";
    return s === "pending" || s === "error";
  });

  const handleGenerateAsset = async (asset: StrategyAsset) => {
    // Read from ref so this closure always has the latest kit, even when called sequentially
    const kitAtStart = kitRef.current!;

    // Mark as locally generating (in-memory only, survives re-renders but not reloads)
    setLocalGenerating((prev) => new Set([...prev, asset.id]));

    // Persist "generating" status to kit so the badge shows correctly
    const withGenerating = patchAsset(kitAtStart, asset.id, { status: "generating", error: undefined });
    saveLaunchKit(withGenerating);
    setActiveLaunchKit(withGenerating);

    try {
      // If brand identity is approved, use its palette/fonts in the generation
      const identity = kitAtStart.brandIdentity?.status === "approved" ? kitAtStart.brandIdentity : null;
      const primaryColor = identity?.colors.find((c) => c.usage === "primary")?.hex ?? kitAtStart.brandInfo.primaryColor;
      const secondaryColor = identity?.colors.find((c) => c.usage === "secondary")?.hex ?? kitAtStart.brandInfo.secondaryColor;
      const fontChoice = identity?.fonts.find((f) => f.usage === "display")?.name ?? kitAtStart.brandInfo.fontChoice;

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: buildAssetPrompt(kitAtStart, asset),
          platform: "html",
          primaryColor,
          secondaryColor,
          fontChoice,
          stylePreset: kitAtStart.brandInfo.stylePreset,
          ...(apiKey ? { apiKey, aiProvider, aiModel } : {}),
        }),
        signal: AbortSignal.timeout(290_000),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(errBody.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Stream indisponível");

      const decoder = new TextDecoder();
      let html = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
      }
      html += decoder.decode();

      if (html.trim().length < 100) throw new Error("Resposta incompleta — tente novamente.");

      // Re-read ref to get the latest kit state (other assets may have finished while we were fetching)
      const withDone = patchAsset(kitRef.current!, asset.id, { status: "done", generatedCode: html });
      saveLaunchKit(withDone);
      setActiveLaunchKit(withDone);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      // Re-read ref here too so we don't overwrite other assets' results
      const withError = patchAsset(kitRef.current!, asset.id, { status: "error", error: msg });
      saveLaunchKit(withError);
      setActiveLaunchKit(withError);
    } finally {
      setLocalGenerating((prev) => { const s = new Set(prev); s.delete(asset.id); return s; });
    }
  };

  const handleGenerateAll = async (assets: StrategyAsset[]) => {
    for (const asset of assets) {
      const s = getInstance(asset.id)?.status ?? "pending";
      if (s === "pending" || s === "error") {
        await handleGenerateAsset(asset);
      }
    }
  };

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    deleteLaunchKit(kit.id);
    setActiveLaunchKit(null);
    navigate("lancamentos");
  };

  const handleBack = () => {
    setActiveLaunchKit(null);
    navigate("lancamentos");
  };

  /* circumference for circular progress */
  const radius = 14;
  const circ = 2 * Math.PI * radius;
  const dash = circ * (progressPct / 100);

  return (
    <div className="flex flex-col h-full bg-[#0c0c10]">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3 bg-[#0c0c10]/95 backdrop-blur border-b border-white/[0.05] shrink-0">
        <button
          onClick={handleBack}
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 flex items-center gap-2.5 min-w-0">
          <h1 className="text-[15px] font-semibold text-white truncate">{kit.brandInfo.productName}</h1>
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] font-medium">
            {STRATEGY_LABEL[kit.strategyId]}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* circular progress */}
          <div className="flex items-center gap-2">
            <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
              <circle cx="18" cy="18" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r={radius} fill="none"
                stroke={progressPct === 100 ? "#34d399" : "#a78bfa"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                style={{ transition: "stroke-dasharray 0.4s ease" }}
              />
            </svg>
            <div className="text-right">
              <p className="text-[13px] font-semibold text-white leading-none">{doneAssets}/{totalAssets}</p>
              <p className="text-[9px] text-white/30 mt-0.5">entregáveis</p>
            </div>
          </div>

          <div className="w-px h-6 bg-white/[0.06]" />

          <button
            onClick={handleDelete}
            onBlur={() => setConfirmDelete(false)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
              confirmDelete
                ? "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25"
                : "bg-white/[0.04] border border-white/[0.06] text-white/30 hover:text-red-400 hover:border-red-500/20"
            )}
          >
            <Trash2 className="w-3 h-3" />
            {confirmDelete ? "Confirmar?" : "Excluir"}
          </button>
        </div>
      </div>

      {/* ── Brief strip ── */}
      <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 border-b border-white/[0.04] overflow-x-auto no-scrollbar">
        <div className="shrink-0 flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border border-white/20" style={{ background: kit.brandInfo.primaryColor }} />
          <span className="text-[11px] text-white/30">{kit.brandInfo.primaryColor}</span>
        </div>
        <span className="shrink-0 text-white/10">·</span>
        {[
          { label: "Nicho", value: kit.brandInfo.niche },
          { label: "Público", value: kit.brandInfo.targetAudience },
          { label: "Transformação", value: kit.brandInfo.transformation },
        ].map(({ label, value }) => value ? (
          <div key={label} className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.05]">
            <span className="text-[9px] uppercase tracking-widest text-white/20 font-semibold">{label}</span>
            <span className="text-[11px] text-white/50 max-w-[160px] truncate">{value}</span>
          </div>
        ) : null)}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">

        {/* Brand Identity section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-widest text-white/30 font-semibold">Identidade Visual</span>
            {kit.brandIdentity?.status === "approved" && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-semibold uppercase tracking-wide">KV aprovada</span>
            )}
          </div>
          <BrandIdentityStudio
            kit={kit}
            onUpdate={(updated) => { saveLaunchKit(updated); setActiveLaunchKit(updated); }}
            apiKey={apiKey}
            aiProvider={aiProvider}
            aiModel={aiModel}
          />
        </section>

        {/* Pages section */}
        {pages.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-widest text-white/30 font-semibold">Páginas</span>
                <span className="px-1.5 py-0.5 rounded-full bg-white/[0.05] text-white/40 text-[10px] font-semibold">{pages.length}</span>
              </div>
              {hasPendingPages && (
                <button
                  onClick={() => handleGenerateAll(pages)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-medium hover:bg-purple-500/20 transition-colors cursor-pointer"
                >
                  <Zap className="w-3 h-3" /> Gerar todas
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {pages.map((asset) => (
                <PageCard
                  key={asset.id}
                  asset={asset}
                  instance={getInstance(asset.id)}
                  isLocallyGenerating={localGenerating.has(asset.id)}
                  onGenerate={handleGenerateAsset}
                  onView={(code, label) => openCodeInWorkspace(code, label)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Creatives section */}
        {criativos.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-widest text-white/30 font-semibold">Criativos</span>
                <span className="px-1.5 py-0.5 rounded-full bg-white/[0.05] text-white/40 text-[10px] font-semibold">{criativos.length}</span>
              </div>
              {hasPendingCreativos && (
                <button
                  onClick={() => handleGenerateAll(criativos)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-medium hover:bg-purple-500/20 transition-colors cursor-pointer"
                >
                  <Zap className="w-3 h-3" /> Gerar lote
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {criativos.map((asset) => (
                <CreativeCard
                  key={asset.id}
                  asset={asset}
                  instance={getInstance(asset.id)}
                  isLocallyGenerating={localGenerating.has(asset.id)}
                  onGenerate={handleGenerateAsset}
                  onView={(code, label) => openCodeInWorkspace(code, label)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Leads section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-widest text-white/30 font-semibold">Leads</span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-[#18181b] border border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                <Users className="w-4 h-4 text-white/30" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">0 leads capturados</p>
                <p className="text-[11px] text-white/30">Publique uma página de captura para começar</p>
              </div>
            </div>
            <button
              onClick={() => navigate("leads")}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 text-[11px] font-medium hover:text-white/70 hover:border-white/15 transition-colors cursor-pointer"
            >
              Ver Leads <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </section>

        {/* Email sequences section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-widest text-white/30 font-semibold">Emails</span>
          </div>
          <EmailSequencePanel brandInfo={kit.brandInfo} />
        </section>

        {/* Webhook integration section */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-widest text-white/30 font-semibold">Integração</span>
          </div>
          <div className="rounded-xl bg-[#18181b] border border-white/[0.06] p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 mt-0.5">
                <Link className="w-4 h-4 text-white/30" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-white">Webhook de leads</p>
                <p className="text-[11px] text-white/30 mt-0.5">
                  Cole a URL do webhook do ActiveCampaign, Mailchimp ou RD Station. Os formulários das páginas geradas vão enviar os leads automaticamente.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={webhookInput}
                onChange={(e) => { setWebhookInput(e.target.value); setWebhookSaved(false); }}
                placeholder="https://hooks.activehosted.com/proc.php?..."
                className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors"
              />
              <button
                onClick={() => {
                  setWebhookUrl(webhookInput.trim());
                  setWebhookSaved(true);
                  setTimeout(() => setWebhookSaved(false), 2500);
                }}
                disabled={webhookInput === webhookUrl}
                className={cn(
                  "px-3 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer shrink-0",
                  webhookSaved
                    ? "bg-emerald-500/15 border border-emerald-500/25 text-emerald-400"
                    : webhookInput !== webhookUrl
                    ? "bg-purple-600 hover:bg-purple-500 text-white"
                    : "bg-white/[0.04] text-white/20 cursor-not-allowed border border-white/[0.06]"
                )}
              >
                {webhookSaved ? "Salvo" : "Salvar"}
              </button>
            </div>
            {webhookUrl && (
              <p className="text-[10px] text-emerald-400/70 mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Webhook ativo — formulários das páginas vão capturar leads
              </p>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
