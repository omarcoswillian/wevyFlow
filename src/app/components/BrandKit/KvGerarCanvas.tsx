"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Image as ImageIcon, User, Wand2, X, Library, Upload,
  Loader2, Play, ChevronDown, ChevronUp, MousePointer2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandDNA } from "@/app/api/generate-logo/shared";
import { BRIEFING_LIMITS } from "../../lib/launch-briefing";
import { KV_EXAMPLES } from "../../lib/kv-examples";

/* ─── Canvas geometry (mesmo padrão de CriativosView.tsx) ────── */
interface CardPos { x: number; y: number; }
interface Viewport { x: number; y: number; scale: number; }
interface CtxMenu { x: number; y: number; cx: number; cy: number; subMenu?: "referencia" | null; }

const DOT_SIZE = 24;
const NODE_WIDTH = 228;
const NODE_PORT_Y = 17;
const GROUP_WIDTH = 320;
const GERAR_WIDTH = 400;
const GERAR_PORT_Y = 20;

/* ─── Constantes de estilo (migradas de BrandWizard.tsx) ──────── */
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
  id: BrandDNA["visualStyle"]; label: string; desc: string; bg: string; text: string; border: string;
}[] = [
  { id: "dark-premium", label: "Dark Premium", desc: "Elegância e poder", bg: "#0a0a0a", text: "#ffffff", border: "#2a2a2a" },
  { id: "light-clean", label: "Light Clean", desc: "Clareza e sofisticação", bg: "#ffffff", text: "#111111", border: "#e5e7eb" },
  { id: "luxury", label: "Luxury", desc: "Ultra-refinamento", bg: "#f5f0e8", text: "#3d2c00", border: "#c9a96e" },
  { id: "tech", label: "Tech", desc: "Precisão digital", bg: "#0f172a", text: "#38bdf8", border: "#1e3a5f" },
  { id: "vibrant", label: "Vibrant", desc: "Energia e impacto", bg: "linear-gradient(135deg,#7c3aed,#ec4899)", text: "#ffffff", border: "#a855f7" },
  { id: "organic", label: "Organic", desc: "Humano e natural", bg: "#f2ede6", text: "#5c4a32", border: "#c4a882" },
];

const LOGO_TYPES: { id: BrandDNA["logoType"]; label: string; desc: string; preview: string }[] = [
  { id: "wordmark", label: "Wordmark", desc: "Apenas o nome estilizado", preview: "Abc" },
  { id: "lettermark", label: "Lettermark", desc: "Iniciais / monograma", preview: "AB" },
  { id: "combination", label: "Símbolo + Texto", desc: "Marca + nome", preview: "◆ Abc" },
  { id: "symbol", label: "Símbolo", desc: "Apenas a marca", preview: "◆" },
];

const PERSONALITY_AXES: { key: keyof BrandDNA["personality"]; left: string; right: string }[] = [
  { key: "moderno", left: "Clássico", right: "Moderno" },
  { key: "premium", left: "Popular", right: "Premium" },
  { key: "minimalista", left: "Arrojado", right: "Minimalista" },
  { key: "racional", left: "Emocional", right: "Racional" },
];

/** Posição-padrão de um nó antes de ser arrastado — pura, sem estado. Nós
 * Referência/Avatar são hidratados a cada render a partir dos arrays
 * persistidos (não há "spawn" que precise gravar uma posição inicial no
 * state), então a mesma fórmula tem que valer tanto pra desenhar o nó quanto
 * pro ponto de partida do drag — nunca um useEffect fazendo setState só pra
 * seedar isso. */
function defaultPosFor(id: string): CardPos {
  if (id === "gerar") return { x: 620, y: 40 };
  const refGroupMatch = /^refgrp-(\d+)$/.exec(id);
  if (refGroupMatch) return { x: 0, y: 40 + Number(refGroupMatch[1]) * 380 };
  const avMatch = /^av-(\d+)$/.exec(id);
  if (avMatch) return { x: 360, y: 40 + Number(avMatch[1]) * 260 };
  return { x: 0, y: 0 };
}

interface ReferenceGroupItem { index: number; dataUrl: string; label: string; }
interface ReferenceGroup { key: string; title: string; items: ReferenceGroupItem[]; }

