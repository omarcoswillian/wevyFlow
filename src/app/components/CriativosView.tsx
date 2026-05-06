"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles, Download, Trash2, Loader2, AlertCircle, Check, RefreshCw,
  ImageIcon, User, ImagePlus, X,
  Library, Wand2, Upload, Play, ChevronDown, MousePointer2,
} from "lucide-react";
import { useAppContext } from "../(app)/_context";

/* ─── Design service metadata ───────────────────────────── */
const DESIGN_SERVICE_LABELS: Record<string, string> = {
  "criativos":       "Criativos",
  "capas-modulos":   "Capas dos módulos",
  "banner-checkout": "Banner de Checkout",
  "pdf-ebook":       "PDF / E-book",
  "slide":           "Slide",
  "thumb-youtube":   "Thumb YouTube",
  "capa-youtube":    "Capa YouTube",
  "whatsapp-api":    "WhatsApp API",
  "banner-email":    "Banner e-mail",
  "capa-formulario": "Capa de formulário",
};
const DESIGN_SERVICE_KEYS = Object.keys(DESIGN_SERVICE_LABELS);

/* ─── Types ─────────────────────────────────────────────── */
interface SavedCriativo {
  id: string; format: string; url: string;
  headline: string | null; produto: string | null; created_at: string;
}
interface LibraryItem {
  id: string; url: string; name: string | null;
  format: string | null; tags: string[] | null; created_at: string;
}
interface SeedItem {
  path: string; name: string; client: string; format: string;
}
interface RefCard    { id: string; label: string; dataUrl: string | null; }
interface AvatarCard { id: string; label: string; name: string; dataUrl: string | null; }
interface GenResult  {
  id: string; label: string; status: "loading" | "done" | "error";
  dataUrl?: string; mimeType?: string; error?: string;
}
interface CardPos { x: number; y: number; }
interface Viewport { x: number; y: number; scale: number; }
interface CtxMenu  { x: number; y: number; cx: number; cy: number; }

/* ─── Constants ──────────────────────────────────────────── */
const DOT_SIZE = 24;

const GEN_FORMATS: { id: string; label: string; w: number; h: number }[] = [
  { id: "1:1",  label: "1:1",  w: 14,   h: 14    },
  { id: "4:5",  label: "4:5",  w: 14,   h: 17.5  },
  { id: "9:16", label: "9:16", w: 9.5,  h: 17.5  },
  { id: "16:9", label: "16:9", w: 20,   h: 11.25 },
];
const GALLERY_FORMATS: { id: string; platform: string; w: number; h: number }[] = [
  { id: "youtube-thumbnail", platform: "YouTube",     w: 16,   h: 9  },
  { id: "whatsapp",          platform: "WhatsApp",    w: 1,    h: 1  },
  { id: "banner-horizontal", platform: "Meta/Google", w: 1.91, h: 1  },
  { id: "feed-retrato",      platform: "Instagram",   w: 4,    h: 5  },
  { id: "feed-quadrado",     platform: "Inst/FB",     w: 1,    h: 1  },
  { id: "stories",           platform: "Stories",     w: 9,    h: 16 },
];

const REF_PORT_Y   = 17;
const GERAR_PORT_Y = 20;
const REF_WIDTH    = 228;

/* ─── Helpers ────────────────────────────────────────────── */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a"); a.href = dataUrl; a.download = filename; a.click();
}
async function downloadFromUrl(url: string, filename: string) {
  const res = await fetch(url); const blob = await res.blob();
  const obj = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = obj; a.download = filename; a.click();
  URL.revokeObjectURL(obj);
}
let _refCtr = 0; let _avCtr = 0;
function nextRefLabel() { _refCtr++; return `img${_refCtr}`; }
function nextAvLabel()  { _avCtr++;  return `avatar${_avCtr}`; }