/** Agrupa referenceImages/referenceImageSources num card por ORIGEM — todas
 * as imagens que vieram do mesmo exemplo da Biblioteca (ex: os 7 pedaços de
 * "A Carreira de Ouro") viram UM card de Referência só, com todos os itens
 * dentro, em vez de um nó solto por imagem espalhado pelo canvas (achado do
 * dono testando: "é tudo desse projeto, não faz sentido ficar separado" —
 * mesma UX de um CarouselNode mostrando todos os slides dentro de um card).
 * Upload avulso (sem correspondência num KV_EXAMPLES) vira um grupo de 1. */
function groupReferenceImages(referenceImages: string[], referenceImageSources: string[]): ReferenceGroup[] {
  const groups: ReferenceGroup[] = [];
  const byKey = new Map<string, ReferenceGroup>();
  referenceImages.forEach((dataUrl, index) => {
    const source = referenceImageSources[index] ?? "";
    const seedMatch = /^\/library-seed\/kv-examples\/([^/]+)\//.exec(source);
    let groupKey: string;
    let title: string;
    let label: string;
    if (seedMatch) {
      const exampleId = seedMatch[1];
      const example = KV_EXAMPLES.find((e) => e.id === exampleId);
      groupKey = `kv:${exampleId}`;
      title = example?.projectName ?? exampleId;
      label = example?.slides.find((s) => s.path === source)?.label ?? `Item ${index + 1}`;
    } else {
      groupKey = `single:${index}`;
      title = "Upload";
      label = "Referência";
    }
    let group = byKey.get(groupKey);
    if (!group) {
      group = { key: groupKey, title, items: [] };
      byKey.set(groupKey, group);
      groups.push(group);
    }
    group.items.push({ index, dataUrl, label });
  });
  return groups;
}

export interface KvGerarCanvasProps {
  brandName: string;
  /** Referências já persistidas em briefing.referenceImages — os nós
   * Referência são uma visualização 1:1 desse array, nunca uma lista local
   * paralela (ver plano: a rota /api/kv/batches lê direto desse campo, não
   * de qualquer estado de canvas). */
  referenceImages: string[];
  /** Paralelo 1:1 a referenceImages — usado só pra agrupar por origem (ver
   * groupReferenceImages), nunca exibido cru. */
  referenceImageSources: string[];
  onUploadReference: (file: File) => void;
  onRemoveReference: (index: number) => void;
  /** Remove vários índices de uma vez (um PATCH só) — apaga um card de
   * Referência inteiro (todas as imagens daquele grupo). */
  onRemoveReferences: (indices: number[]) => void;
  isUploadingReference?: boolean;
  onGoToLibrary?: () => void;
  /** Idem, espelha briefing.applicationPhotos — alimenta só o mockup de
   * aplicação (decisão do dono), nunca a arte principal da KV. */
  applicationPhotos: string[];
  onUploadApplicationPhoto: (file: File) => void;
  onRemoveApplicationPhoto: (index: number) => void;
  isUploadingApplicationPhoto?: boolean;
  onComplete: (dna: BrandDNA) => void;
  isGenerating: boolean;
}

export function KvGerarCanvas({
  brandName, referenceImages, referenceImageSources, onUploadReference, onRemoveReference,
  onRemoveReferences, isUploadingReference,
  onGoToLibrary, applicationPhotos, onUploadApplicationPhoto, onRemoveApplicationPhoto,
  isUploadingApplicationPhoto, onComplete, isGenerating,
}: KvGerarCanvasProps) {
  const referenceGroups = groupReferenceImages(referenceImages, referenceImageSources);
  /* viewport (pan + zoom) — idêntico ao padrão de CriativosView/CarrosselView */
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 });
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  const [positions, setPositions] = useState<Record<string, CardPos>>({});
  const positionsRef = useRef<Record<string, CardPos>>({});
  useEffect(() => { positionsRef.current = positions; }, [positions]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const dragRef = useRef<{ id: string; startMX: number; startMY: number; startX: number; startY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, vx: 0, vy: 0 });

  const refFileRef = useRef<HTMLInputElement>(null);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  /* ── Wheel zoom (non-passive) ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        setViewport((v) => {
          const factor = e.deltaY > 0 ? 0.92 : 1.08;
          const newScale = Math.max(0.15, Math.min(5, v.scale * factor));
          const rect = canvas.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const newX = mx - (mx - v.x) * (newScale / v.scale);
          const newY = my - (my - v.y) * (newScale / v.scale);
          return { x: newX, y: newY, scale: newScale };
        });
      } else {
        setViewport((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  /* ── Context menu: fecha em clique fora ── */
  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: MouseEvent) => {
      if (ctxMenuRef.current?.contains(e.target as Node)) return;
      setCtxMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ctxMenu]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-node]")) return;
    isPanningRef.current = true;
    panStartRef.current = { mx: e.clientX, my: e.clientY, vx: viewportRef.current.x, vy: viewportRef.current.y };
    document.body.style.cursor = "grabbing";
    const onMove = (me: MouseEvent) => {
      if (!isPanningRef.current) return;
      const dx = me.clientX - panStartRef.current.mx;
      const dy = me.clientY - panStartRef.current.my;
      setViewport((v) => ({ ...v, x: panStartRef.current.vx + dx, y: panStartRef.current.vy + dy }));
    };
    const onUp = () => {
      isPanningRef.current = false;
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const startDrag = useCallback((id: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button,input,textarea,select,a")) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = positionsRef.current[id] || defaultPosFor(id);
    dragRef.current = { id, startMX: e.clientX, startMY: e.clientY, startX: pos.x, startY: pos.y };
    setDraggingId(id);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    const onMove = (me: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const scale = viewportRef.current.scale;
      const dx = (me.clientX - drag.startMX) / scale;
      const dy = (me.clientY - drag.startMY) / scale;
      setPositions((prev) => ({ ...prev, [drag.id]: { x: drag.startX + dx, y: drag.startY + dy } }));
    };
    const onUp = () => {
      dragRef.current = null; setDraggingId(null);
      document.body.style.cursor = ""; document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const vp = viewportRef.current;
    const cx = (e.clientX - rect.left - vp.x) / vp.scale;
    const cy = (e.clientY - rect.top - vp.y) / vp.scale;
    setCtxMenu({ x: e.clientX, y: e.clientY, cx, cy, subMenu: null });
  };

  const spawnGerar = () => {
    if (!positions["gerar"]) {
      setPositions((prev) => ({ ...prev, gerar: { x: 620, y: 40 } }));
    }
    setCtxMenu(null);
  };

  const referenceLimitReached = referenceImages.length >= BRIEFING_LIMITS.maxReferenceImages;
  const avatarLimitReached = applicationPhotos.length >= BRIEFING_LIMITS.maxApplicationPhotos;
  const hasGerarNode = !!positions["gerar"];
  const totalNodes = referenceImages.length + applicationPhotos.length + (hasGerarNode ? 1 : 0);

  /* ── Estado do nó Gerar (BrandDNA parcial) ── */
  const [visualStyle, setVisualStyle] = useState<BrandDNA["visualStyle"]>("dark-premium");
  const [primaryColor, setPrimaryColor] = useState(COLOR_PRESETS[0].primary);
  const [logoType, setLogoType] = useState<BrandDNA["logoType"] | null>(null);
  const [variant, setVariant] = useState<BrandDNA["variant"]>("dark");
  const [tagline, setTagline] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [personality, setPersonality] = useState<BrandDNA["personality"]>({ moderno: 3, premium: 3, minimalista: 3, racional: 3 });
  const [voiceTones, setVoiceTones] = useState<string[]>([]);
  const [referenceBrands, setReferenceBrands] = useState("");

  const canGenerate = !!logoType;
  const handleGenerate = () => {
    if (!canGenerate || isGenerating) return;
    onComplete({
      name: brandName,
      niche: "",
      tagline,
      personality,
      voiceTones,
      visualStyle,
      primaryColor,
      logoType: logoType!,
      variant,
      referenceBrands: referenceBrands.trim() || undefined,
    });
  };

  const dotSpacing = DOT_SIZE * viewport.scale;
  const dotGridStyle: React.CSSProperties = {
    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.065) 1px, transparent 1px)",
    backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
    backgroundPosition: `${viewport.x}px ${viewport.y}px`,
  };

  return (
    <div className="flex-1 w-full overflow-hidden relative" style={{ minHeight: 560 }}>
      <style>{`
        @keyframes glow-pulse   { 0%,100% { opacity:.5 } 50% { opacity:1 } }
        @keyframes light-travel { from { stroke-dashoffset: 0 } to { stroke-dashoffset: -600 } }
        @keyframes shimmer-idle { from { stroke-dashoffset: 0 } to { stroke-dashoffset: -400 } }
      `}</style>

      <input
        ref={refFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadReference(f); e.target.value = ""; }}
      />
      <input
        ref={avatarFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadApplicationPhoto(f); e.target.value = ""; }}
      />

      <div
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, ...dotGridStyle }}
        onContextMenu={handleCanvasContextMenu}
        onMouseDown={handleCanvasMouseDown}
      >
        <div style={{
          position: "absolute", left: 0, top: 0,
          transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: "0 0", willChange: "transform",
        }}>
          {/* Cards de Referência — um por origem (grupo de imagens vindas do
              mesmo exemplo da Biblioteca ficam juntas num card só, não
              espalhadas). Chave de posição é ordinal (refgrp-i); a chave
              React é a origem (group.key), estável mesmo se a ordem mudar. */}
          {referenceGroups.map((group, i) => {
            const posKey = `refgrp-${i}`;
            const pos = positions[posKey] || defaultPosFor(posKey);
            return (
              <div key={group.key} data-node="true" style={{
                position: "absolute", left: pos.x, top: pos.y, width: GROUP_WIDTH,
                zIndex: draggingId === posKey ? 200 : 10, cursor: draggingId === posKey ? "grabbing" : "grab",
              }} onMouseDown={(e) => startDrag(posKey, e)}>
                <ReferenceGroupCard
                  group={group}
                  onRemoveItem={(index) => onRemoveReference(index)}
                  onRemoveAll={() => onRemoveReferences(group.items.map((it) => it.index))}
                />
                <div style={{
                  position: "absolute", right: -5, top: NODE_PORT_Y - 5, width: 10, height: 10, borderRadius: "50%",
                  background: "#4ade80", border: "2px solid #0d0d11",
                  boxShadow: isGenerating ? "0 0 10px rgba(74,222,128,.9)" : "0 0 6px rgba(74,222,128,.4)",
                  zIndex: 3, transition: "box-shadow .3s",
                }} />
              </div>
            );
          })}

          {/* Nós Avatar — espelho 1:1 de applicationPhotos (alimenta só o mockup) */}
          {applicationPhotos.map((dataUrl, i) => {
            const key = `av-${i}`;
            const pos = positions[key] || defaultPosFor(key);
            return (
              <div key={key} data-node="true" style={{
                position: "absolute", left: pos.x, top: pos.y, width: NODE_WIDTH,
                zIndex: draggingId === key ? 200 : 10, cursor: draggingId === key ? "grabbing" : "grab",
              }} onMouseDown={(e) => startDrag(key, e)}>
                <NodeAvatarCard dataUrl={dataUrl} onDelete={() => onRemoveApplicationPhoto(i)} />
                <div style={{
                  position: "absolute", right: -5, top: NODE_PORT_Y - 5, width: 10, height: 10, borderRadius: "50%",
                  background: "#fbbf24", border: "2px solid #0d0d11",
                  boxShadow: isGenerating ? "0 0 10px rgba(251,191,36,.9)" : "0 0 6px rgba(251,191,36,.4)",
                  zIndex: 3, transition: "box-shadow .3s",
                }} />
              </div>
            );
          })}

          {/* Nó Gerar */}
          {hasGerarNode && (() => {
            const pos = positions["gerar"]!;
            return (
              <div data-node="true" style={{ position: "absolute", left: pos.x, top: pos.y, width: GERAR_WIDTH, zIndex: draggingId === "gerar" ? 200 : 20 }}>
                <div style={{
                  position: "absolute", left: -5, top: GERAR_PORT_Y - 5, width: 10, height: 10, borderRadius: "50%",
                  background: "#7c3aed", border: "2px solid #09090e",
                  boxShadow: isGenerating ? "0 0 12px rgba(124,58,237,.95)" : "0 0 8px rgba(124,58,237,.6)",
                  zIndex: 3, transition: "box-shadow .3s",
                }} />
                <GerarKvCard
                  visualStyle={visualStyle} setVisualStyle={setVisualStyle}
                  primaryColor={primaryColor} setPrimaryColor={setPrimaryColor}
                  logoType={logoType} setLogoType={setLogoType}
                  variant={variant} setVariant={setVariant}
                  tagline={tagline} setTagline={setTagline}
                  advancedOpen={advancedOpen} setAdvancedOpen={setAdvancedOpen}
                  personality={personality} setPersonality={setPersonality}
                  voiceTones={voiceTones} setVoiceTones={setVoiceTones}
                  referenceBrands={referenceBrands} setReferenceBrands={setReferenceBrands}
                  referenceCount={referenceImages.length}
                  avatarCount={applicationPhotos.length}
                  canGenerate={canGenerate}
                  isGenerating={isGenerating}
                  onGenerate={handleGenerate}
                  isDragging={draggingId === "gerar"}
                  onDragStart={(e) => startDrag("gerar", e)}
                />
              </div>
            );
          })()}
        </div>

        {/* Linhas de conexão — puramente decorativas, screen space */}
        {hasGerarNode && (
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6, overflow: "visible" }}>
            <defs>
              <filter id="kv-line-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="kv-light-glow" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {(() => {
              const sc = viewport.scale;
              const gPos = positions["gerar"]!;
              const PurpleLine = ({ id, x1, y1, x2, y2 }: { id: string; x1: number; y1: number; x2: number; y2: number }) => {
                const cx = Math.max(50, Math.abs(x2 - x1) * 0.45);
                const d = `M ${x1} ${y1} C ${x1 + cx} ${y1} ${x2 - cx} ${y2} ${x2} ${y2}`;
                return (
                  <g key={id}>
                    <path d={d} fill="none" stroke="rgba(139,92,246,.18)" strokeWidth={isGenerating ? 10 : 7} strokeLinecap="round" filter="url(#kv-line-glow)" style={isGenerating ? { animation: "glow-pulse 1.4s ease-in-out infinite" } : {}} />
                    <path d={d} fill="none" stroke="rgba(139,92,246,.45)" strokeWidth={isGenerating ? 2 : 1.5} strokeLinecap="round" />
                    <path d={d} fill="none" stroke="rgba(216,180,254,.95)" strokeWidth={3} strokeLinecap="round" strokeDasharray="28 500" filter="url(#kv-light-glow)" style={{ animation: isGenerating ? "light-travel .9s linear infinite" : "shimmer-idle 3.5s linear infinite" }} />
                  </g>
                );
              };
              return (
                <>
                  {[
                    ...referenceGroups.map((_, i) => ({ id: `refgrp-${i}`, width: GROUP_WIDTH })),
                    ...applicationPhotos.map((_, i) => ({ id: `av-${i}`, width: NODE_WIDTH })),
                  ].map(({ id, width }) => {
                    const pos = positions[id] || defaultPosFor(id);
                    return (
                      <PurpleLine key={id} id={id}
                        x1={(pos.x + width) * sc + viewport.x} y1={(pos.y + NODE_PORT_Y) * sc + viewport.y}
                        x2={gPos.x * sc + viewport.x} y2={(gPos.y + GERAR_PORT_Y) * sc + viewport.y}
                      />
                    );
                  })}
                </>
              );
            })()}
          </svg>
        )}

        {totalNodes === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", userSelect: "none" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <MousePointer2 style={{ width: 24, height: 24, color: "rgba(255,255,255,.10)" }} />
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.20)", marginBottom: 6 }}>Canvas vazio</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,.12)" }}>Clique com o botão direito para adicionar nós</p>
            </div>
          </div>
        )}

        {/* Menu de contexto */}
        {ctxMenu && (
          <div ref={ctxMenuRef} style={{
            position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 2000, minWidth: 220,
            background: "#111117", border: "1px solid rgba(255,255,255,.10)", borderRadius: 12,
            boxShadow: "0 16px 48px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.04)",
            overflow: "hidden", padding: "4px 0",
          }}>
            <div style={{ padding: "6px 12px 8px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(255,255,255,.25)", textTransform: "uppercase" }}>
                {ctxMenu.subMenu === "referencia" ? "Referência" : "Adicionar nó"}
              </span>
            </div>

            {ctxMenu.subMenu === "referencia" ? (
              <>
                <CtxMenuItem
                  icon={<Upload style={{ width: 14, height: 14 }} />} color="#4ade80" bg="rgba(74,222,128,.10)"
                  label="Enviar arquivo" sub={referenceLimitReached ? `Limite de ${BRIEFING_LIMITS.maxReferenceImages} atingido` : "JPG, PNG ou WEBP"}
                  disabled={referenceLimitReached || isUploadingReference}
                  onClick={() => { refFileRef.current?.click(); setCtxMenu(null); }}
                />
                {onGoToLibrary && (
                  <CtxMenuItem
                    icon={<Library style={{ width: 14, height: 14 }} />} color="#4ade80" bg="rgba(74,222,128,.10)"
                    label="Escolher da Biblioteca" sub="Exemplos prontos de KV"
                    onClick={() => { onGoToLibrary(); setCtxMenu(null); }}
                  />
                )}
              </>
            ) : (
              <>
                <CtxMenuItem
                  icon={<ImageIcon style={{ width: 14, height: 14 }} />} color="#4ade80" bg="rgba(74,222,128,.10)"
                  label="Referência" sub="Da biblioteca ou upload"
                  onClick={() => setCtxMenu((m) => (m ? { ...m, subMenu: "referencia" } : m))}
                />
                <CtxMenuItem
                  icon={<User style={{ width: 14, height: 14 }} />} color="#fbbf24" bg="rgba(251,191,36,.10)"
                  label="Avatar" sub="Foto pro mockup de aplicação"
                  disabled={avatarLimitReached || isUploadingApplicationPhoto}
                  onClick={() => { avatarFileRef.current?.click(); setCtxMenu(null); }}
                />
                <CtxMenuItem
                  icon={<Wand2 style={{ width: 14, height: 14 }} />} color="#a78bfa" bg="rgba(124,58,237,.12)"
                  label="Gerar" sub="Gerar identidade com IA"
                  disabled={hasGerarNode}
                  onClick={spawnGerar}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CtxMenuItem({ icon, color, bg, label, sub, disabled, onClick }: {
  icon: React.ReactNode; color: string; bg: string; label: string; sub: string; disabled?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", textAlign: "left",
        background: "none", border: "none", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.35 : 1,
      }}
      className={disabled ? "" : "hover:bg-white/[0.04] transition-colors"}
    >
      <div style={{ width: 32, height: 32, borderRadius: 9, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.75)" }}>{label}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,.30)", marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}

/* ─── Node cards ─────────────────────────────────────────── */

function ReferenceGroupCard({ group, onRemoveItem, onRemoveAll }: {
  group: ReferenceGroup;
  onRemoveItem: (index: number) => void;
  onRemoveAll: () => void;
}) {
  const cols = group.items.length <= 1 ? 1 : group.items.length <= 4 ? 2 : 3;
  return (
    <div style={{ background: "#0d0d11", border: "1px solid rgba(74,222,128,.15)", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <ImageIcon style={{ width: 12, height: 12, color: "rgba(74,222,128,.5)", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".05em", color: "rgba(74,222,128,.6)", textTransform: "uppercase", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {group.title}
        </span>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(74,222,128,.3)" }}>{group.items.length}</span>
        <button onClick={(e) => { e.stopPropagation(); onRemoveAll(); }} title="Remover todas as imagens deste card" style={{ marginLeft: 4, color: "rgba(255,255,255,.15)", cursor: "pointer", background: "none", border: "none", padding: 2, lineHeight: 1, display: "flex" }} className="hover:text-red-400 transition-colors">
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 4, padding: 8 }}
      >
        {group.items.map((item) => (
          <div key={item.index} className="group/thumb" style={{ position: "relative", borderRadius: 6, overflow: "hidden", aspectRatio: "1", background: "rgba(255,255,255,.02)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.dataUrl} alt={item.label} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <button
              onClick={() => onRemoveItem(item.index)}
              title={`Remover "${item.label}"`}
              style={{ position: "absolute", top: 2, right: 2, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,.65)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.75)", cursor: "pointer", opacity: 0 }}
              className="group-hover/thumb:opacity-100 transition-opacity"
            >
              <X style={{ width: 9, height: 9 }} />
            </button>
            <span style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "2px 4px", fontSize: 8, color: "rgba(255,255,255,.55)", background: "linear-gradient(transparent, rgba(0,0,0,.75))", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NodeAvatarCard({ dataUrl, onDelete }: { dataUrl: string; onDelete: () => void }) {
  return (
    <div style={{ background: "#0d0d11", border: "1px solid rgba(251,191,36,.15)", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <User style={{ width: 12, height: 12, color: "rgba(251,191,36,.5)", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", color: "rgba(251,191,36,.5)", textTransform: "uppercase", flex: 1 }}>Avatar</span>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ marginLeft: 4, color: "rgba(255,255,255,.15)", cursor: "pointer", background: "none", border: "none", padding: 2, lineHeight: 1, display: "flex" }} className="hover:text-red-400 transition-colors">
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>
      <div style={{ position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="Avatar" style={{ width: "100%", height: 150, objectFit: "cover", objectPosition: "top", display: "block" }} />
      </div>
      <p style={{ fontSize: 9, color: "rgba(251,191,36,.35)", padding: "6px 10px 8px" }}>Vira o mockup de aplicação — não entra na arte principal.</p>
    </div>
  );
}

function GerarKvCard({
  visualStyle, setVisualStyle, primaryColor, setPrimaryColor, logoType, setLogoType,
  variant, setVariant, tagline, setTagline, advancedOpen, setAdvancedOpen,
  personality, setPersonality, voiceTones, setVoiceTones, referenceBrands, setReferenceBrands,
  referenceCount, avatarCount, canGenerate, isGenerating, onGenerate, isDragging, onDragStart,
}: {
  visualStyle: BrandDNA["visualStyle"]; setVisualStyle: (v: BrandDNA["visualStyle"]) => void;
  primaryColor: string; setPrimaryColor: (v: string) => void;
  logoType: BrandDNA["logoType"] | null; setLogoType: (v: BrandDNA["logoType"]) => void;
  variant: BrandDNA["variant"]; setVariant: (v: BrandDNA["variant"]) => void;
  tagline: string; setTagline: (v: string) => void;
  advancedOpen: boolean; setAdvancedOpen: (v: boolean) => void;
  personality: BrandDNA["personality"]; setPersonality: (v: BrandDNA["personality"]) => void;
  voiceTones: string[]; setVoiceTones: (v: string[]) => void;
  referenceBrands: string; setReferenceBrands: (v: string) => void;
  referenceCount: number; avatarCount: number;
  canGenerate: boolean; isGenerating: boolean; onGenerate: () => void;
  isDragging: boolean; onDragStart: (e: React.MouseEvent) => void;
}) {
  const toggleTone = (tone: string) => {
    if (voiceTones.includes(tone)) { setVoiceTones(voiceTones.filter((t) => t !== tone)); return; }
    if (voiceTones.length >= 3) return;
    setVoiceTones([...voiceTones, tone]);
  };
  const visualStyleLabel = VISUAL_STYLES.find((s) => s.id === visualStyle)?.label ?? "—";
  const logoTypeLabel = LOGO_TYPES.find((l) => l.id === logoType)?.label ?? "—";

  return (
    <div
      style={{ background: "#09090e", border: "1px solid rgba(124,58,237,.35)", borderRadius: 14, boxShadow: "0 0 0 1px rgba(124,58,237,.08), 0 0 40px rgba(124,58,237,.10), 0 8px 40px rgba(0,0,0,.5)", cursor: isDragging ? "grabbing" : "default" }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div onMouseDown={onDragStart} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid rgba(124,58,237,.15)", cursor: isDragging ? "grabbing" : "grab" }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(124,58,237,.15)", border: "1px solid rgba(124,58,237,.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Wand2 style={{ width: 12, height: 12, color: "#a78bfa" }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.7)", flex: 1 }}>Gerar KV</span>
      </div>

      <div className="p-4 space-y-4 max-h-[560px] overflow-y-auto">
        {/* Prompt livre */}
        <div>
          <p className="text-[11px] text-white/30 mb-1.5">Instruções extras (opcional)</p>
          <textarea
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder='Ex: "quero algo mais dourado, com textura de papel"'
            rows={2}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-white/80 placeholder:text-white/20 outline-none focus:border-white/[0.14] transition-colors resize-none"
          />
        </div>

        {/* Estética */}
        <div>
          <p className="text-[11px] text-white/30 mb-2">Qual é a estética da sua marca?</p>
          <div className="grid grid-cols-3 gap-2">
            {VISUAL_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => setVisualStyle(style.id)}
                className={cn(
                  "relative rounded-xl overflow-hidden border-2 transition-all h-16 text-left",
                  visualStyle === style.id ? "border-purple-500/60 ring-1 ring-purple-500/30" : "border-white/[0.06] hover:border-white/[0.14]"
                )}
                style={{ background: style.bg, borderColor: visualStyle === style.id ? undefined : style.border }}
              >
                <div className="absolute inset-0 p-2 flex flex-col justify-end">
                  <span className="text-[9px] font-semibold block leading-tight" style={{ color: style.text }}>{style.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cor principal */}
        <div>
          <p className="text-[11px] text-white/30 mb-2">Cor principal</p>
          <div className="flex items-center gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.primary}
                onClick={() => setPrimaryColor(preset.primary)}
                className={cn("w-6 h-6 rounded-full border-2 transition-all", primaryColor === preset.primary ? "border-white/60 scale-110" : "border-white/[0.08] hover:scale-105")}
                style={{ background: preset.primary }}
              />
            ))}
            <label className="relative cursor-pointer">
              <div className="w-6 h-6 rounded-full border-2 border-white/[0.08] overflow-hidden hover:scale-105 transition-all" style={{ background: primaryColor }} />
              <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
            </label>
          </div>
        </div>

        {/* Tipo de logo */}
        <div>
          <p className="text-[11px] text-white/30 mb-2">Tipo de logo</p>
          <div className="grid grid-cols-2 gap-2">
            {LOGO_TYPES.map((lt) => (
              <button
                key={lt.id}
                onClick={() => setLogoType(lt.id)}
                className={cn("flex flex-col items-start gap-0.5 p-2.5 rounded-xl border transition-all", logoType === lt.id ? "bg-purple-500/20 border-purple-500/40" : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.14]")}
              >
                <span className={cn("text-[13px] font-bold tracking-tight", logoType === lt.id ? "text-purple-300" : "text-white/40")}>{lt.preview}</span>
                <span className={cn("text-[10px] font-semibold", logoType === lt.id ? "text-purple-200" : "text-white/60")}>{lt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Avançado (recolhido) */}
        <div className="border-t border-white/[0.06] pt-3">
          <button onClick={() => setAdvancedOpen(!advancedOpen)} className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/50 transition-colors cursor-pointer">
            {advancedOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Avançado
          </button>
          {advancedOpen && (
            <div className="mt-3 space-y-4">
              <div className="space-y-2.5">
                {PERSONALITY_AXES.map(({ key, left, right }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-[10px] text-white/30 w-14 text-right shrink-0">{left}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setPersonality({ ...personality, [key]: n })}
                          className={cn("w-6 h-6 rounded text-[10px] font-medium border transition-all", personality[key] === n ? "bg-purple-500/20 border-purple-500/40 text-purple-300" : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:border-white/[0.14] hover:text-white/50")}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-white/30 w-14 shrink-0">{right}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[10px] text-white/30 mb-1.5">Tons de voz (max. 3)</p>
                <div className="flex flex-wrap gap-1.5">
                  {VOICE_TONES.map((tone) => (
                    <button
                      key={tone}
                      onClick={() => toggleTone(tone)}
                      className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all", voiceTones.includes(tone) ? "bg-purple-500/20 border-purple-500/40 text-purple-300" : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:border-white/[0.14] hover:text-white/50")}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-white/30 mb-1.5">Marcas que você admira</p>
                <input
                  value={referenceBrands}
                  onChange={(e) => setReferenceBrands(e.target.value)}
                  placeholder="Ex: Nike, Apple, Headspace"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white/80 placeholder:text-white/20 outline-none focus:border-white/[0.14] transition-colors"
                />
              </div>
              <div>
                <p className="text-[10px] text-white/30 mb-1.5">Fundo da identidade</p>
                <div className="flex gap-2">
                  {(["dark", "light"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVariant(v)}
                      className={cn("flex-1 py-1.5 rounded-lg text-[11px] font-medium border transition-all", variant === v ? "bg-purple-500/20 border-purple-500/40 text-purple-300" : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:border-white/[0.14] hover:text-white/50")}
                    >
                      {v === "dark" ? "Fundo escuro" : "Fundo claro"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Revisão */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1">Revisão</p>
          <SummaryRow label="Estética" value={visualStyleLabel} />
          <SummaryRow label="Cor principal" value={primaryColor} swatch={primaryColor} />
          <SummaryRow label="Tipo de logo" value={logoTypeLabel} />
          <SummaryRow label="Referências" value={`${referenceCount} imagem${referenceCount === 1 ? "" : "ns"}`} />
          <SummaryRow label="Avatares" value={`${avatarCount} foto${avatarCount === 1 ? "" : "s"}`} />
        </div>
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-all",
            canGenerate && !isGenerating ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-400 hover:to-pink-400" : "bg-white/[0.03] border border-white/[0.06] text-white/20 cursor-not-allowed"
          )}
        >
          {isGenerating ? (<><Loader2 size={14} className="animate-spin" /> Gerando...</>) : (<><Play size={13} /> Gerar</>)}
        </button>
        {!logoType && <p className="text-center text-[10px] text-white/20 mt-2">Escolha um tipo de logo pra gerar.</p>}
      </div>
    </div>
  );
}

function SummaryRow({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/30 w-20 shrink-0">{label}</span>
      {swatch && <div className="w-3 h-3 rounded-full border border-white/[0.1] shrink-0" style={{ background: swatch }} />}
      <span className="text-[11px] text-white/60 truncate">{value}</span>
    </div>
  );
}