/* ─── BrandCarousel ──────────────────────────────────────── */
function BrandCarousel({ label, count, items, onUseAsReference }: {
  label: string;
  count: number;
  items: { key: string; src: string; name: string }[];
  onUseAsReference?: (src: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 600, behavior: "smooth" });
  };

  return (
    <div className="px-8 py-4 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-semibold text-white/80">{label}</span>
          {count > 0
            ? <span className="text-[10px] text-white/25 font-mono">{count} criativo{count !== 1 ? "s" : ""}</span>
            : <span className="text-[10px] text-white/20 italic">em breve</span>
          }
        </div>
        {count > 3 && (
          <div className="flex gap-1">
            <button onClick={() => scroll(-1)} className="w-6 h-6 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/80 transition-all cursor-pointer">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M6.5 2L3.5 5L6.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button onClick={() => scroll(1)} className="w-6 h-6 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/80 transition-all cursor-pointer">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {items.map(item => (
            <div key={item.key} className="group shrink-0 w-[320px] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-purple-500/30 transition-all bg-white/[0.02] relative cursor-pointer" style={{ aspectRatio: "4/5" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 group-hover:opacity-100 bg-gradient-to-t from-black/90 via-black/40 transition-all flex flex-col gap-2">
                {item.name && <p className="text-[10px] text-white/70 truncate font-medium">{item.name}</p>}
                {onUseAsReference && (
                  <button
                    onClick={e => { e.stopPropagation(); onUseAsReference(item.src); }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-purple-600/80 backdrop-blur-sm text-white text-[11px] font-semibold cursor-pointer hover:bg-purple-500 transition-colors"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Usar como referencia
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────── */
export function CriativosView() {
  useAppContext();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const serviceType  = searchParams.get("tipo") ?? "criativos";
  const serviceLabel = DESIGN_SERVICE_LABELS[serviceType] ?? "Criativos";

  const [mainTab, setMainTab] = useState<"gerar" | "biblioteca" | "galeria">("gerar");

  /* viewport (pan + zoom) */
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 });
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  /* design gen state */
  const [references, setReferences] = useState<RefCard[]>([]);
  const [avatars,    setAvatars]    = useState<AvatarCard[]>([]);
  const [genPrompt,  setGenPrompt]  = useState("");
  const [genCount,   setGenCount]   = useState(1);
  const [genFormat,  setGenFormat]  = useState("9:16");
  const [genQuality, setGenQuality] = useState("2K");
  const [genResults, setGenResults] = useState<GenResult[]>([]);
  const [genRunning, setGenRunning] = useState(false);

  /* canvas */
  const [positions,  setPositions]  = useState<Record<string, CardPos>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ctxMenu,    setCtxMenu]    = useState<CtxMenu | null>(null);
  const positionsRef = useRef<Record<string, CardPos>>({});
  const dragRef      = useRef<{ id: string; startMX: number; startMY: number; startX: number; startY: number } | null>(null);
  const canvasRef    = useRef<HTMLDivElement>(null);
  const ctxMenuRef   = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef  = useRef({ mx: 0, my: 0, vx: 0, vy: 0 });

  /* gallery / library */
  const [gallery,             setGallery]             = useState<SavedCriativo[]>([]);
  const [activeGalleryFormat, setActiveGalleryFormat] = useState("all");
  const [library,             setLibrary]             = useState<LibraryItem[]>([]);
  const [libraryUploading,    setLibraryUploading]    = useState(false);
  const [libraryDragOver,     setLibraryDragOver]     = useState(false);
  const [seedItems,           setSeedItems]           = useState<SeedItem[]>([]);
  const libraryUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => { positionsRef.current = positions; }, [positions]);

  /* ── Wheel zoom (non-passive) ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        /* pinch / ctrl+scroll → zoom centrado no cursor */
        setViewport(v => {
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
        /* dois dedos scroll → pan */
        setViewport(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  /* ── Context menu: close on outside click (via ref check) ── */
  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: MouseEvent) => {
      if (ctxMenuRef.current?.contains(e.target as Node)) return;
      setCtxMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ctxMenu]);

  /* load gallery — scoped to current service type */
  const loadGallery = useCallback(async () => {
    const { data } = await supabase
      .from("criativos")
      .select("id,format,url,headline,produto,created_at")
      .or(`produto.eq.${serviceType},produto.is.null`)
      .order("created_at", { ascending: false });
    if (data) setGallery(data as SavedCriativo[]);
  }, [supabase, serviceType]);
  useEffect(() => { loadGallery(); }, [loadGallery]);

  /* load library */
  const loadLibrary = useCallback(async () => {
    const { data } = await supabase.from("creative_library").select("*").order("created_at", { ascending: false });
    if (data) setLibrary(data as LibraryItem[]);
  }, [supabase]);
  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  /* load seed manifest */
  useEffect(() => {
    fetch("/library-seed/manifest.json")
      .then(r => r.json())
      .then(setSeedItems)
      .catch(() => {});
  }, []);

  /* ── Canvas pan ── */
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-node]")) return;
    isPanningRef.current = true;
    panStartRef.current = {
      mx: e.clientX, my: e.clientY,
      vx: viewportRef.current.x, vy: viewportRef.current.y,
    };
    document.body.style.cursor = "grabbing";
    const onMove = (me: MouseEvent) => {
      if (!isPanningRef.current) return;
      const dx = me.clientX - panStartRef.current.mx;
      const dy = me.clientY - panStartRef.current.my;
      setViewport(v => ({ ...v, x: panStartRef.current.vx + dx, y: panStartRef.current.vy + dy }));
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

  /* ── Node drag (scale-aware) ── */
  const startDrag = useCallback((id: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button,input,textarea,select,a")) return;
    e.preventDefault();
    e.stopPropagation();
    const pos = positionsRef.current[id] || { x: 0, y: 0 };
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
      setPositions(prev => ({
        ...prev,
        [drag.id]: { x: drag.startX + dx, y: drag.startY + dy },
      }));
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

  /* ── Context menu ── */
  const handleCanvasContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const vp = viewportRef.current;
    const cx = (e.clientX - rect.left - vp.x) / vp.scale;
    const cy = (e.clientY - rect.top  - vp.y) / vp.scale;
    setCtxMenu({ x: e.clientX, y: e.clientY, cx, cy });
  };

  const spawnReference = (cx: number, cy: number) => {
    const label = nextRefLabel(); const id = crypto.randomUUID();
    setReferences(prev => [...prev, { id, label, dataUrl: null }]);
    setPositions(prev => ({ ...prev, [id]: { x: cx, y: cy } }));
    setCtxMenu(null);
  };
  const spawnAvatar = (cx: number, cy: number) => {
    const label = nextAvLabel(); const id = crypto.randomUUID();
    setAvatars(prev => [...prev, { id, label, name: "", dataUrl: null }]);
    setPositions(prev => ({ ...prev, [id]: { x: cx, y: cy } }));
    setCtxMenu(null);
  };
  const spawnGerar = (cx: number, cy: number) => {
    if (!positions["gerar"]) {
      setPositions(prev => ({ ...prev, gerar: { x: cx, y: cy } }));
    }
    setCtxMenu(null);
  };

  /* ── Use as reference (from biblioteca/galeria) ── */
  const useAsReference = useCallback(async (imageUrl: string) => {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const label = nextRefLabel();
    const id = crypto.randomUUID();
    setReferences(prev => [...prev, { id, label, dataUrl }]);
    setPositions(prev => ({ ...prev, [id]: { x: 120, y: 120 } }));
    setMainTab("gerar");
  }, []);

  /* ── References ── */
  const updateReference = (id: string, patch: Partial<RefCard>) =>
    setReferences(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  const removeReference = (id: string) => setReferences(prev => prev.filter(r => r.id !== id));

  /* ── Avatars ── */
  const updateAvatar = (id: string, patch: Partial<AvatarCard>) =>
    setAvatars(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  const removeAvatar = (id: string) => setAvatars(prev => prev.filter(a => a.id !== id));

  /* ── Generate ── */
  const handleDesignGenerate = async () => {
    if (!genPrompt.trim() || genRunning) return;
    setGenRunning(true);
    const count = Math.max(1, Math.min(8, genCount));
    const placeholders: GenResult[] = Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(), label: `img${Date.now()}-${i + 1}`, status: "loading" as const,
    }));
    setGenResults(placeholders);
    setPositions(prev => {
      const next = { ...prev };
      placeholders.forEach((p, i) => {
        const gPos = positionsRef.current["gerar"] || { x: 0, y: 0 };
        next[p.id] = { x: gPos.x + 430 + (i % 2) * 260, y: gPos.y + Math.floor(i / 2) * 290 };
      });
      return next;
    });
    const refImages = references.map(r => r.dataUrl).filter(Boolean) as string[];
    const avImages  = avatars.map(a => a.dataUrl).filter(Boolean) as string[];
    await Promise.all(placeholders.map(async (ph) => {
      try {
        const res = await fetch("/api/generate-design", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: genPrompt, referenceImages: refImages, avatarImages: avImages, format: genFormat }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao gerar.");
        const dataUrl = `data:${json.mimeType};base64,${json.b64}`;
        setGenResults(prev => prev.map(r => r.id === ph.id ? { ...r, status: "done", dataUrl, mimeType: json.mimeType } : r));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro.";
        setGenResults(prev => prev.map(r => r.id === ph.id ? { ...r, status: "error", error: msg } : r));
      }
    }));
    setGenRunning(false);
  };
  const removeResult = (id: string) => setGenResults(prev => prev.filter(r => r.id !== id));

  /* ── Library ── */
  async function uploadToLibrary(files: FileList | File[]) {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    setLibraryUploading(true);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const path = `${user.id}/library/lib-${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("ai-images").upload(path, file, { upsert: false });
      if (uploadErr) continue;
      const { data: { publicUrl } } = supabase.storage.from("ai-images").getPublicUrl(path);
      await supabase.from("creative_library").insert({ user_id: user.id, url: publicUrl, name: file.name.replace(/\.[^/.]+$/, ""), format: null, tags: [serviceType] });
    }
    await loadLibrary(); setLibraryUploading(false);
  }
  async function handleLibraryFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) await uploadToLibrary(e.target.files);
    if (libraryUploadRef.current) libraryUploadRef.current.value = "";
  }
  async function handleLibraryDrop(e: React.DragEvent) {
    e.preventDefault(); setLibraryDragOver(false);
    if (e.dataTransfer.files.length) await uploadToLibrary(e.dataTransfer.files);
  }
  async function handleDeleteGallery(c: SavedCriativo) {
    await supabase.from("criativos").delete().eq("id", c.id);
    try { const p = new URL(c.url).pathname.split("/ai-images/")[1]; if (p) await supabase.storage.from("ai-images").remove([p]); } catch { /* ok */ }
    setGallery(prev => prev.filter(x => x.id !== c.id));
  }

  const handleUsarResult = useCallback(async (result: GenResult) => {
    if (!result.dataUrl || result.status !== "done") return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    try {
      const fetchRes = await fetch(result.dataUrl);
      const blob = await fetchRes.blob();
      const ext = result.mimeType?.includes("png") ? "png" : "jpg";
      const path = `${user.id}/criativos/${serviceType}/${Date.now()}.${ext}`;
      const { error: storErr } = await supabase.storage.from("ai-images").upload(path, blob, { upsert: false });
      if (storErr) return;
      const { data: { publicUrl } } = supabase.storage.from("ai-images").getPublicUrl(path);
      await supabase.from("criativos").insert({ user_id: user.id, url: publicUrl, format: genFormat, headline: genPrompt.slice(0, 200) || null, produto: serviceType });
      await supabase.from("creative_library").insert({ user_id: user.id, url: publicUrl, name: `${serviceLabel} — ${new Date().toLocaleDateString("pt-BR")}`, format: genFormat, tags: [serviceType] });
      await loadGallery();
      await loadLibrary();
    } catch { /* silently fail */ }
  }, [supabase, serviceType, serviceLabel, genFormat, genPrompt, loadGallery, loadLibrary]);

  const filteredGallery = activeGalleryFormat === "all" ? gallery : gallery.filter(c => c.format === activeGalleryFormat);
  const hasGerarCard = !!positions["gerar"];
  const totalNodes = references.length + avatars.length + (hasGerarCard ? 1 : 0) + genResults.length;

  /* dot grid background moves with viewport */
  const dotSpacing = DOT_SIZE * viewport.scale;
  const dotGridStyle: React.CSSProperties = {
    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.065) 1px, transparent 1px)",
    backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
    backgroundPosition: `${viewport.x}px ${viewport.y}px`,
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">

      {/* ─── Tab bar ─────────────────────────── */}
      <div className="px-8 pt-6 pb-4 shrink-0 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-white/70 tracking-tight">{serviceLabel}</h2>
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
          {([
            { id: "biblioteca", label: "Biblioteca", icon: <Library className="w-3.5 h-3.5" />, badge: library.length },
            { id: "gerar",      label: "Gerar",      icon: <Wand2 className="w-3.5 h-3.5" /> },
            { id: "galeria",    label: "Gerados",    icon: <ImageIcon className="w-3.5 h-3.5" />, badge: gallery.length },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setMainTab(t.id as typeof mainTab)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                mainTab === t.id ? "bg-purple-600/20 text-purple-300" : "text-white/35 hover:text-white/60")}>
              {t.icon}{t.label}
              {"badge" in t && t.badge > 0 && (
                <span className="ml-0.5 min-w-[16px] h-4 rounded-full bg-white/[0.08] text-white/35 text-[9px] flex items-center justify-center px-1">{t.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════ TAB: GERAR ═══════════════ */}
      {mainTab === "gerar" && (
        <div className="flex-1 overflow-hidden min-h-0 relative">
          <style>{`
            @keyframes dash-flow    { to { stroke-dashoffset: -12; } }
            @keyframes glow-pulse   { 0%,100% { opacity:.5 } 50% { opacity:1 } }
            @keyframes light-travel { from { stroke-dashoffset: 0 } to { stroke-dashoffset: -600 } }
            @keyframes shimmer-idle { from { stroke-dashoffset: 0 } to { stroke-dashoffset: -400 } }
          `}</style>

          {/* ── Infinite canvas ── */}
          <div
            ref={canvasRef}
            style={{
              position: "absolute", inset: 0,
              cursor: isPanningRef.current ? "grabbing" : "default",
              ...dotGridStyle,
            }}
            onContextMenu={handleCanvasContextMenu}
            onMouseDown={handleCanvasMouseDown}
          >
            {/* ── World (transformed) ── */}
            <div style={{
              position: "absolute", left: 0, top: 0,
              transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`,
              transformOrigin: "0 0",
              willChange: "transform",
            }}>
              {/* Reference cards */}
              {references.map(ref => {
                const pos = positions[ref.id] || { x: 0, y: 0 };
                return (
                  <div key={ref.id} data-node="true" style={{
                    position: "absolute", left: pos.x, top: pos.y, width: REF_WIDTH,
                    zIndex: draggingId === ref.id ? 200 : 10,
                    cursor: draggingId === ref.id ? "grabbing" : "grab",
                  }} onMouseDown={e => startDrag(ref.id, e)}>
                    <NodeRefCard ref_={ref} onDelete={() => removeReference(ref.id)} onChange={p => updateReference(ref.id, p)} />
                    <div style={{
                      position: "absolute", right: -5, top: REF_PORT_Y - 5,
                      width: 10, height: 10, borderRadius: "50%",
                      background: "#4ade80", border: "2px solid #0d0d11",
                      boxShadow: genRunning ? "0 0 10px rgba(74,222,128,.9)" : "0 0 6px rgba(74,222,128,.4)",
                      zIndex: 3, transition: "box-shadow .3s",
                    }} />
                  </div>
                );
              })}

              {/* Avatar cards */}
              {avatars.map(av => {
                const pos = positions[av.id] || { x: 0, y: 0 };
                return (
                  <div key={av.id} data-node="true" style={{
                    position: "absolute", left: pos.x, top: pos.y, width: REF_WIDTH,
                    zIndex: draggingId === av.id ? 200 : 10,
                    cursor: draggingId === av.id ? "grabbing" : "grab",
                  }} onMouseDown={e => startDrag(av.id, e)}>
                    <NodeAvatarCard avatar={av} onChange={p => updateAvatar(av.id, p)} onDelete={() => removeAvatar(av.id)} />
                    <div style={{
                      position: "absolute", right: -5, top: REF_PORT_Y - 5,
                      width: 10, height: 10, borderRadius: "50%",
                      background: "#fbbf24", border: "2px solid #0d0d11",
                      boxShadow: genRunning ? "0 0 10px rgba(251,191,36,.9)" : "0 0 6px rgba(251,191,36,.4)",
                      zIndex: 3, transition: "box-shadow .3s",
                    }} />
                  </div>
                );
              })}

              {/* Gerar Imagem card */}
              {hasGerarCard && (() => {
                const pos = positions["gerar"]!;
                return (
                  <div data-node="true" style={{
                    position: "absolute", left: pos.x, top: pos.y, width: 380,
                    zIndex: draggingId === "gerar" ? 200 : 20,
                  }}>
                    <div style={{
                      position: "absolute", left: -5, top: GERAR_PORT_Y - 5,
                      width: 10, height: 10, borderRadius: "50%",
                      background: "#7c3aed", border: "2px solid #09090e",
                      boxShadow: genRunning ? "0 0 12px rgba(124,58,237,.95)" : "0 0 8px rgba(124,58,237,.6)",
                      zIndex: 3, transition: "box-shadow .3s",
                    }} />
                    <GerarImagemCard
                      prompt={genPrompt} onChange={setGenPrompt}
                      references={references} avatars={avatars}
                      genCount={genCount} setGenCount={setGenCount}
                      genFormat={genFormat} setGenFormat={setGenFormat}
                      genQuality={genQuality} setGenQuality={setGenQuality}
                      genRunning={genRunning} onGenerate={handleDesignGenerate}
                      isDragging={draggingId === "gerar"}
                      onDragStart={e => startDrag("gerar", e)}
                    />
                  </div>
                );
              })()}

              {/* Result cards */}
              {genResults.map(result => {
                const pos = positions[result.id] || { x: 800, y: 0 };
                return (
                  <div key={result.id} data-node="true" style={{
                    position: "absolute", left: pos.x, top: pos.y, width: REF_WIDTH,
                    zIndex: draggingId === result.id ? 200 : 10,
                    cursor: draggingId === result.id ? "grabbing" : "grab",
                  }} onMouseDown={e => startDrag(result.id, e)}>
                    <NodeResultCard result={result} onDelete={() => removeResult(result.id)} onUsar={() => handleUsarResult(result)} />
                  </div>
                );
              })}
            </div>

            {/* ── SVG connection lines — screen space (never clipped) ── */}
            {hasGerarCard && (
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6, overflow: "visible" }}>
                <defs>
                  {/* outer glow blur */}
                  <filter id="line-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  {/* strong glow for traveling light */}
                  <filter id="light-glow" x="-200%" y="-200%" width="500%" height="500%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                {(() => {
                  const sc   = viewport.scale;
                  const gPos = positions["gerar"]!;
                  const GERAR_W = 380;

                  /* helper: desenha uma linha roxa com luz viajando */
                  const PurpleLine = ({ id, x1, y1, x2, y2 }: { id: string; x1:number; y1:number; x2:number; y2:number }) => {
                    const cx = Math.max(50, Math.abs(x2 - x1) * 0.45);
                    const d  = `M ${x1} ${y1} C ${x1+cx} ${y1} ${x2-cx} ${y2} ${x2} ${y2}`;
                    return (
                      <g key={id}>
                        <path d={d} fill="none" stroke="rgba(139,92,246,.18)"
                          strokeWidth={genRunning ? 10 : 7} strokeLinecap="round"
                          filter="url(#line-glow)"
                          style={genRunning ? { animation: "glow-pulse 1.4s ease-in-out infinite" } : {}} />
                        <path d={d} fill="none" stroke="rgba(139,92,246,.45)"
                          strokeWidth={genRunning ? 2 : 1.5} strokeLinecap="round" />
                        <path d={d} fill="none" stroke="rgba(216,180,254,.95)"
                          strokeWidth={3} strokeLinecap="round"
                          strokeDasharray="28 500" filter="url(#light-glow)"
                          style={{ animation: genRunning ? "light-travel .9s linear infinite" : "shimmer-idle 3.5s linear infinite" }} />
                        <path d={d} fill="none" stroke="rgba(255,255,255,.85)"
                          strokeWidth={1.2} strokeLinecap="round"
                          strokeDasharray="10 518"
                          style={{ animation: genRunning ? "light-travel .9s linear infinite" : "shimmer-idle 3.5s linear infinite" }} />
                      </g>
                    );
                  };

                  return (
                    <>
                      {/* ref/avatar → gerar */}
                      {[
                        ...references.map(r => ({ id: r.id, pos: positions[r.id] })),
                        ...avatars.map(a   => ({ id: a.id, pos: positions[a.id] })),
                      ].map(({ id, pos }) => {
                        if (!pos) return null;
                        return <PurpleLine key={id} id={id}
                          x1={(pos.x + REF_WIDTH)    * sc + viewport.x}
                          y1={(pos.y + REF_PORT_Y)    * sc + viewport.y}
                          x2={gPos.x                  * sc + viewport.x}
                          y2={(gPos.y + GERAR_PORT_Y) * sc + viewport.y} />;
                      })}

                      {/* gerar → output cards */}
                      {genResults.map(r => {
                        const rPos = positions[r.id];
                        if (!rPos) return null;
                        return <PurpleLine key={`out-${r.id}`} id={`out-${r.id}`}
                          x1={(gPos.x + GERAR_W)    * sc + viewport.x}
                          y1={(gPos.y + GERAR_PORT_Y) * sc + viewport.y}
                          x2={rPos.x                  * sc + viewport.x}
                          y2={(rPos.y + REF_PORT_Y)   * sc + viewport.y} />;
                      })}
                    </>
                  );
                })()}
              </svg>
            )}

            {/* Empty state (screen-space, not world) */}
            {totalNodes === 0 && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", userSelect: "none" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: "rgba(255,255,255,.02)",
                    border: "1px solid rgba(255,255,255,.05)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 16px",
                  }}>
                    <MousePointer2 style={{ width: 24, height: 24, color: "rgba(255,255,255,.10)" }} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.20)", marginBottom: 6 }}>Canvas vazio</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,.12)" }}>Clique com o botão direito para adicionar nós</p>
                </div>
              </div>
            )}

            {/* Context menu (fixed, screen coords) */}
            {ctxMenu && (
              <div
                ref={ctxMenuRef}
                style={{
                  position: "fixed", left: ctxMenu.x, top: ctxMenu.y,
                  zIndex: 2000, minWidth: 210,
                  background: "#111117",
                  border: "1px solid rgba(255,255,255,.10)",
                  borderRadius: 12,
                  boxShadow: "0 16px 48px rgba(0,0,0,.65), 0 0 0 1px rgba(255,255,255,.04)",
                  overflow: "hidden", padding: "4px 0",
                }}
              >
                <div style={{ padding: "6px 12px 8px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                  <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", color: "rgba(255,255,255,.25)", textTransform: "uppercase" }}>
                    Adicionar nó
                  </span>
                </div>
                {[
                  { icon: <ImageIcon style={{ width: 14, height: 14 }} />, label: "Referência",        sub: "Imagem de referência",   color: "#4ade80", bg: "rgba(74,222,128,.10)",  onClick: () => spawnReference(ctxMenu.cx, ctxMenu.cy) },
                  { icon: <User      style={{ width: 14, height: 14 }} />, label: "Avatar",             sub: "Pessoa ou personagem",   color: "#fbbf24", bg: "rgba(251,191,36,.10)", onClick: () => spawnAvatar(ctxMenu.cx, ctxMenu.cy) },
                  { icon: <Wand2     style={{ width: 14, height: 14 }} />, label: "Output (Geração)",  sub: "Gerar imagem com IA",    color: "#a78bfa", bg: "rgba(124,58,237,.12)", onClick: () => spawnGerar(ctxMenu.cx, ctxMenu.cy), disabled: hasGerarCard },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.disabled ? undefined : item.onClick}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "8px 12px", textAlign: "left",
                      background: "none", border: "none",
                      cursor: item.disabled ? "not-allowed" : "pointer",
                      opacity: item.disabled ? 0.35 : 1,
                    }}
                    className={item.disabled ? "" : "hover:bg-white/[0.04] transition-colors"}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, background: item.bg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: item.color, flexShrink: 0,
                    }}>
                      {item.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.75)" }}>{item.label}</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.30)", marginTop: 2 }}>{item.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ TAB: BIBLIOTECA ═══════════════ */}
      {mainTab === "biblioteca" && (() => {
        const BRAND_ORDER = [
          "Luana Carolina",
          "Formagios",
        ];
        const seedByClient = seedItems.reduce<Record<string, SeedItem[]>>((acc, s) => {
          (acc[s.client] ??= []).push(s); return acc;
        }, {});
        const extraClients = Object.keys(seedByClient).filter(c => !BRAND_ORDER.includes(c));
        const allBrands = [...BRAND_ORDER, ...extraClients].filter(b => (seedByClient[b]?.length ?? 0) > 0);

        /* user uploads: show items tagged with this service OR legacy items (no service tag) */
        const filteredLibrary = library.filter(item => {
          const tags = item.tags ?? [];
          const hasServiceTag = tags.some(t => DESIGN_SERVICE_KEYS.includes(t));
          return !hasServiceTag || tags.includes(serviceType);
        });

        return (
          <div className="flex-1 overflow-y-auto pb-10 min-h-0">
            <input ref={libraryUploadRef} type="file" accept="image/*" multiple onChange={handleLibraryFileInput} className="hidden" />

            {/* Meus uploads row — scoped to current service */}
            {filteredLibrary.length > 0 && (
              <BrandCarousel
                label="Meus uploads"
                count={filteredLibrary.length}
                items={filteredLibrary.map(l => ({ key: l.id, src: l.url, name: l.name ?? "" }))}
                onUseAsReference={useAsReference}
              />
            )}

            {/* Upload drop row */}
            <div className="px-8 pt-4 pb-2">
              <div
                onDragOver={e => { e.preventDefault(); setLibraryDragOver(true); }}
                onDragLeave={() => setLibraryDragOver(false)}
                onDrop={handleLibraryDrop}
                onClick={() => libraryUploadRef.current?.click()}
                className={cn(
                  "w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border border-dashed transition-all cursor-pointer",
                  libraryDragOver ? "border-purple-500/50 bg-purple-500/[0.06]" : "border-white/[0.06] hover:border-purple-500/20 hover:bg-purple-500/[0.03]"
                )}
              >
                {libraryUploading
                  ? <><Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" /><p className="text-[11px] text-white/35">Salvando...</p></>
                  : <><Upload className="w-3.5 h-3.5 text-white/20" /><p className="text-[11px] text-white/25">Adicionar criativos — PNG, JPG, WEBP</p></>
                }
              </div>
            </div>

            {/* Brand carousels — só no serviço padrão "Criativos" */}
            {serviceType === "criativos" && allBrands.map(brand => {
              const items = seedByClient[brand] ?? [];
              return (
                <BrandCarousel
                  key={brand}
                  label={brand}
                  count={items.length}
                  items={items.map(s => ({ key: s.path, src: s.path, name: s.name }))}
                  onUseAsReference={useAsReference}
                />
              );
            })}
          </div>
        );
      })()}

      {/* ═══════════════ TAB: GALERIA ═══════════════ */}
      {mainTab === "galeria" && (
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-5">
          {gallery.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-white/15" />
              </div>
              <p className="text-[14px] font-semibold text-white/40 mb-1">Nenhum criativo gerado ainda</p>
              <p className="text-[12px] text-white/25">Gere e salve criativos na aba Gerar.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap pt-2">
                <span className="text-[12px] text-white/30 font-mono">{gallery.length} gerado{gallery.length !== 1 ? "s" : ""}</span>
                <div className="flex gap-1 flex-wrap">
                  {["all", ...GALLERY_FORMATS.filter(f => gallery.some(c => c.format === f.id)).map(f => f.id)].map(id => {
                    const f = GALLERY_FORMATS.find(x => x.id === id);
                    return (
                      <button key={id} onClick={() => setActiveGalleryFormat(id)}
                        className={cn("px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-all border",
                          activeGalleryFormat === id ? "bg-purple-600/20 border-purple-500/40 text-purple-300" : "border-white/[0.07] text-white/30 hover:text-white/60 hover:border-white/15")}>
                        {id === "all" ? `Todos (${gallery.length})` : f?.platform ?? id}
                      </button>
                    );
                  })}
                </div>
                <div className="flex-1" />
                <button onClick={loadGallery} className="p-1.5 rounded-lg text-white/20 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {filteredGallery.map(criativo => {
                  const f = GALLERY_FORMATS.find(x => x.id === criativo.format);
                  return (
                    <div key={criativo.id} className="group rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/15 transition-all bg-white/[0.02]">
                      <div className="relative overflow-hidden" style={{ aspectRatio: f ? String(f.w / f.h) : "16/9" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={criativo.url} alt="criativo" className="w-full h-full object-cover group-hover:scale-105 duration-500 transition-transform" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => useAsReference(criativo.url)} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-purple-600/80 backdrop-blur-sm text-white text-[11px] font-semibold cursor-pointer hover:bg-purple-500 transition-colors"><ImageIcon className="w-3.5 h-3.5" /> Usar como referencia</button>
                          <div className="flex gap-2">
                            <button onClick={() => downloadFromUrl(criativo.url, `criativo-${criativo.format}.png`)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm text-white/80 text-[11px] cursor-pointer hover:bg-white/20 transition-colors"><Download className="w-3.5 h-3.5" /> Baixar</button>
                            <button onClick={() => handleDeleteGallery(criativo)} className="p-1.5 rounded-lg bg-red-500/20 backdrop-blur-sm text-red-300 cursor-pointer hover:bg-red-500/40 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Node Cards ─────────────────────────────────────────── */

function NodeRefCard({ ref_, onDelete, onChange }: {
  ref_: RefCard; onDelete: () => void; onChange: (p: Partial<RefCard>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ background: "#0d0d11", border: "1px solid rgba(74,222,128,.15)", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <ImageIcon style={{ width: 12, height: 12, color: "rgba(74,222,128,.5)", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", color: "rgba(74,222,128,.5)", textTransform: "uppercase", flex: 1 }}>Referência</span>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(74,222,128,.3)" }}>{ref_.label}</span>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ marginLeft: 4, color: "rgba(255,255,255,.15)", cursor: "pointer", background: "none", border: "none", padding: 2, lineHeight: 1, display: "flex" }} className="hover:text-red-400 transition-colors">
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>
      {ref_.dataUrl ? (
        <div style={{ position: "relative" }} onMouseDown={e => e.stopPropagation()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ref_.dataUrl} alt="" style={{ width: "100%", display: "block", maxHeight: 280, objectFit: "cover" }} />
          <button onClick={() => onChange({ dataUrl: null })} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,.6)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.7)", cursor: "pointer" }}>
            <X style={{ width: 11, height: 11 }} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          onMouseDown={e => e.stopPropagation()}
          style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "36px 0", background: "none", border: "none", cursor: "pointer", color: "rgba(74,222,128,.35)" }}
          className="hover:bg-green-500/[0.04] transition-colors"
        >
          <div style={{ width: 40, height: 40, borderRadius: 10, border: "1.5px dashed rgba(74,222,128,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ImagePlus style={{ width: 18, height: 18 }} />
          </div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,.30)" }}>Upload de Imagem</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,.15)" }}>PNG, JPG, WEBP</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => {
        const f = e.target.files?.[0]; if (f) onChange({ dataUrl: await readFileAsDataUrl(f) });
        if (fileRef.current) fileRef.current.value = "";
      }} />
    </div>
  );
}

function NodeAvatarCard({ avatar, onChange, onDelete }: {
  avatar: AvatarCard; onChange: (p: Partial<AvatarCard>) => void; onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ background: "#0d0d11", border: "1px solid rgba(251,191,36,.15)", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <User style={{ width: 12, height: 12, color: "rgba(251,191,36,.5)", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", color: "rgba(251,191,36,.5)", textTransform: "uppercase", flex: 1 }}>Avatar</span>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(251,191,36,.3)" }}>{avatar.label}</span>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ marginLeft: 4, color: "rgba(255,255,255,.15)", cursor: "pointer", background: "none", border: "none", padding: 2, lineHeight: 1, display: "flex" }} className="hover:text-red-400 transition-colors">
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }} onMouseDown={e => e.stopPropagation()}>
        <input type="text" value={avatar.name} onChange={e => onChange({ name: e.target.value })} placeholder="Nome da pessoa"
          style={{ width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: "rgba(255,255,255,.7)", outline: "none", fontFamily: "inherit" }}
          className="placeholder-white/20" />
        {avatar.dataUrl ? (
          <div style={{ position: "relative", borderRadius: 8, overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatar.dataUrl} alt={avatar.name || "avatar"} style={{ width: "100%", height: 150, objectFit: "cover", objectPosition: "top", display: "block" }} />
            <button onClick={() => onChange({ dataUrl: null })} style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,.6)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.7)", cursor: "pointer" }}>
              <X style={{ width: 11, height: 11 }} />
            </button>
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()}
            style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: "20px 0", background: "none", border: "1px dashed rgba(251,191,36,.15)", borderRadius: 8, cursor: "pointer", color: "rgba(251,191,36,.35)", fontSize: 10 }}
            className="hover:border-amber-500/30 hover:text-amber-400/60 transition-colors">
            <User style={{ width: 16, height: 16 }} />
            <span>Foto do avatar</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => {
          const f = e.target.files?.[0]; if (f) onChange({ dataUrl: await readFileAsDataUrl(f) });
          if (fileRef.current) fileRef.current.value = "";
        }} />
      </div>
    </div>
  );
}

function GerarImagemCard({
  prompt, onChange, references, avatars,
  genCount, setGenCount, genFormat, setGenFormat, genQuality, setGenQuality,
  genRunning, onGenerate, isDragging, onDragStart,
}: {
  prompt: string; onChange: (v: string) => void;
  references: RefCard[]; avatars: AvatarCard[];
  genCount: number; setGenCount: (n: number) => void;
  genFormat: string; setGenFormat: (v: string) => void;
  genQuality: string; setGenQuality: (v: string) => void;
  genRunning: boolean; onGenerate: () => void;
  isDragging: boolean; onDragStart: (e: React.MouseEvent) => void;
}) {
  const canGenerate = prompt.trim().length > 0 && !genRunning;
  return (
    <div style={{ background: "#09090e", border: "1px solid rgba(124,58,237,.35)", borderRadius: 14, overflow: "visible", boxShadow: "0 0 0 1px rgba(124,58,237,.08), 0 0 40px rgba(124,58,237,.10), 0 8px 40px rgba(0,0,0,.5)", cursor: isDragging ? "grabbing" : "default" }}>
      <div onMouseDown={onDragStart} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid rgba(124,58,237,.15)", cursor: isDragging ? "grabbing" : "grab" }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(124,58,237,.15)", border: "1px solid rgba(124,58,237,.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Wand2 style={{ width: 12, height: 12, color: "#a78bfa" }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.7)", flex: 1 }}>Gerar Imagem</span>
      </div>
      <div onMouseDown={e => e.stopPropagation()} style={{ position: "relative", minHeight: 180 }}>
        <MentionTextarea value={prompt} onChange={onChange} references={references} avatars={avatars} />
        <button style={{ position: "absolute", bottom: 10, right: 12, width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,.25)" }}
          className="hover:text-purple-400 hover:border-purple-500/30 hover:bg-purple-500/[0.08] transition-colors">
          <Sparkles style={{ width: 13, height: 13 }} />
        </button>
      </div>
      <div onMouseDown={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderTop: "1px solid rgba(124,58,237,.12)" }}>
        <CountPill count={genCount} setCount={setGenCount} />
        <FormatSelector value={genFormat} onChange={setGenFormat} />
        <QualityToggle value={genQuality} onChange={setGenQuality} />
        <button onClick={onGenerate} disabled={!canGenerate}
          style={{ marginLeft: "auto", width: 36, height: 36, borderRadius: 10, background: canGenerate ? "rgba(124,58,237,.25)" : "rgba(255,255,255,.03)", border: canGenerate ? "1px solid rgba(124,58,237,.4)" : "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: canGenerate ? "pointer" : "not-allowed", color: canGenerate ? "#a78bfa" : "rgba(255,255,255,.12)", flexShrink: 0, transition: "all .15s" }}>
          {genRunning ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Play style={{ width: 13, height: 13, marginLeft: 1 }} />}
        </button>
      </div>
    </div>
  );
}

function NodeResultCard({ result, onDelete, onUsar }: { result: GenResult; onDelete: () => void; onUsar: () => void }) {
  return (
    <div style={{ background: "#0d0d11", border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <ImageIcon style={{ width: 12, height: 12, color: "rgba(167,139,250,.4)", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", color: "rgba(167,139,250,.4)", textTransform: "uppercase", flex: 1 }}>Output</span>
        <span style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,.20)" }}>{result.label.slice(0, 12)}</span>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ marginLeft: 4, color: "rgba(255,255,255,.12)", cursor: "pointer", background: "none", border: "none", padding: 2, lineHeight: 1, display: "flex" }} className="hover:text-red-400 transition-colors">
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>
      {result.status === "loading" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "32px 16px", minHeight: 140 }}>
          <div style={{ position: "relative", width: 32, height: 32 }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid rgba(124,58,237,.15)", borderTopColor: "#7c3aed", animation: "spin 1s linear infinite" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ImagePlus style={{ width: 12, height: 12, color: "rgba(124,58,237,.5)" }} />
            </div>
          </div>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,.2)" }}>Gerando...</p>
        </div>
      )}
      {result.status === "error" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "28px 16px", textAlign: "center" }}>
          <AlertCircle style={{ width: 18, height: 18, color: "rgba(248,113,113,.5)" }} />
          <p style={{ fontSize: 10, color: "rgba(248,113,113,.6)", lineHeight: 1.5 }}>{result.error}</p>
        </div>
      )}
      {result.status === "done" && result.dataUrl && (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.dataUrl} alt="" style={{ width: "100%", display: "block", maxHeight: 320, objectFit: "cover" }} />
          <div style={{ display: "flex", gap: 6, padding: 8 }} onMouseDown={e => e.stopPropagation()}>
            <button onClick={() => downloadDataUrl(result.dataUrl!, `design-${Date.now()}.png`)}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 0", borderRadius: 7, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", color: "rgba(255,255,255,.4)", fontSize: 10, cursor: "pointer" }}
              className="hover:text-white hover:bg-white/[0.07] transition-colors">
              <Download style={{ width: 12, height: 12 }} /> Baixar
            </button>
            <button onClick={onUsar} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 0", borderRadius: 7, background: "rgba(124,58,237,.08)", border: "1px solid rgba(124,58,237,.2)", color: "rgba(167,139,250,.7)", fontSize: 10, cursor: "pointer" }}
              className="hover:bg-purple-500/15 hover:text-purple-300 transition-colors">
              <Check style={{ width: 12, height: 12 }} /> Usar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MentionTextarea({ value, onChange, references, avatars }: {
  value: string; onChange: (v: string) => void;
  references: RefCard[]; avatars: AvatarCard[];
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionQuery, setMentionQuery] = useState<{ query: string; start: number } | null>(null);

  const allMentions = [
    ...references.map(r => ({ label: `@${r.label}`, type: "img"    as const, color: "#4ade80", bg: "rgba(74,222,128,.15)" })),
    ...avatars.map(a    => ({ label: `@${a.label}`, type: "avatar" as const, color: "#fbbf24", bg: "rgba(251,191,36,.15)" })),
  ];
  const suggestions = mentionQuery
    ? allMentions.filter(m => m.label.toLowerCase().includes(mentionQuery.query.toLowerCase()))
    : [];

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? 0;
    onChange(val);
    const textBefore = val.slice(0, cursor);
    const match = textBefore.match(/@([a-z0-9]*)$/i);
    if (match) {
      setMentionQuery({ query: match[1], start: match.index! });
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (label: string) => {
    if (!mentionQuery || !textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart ?? 0;
    const before  = value.slice(0, mentionQuery.start);
    const after   = value.slice(cursor);
    const newVal  = before + label + " " + after;
    onChange(newVal);
    setMentionQuery(null);
    setTimeout(() => {
      const pos = mentionQuery.start + label.length + 1;
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    }, 0);
  };

  const STYLE: React.CSSProperties = {
    position: "absolute", inset: 0, padding: "14px 16px",
    fontSize: 13, lineHeight: 1.65,
    fontFamily: "ui-monospace,'JetBrains Mono','Fira Code',monospace",
    whiteSpace: "pre-wrap", wordBreak: "break-word", overflowY: "auto",
  };
  const renderHighlighted = (text: string) =>
    text.split(/(@(?:img|avatar)\d+)/g).map((part, i) => {
      if (/^@img\d+$/.test(part)) {
        const exists = !!references[parseInt(part.replace("@img", "")) - 1];
        return <mark key={i} style={{ background: exists ? "rgba(34,197,94,.18)" : "rgba(255,255,255,.05)", color: exists ? "#4ade80" : "#6b7280", borderRadius: 3, padding: "0 2px" }}>{part}</mark>;
      }
      if (/^@avatar\d+$/.test(part)) {
        const exists = !!avatars[parseInt(part.replace("@avatar", "")) - 1];
        return <mark key={i} style={{ background: exists ? "rgba(251,191,36,.15)" : "rgba(255,255,255,.05)", color: exists ? "#fbbf24" : "#6b7280", borderRadius: 3, padding: "0 2px" }}>{part}</mark>;
      }
      // Regular text: same color as the textarea so only the marks stand out
      return <span key={i} style={{ color: "rgba(255,255,255,.72)" }}>{part}</span>;
    });

  return (
    <div style={{ position: "relative", minHeight: 180 }}>
      {/* Highlight layer — sits behind the textarea and renders @mention chips.
          The textarea is fully transparent so only this layer is visible. */}
      <div aria-hidden style={{ ...STYLE, pointerEvents: "none", userSelect: "none" }}>
        {renderHighlighted(value + "​")}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={e => {
          if (e.key === "Escape") setMentionQuery(null);
          if (e.key === "Enter" && suggestions.length > 0) {
            e.preventDefault();
            insertMention(suggestions[0].label);
          }
        }}
        placeholder={"Recrie a @img1 e substitua o homem\npelo @avatar1 e troque a frase por IA GEN"}
        style={{ ...STYLE, background: "transparent", color: "transparent", caretColor: "#a78bfa", resize: "none", outline: "none", border: "none", paddingBottom: 44 }}
        className="placeholder-white/[0.15]"
      />

      {/* @mention dropdown */}
      {mentionQuery && suggestions.length > 0 && (
        <div
          onMouseDown={e => e.preventDefault()}
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 12,
            background: "#131318",
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,.6)",
            overflow: "hidden",
            zIndex: 200,
            minWidth: 170,
          }}
        >
          <div style={{ padding: "5px 10px 6px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".10em", color: "rgba(255,255,255,.25)", textTransform: "uppercase" }}>Mencionar</span>
          </div>
          {suggestions.map(s => (
            <button
              key={s.label}
              onMouseDown={e => { e.preventDefault(); insertMention(s.label); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", padding: "7px 10px",
                background: "none", border: "none", cursor: "pointer", textAlign: "left",
              }}
              className="hover:bg-white/[0.05] transition-colors"
            >
              <div style={{ width: 22, height: 22, borderRadius: 6, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", color: s.color, flexShrink: 0 }}>
                {s.type === "img"
                  ? <ImageIcon style={{ width: 11, height: 11 }} />
                  : <User style={{ width: 11, height: 11 }} />
                }
              </div>
              <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: s.color }}>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CountPill({ count, setCount }: { count: number; setCount: (n: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 10, padding: "3px 4px" }}>
      <button onClick={() => setCount(Math.max(1, count - 1))}
        style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,.05)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,.5)", fontSize: 16, lineHeight: 1 }}
        className="hover:bg-white/[0.09] hover:text-white transition-colors">-</button>
      <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.65)", minWidth: 30, textAlign: "center" }}>x{count}</span>
      <button onClick={() => setCount(Math.min(8, count + 1))}
        style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,.05)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(255,255,255,.5)", fontSize: 16, lineHeight: 1 }}
        className="hover:bg-white/[0.09] hover:text-white transition-colors">+</button>
    </div>
  );
}

function FormatSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = GEN_FORMATS.find(f => f.id === value) ?? GEN_FORMATS[2];
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, cursor: "pointer" }}
        className="hover:border-white/15 transition-colors">
        <div style={{ width: current.w, height: current.h, border: "1.5px solid rgba(255,255,255,.45)", borderRadius: 2, flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,.5)", fontWeight: 600, whiteSpace: "nowrap" }}>{current.id}</span>
        <ChevronDown style={{ width: 9, height: 9, color: "rgba(255,255,255,.3)" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, background: "#111117", border: "1px solid rgba(255,255,255,.10)", borderRadius: 10, boxShadow: "0 12px 40px rgba(0,0,0,.6)", overflow: "hidden", padding: "4px 0", minWidth: 130, zIndex: 100 }}>
          {GEN_FORMATS.map(f => (
            <button key={f.id} onClick={() => { onChange(f.id); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "7px 12px", background: f.id === value ? "rgba(124,58,237,.12)" : "none", border: "none", cursor: "pointer" }}
              className="hover:bg-white/[0.04] transition-colors">
              <div style={{ width: f.w, height: f.h, border: f.id === value ? "1.5px solid rgba(167,139,250,.7)" : "1.5px solid rgba(255,255,255,.35)", borderRadius: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: f.id === value ? "#a78bfa" : "rgba(255,255,255,.55)" }}>{f.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QualityToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: 2, gap: 1 }}>
      {["2K", "4K"].map(q => (
        <button key={q} onClick={() => onChange(q)}
          style={{ padding: "4px 8px", borderRadius: 6, border: "none", background: value === q ? "rgba(124,58,237,.20)" : "none", color: value === q ? "#a78bfa" : "rgba(255,255,255,.35)", fontSize: 10, fontWeight: 700, cursor: "pointer", transition: "all .15s" }}>
          {q}
        </button>
      ))}
    </div>
  );
}
