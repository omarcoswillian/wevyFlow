"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Plus, Loader2, Trash2, Download, Pencil, X,
  GalleryHorizontalEnd, ChevronLeft, ChevronRight, ImagePlus,
  Library, Wand2, ImageIcon, Upload, MousePointer2, User,
} from "lucide-react";
import { CanvasEditor } from "./CanvasEditor";
import type { CanvasTemplate } from "../lib/canvas-templates";

/* ─── Types ─────────────────────────────────────────────── */
interface Carousel {
  id: string; name: string; format: string;
  created_at: string; updated_at: string;
}
interface Slide {
  id: string; carousel_id: string; position: number;
  fabric_json: Record<string, unknown> | null;
  thumbnail_url: string | null;
  /** Client-only, not persisted: set when this slide was just bootstrapped
   *  from a reference example carousel — applied as the background the
   *  first time the slide is opened for edit. */
  _seedUrl?: string;
  /** Client-only source image for retrying a slide created by the
   *  reference-carousel batch flow. */
  _sourceSlideUrl?: string;
  /** Client-only position metadata for reusing the batch-level analysis
   *  when this slide is regenerated. */
  _sourceSlideNumber?: number;
  _sourceSlideTotal?: number;
}
interface LibraryItem {
  id: string; url: string; name: string | null; created_at: string;
}
interface SeedCarousel {
  id: string; client: string; name: string; format: string; slides: string[];
}
/** A carousel card on the infinite canvas. Always backed by a real DB row —
 *  carousels only ever come into existence already populated by a Gerar
 *  (Output) generation, never as a blank manual form. */
interface CarouselNode {
  id: string;
  carousel: Carousel;
  slides: Slide[];
  /** Client-only snapshot of the prompt that created a batch carousel. */
  _batchPrompt?: string;
  /** Client-only shared visual-system analysis produced once for a batch. */
  _carouselAnalysis?: string;
}
/** A Referência connector node — the single image an AI-generated slide is
 *  never allowed to visually stray from (EDIT MODE in /api/generate-design
 *  changes only what the prompt asks and leaves the rest pixel-identical). */
interface RefNode { id: string; dataUrl: string | null; }
interface AvatarNode { id: string; name: string; dataUrl: string | null; }
/** The AI generation node. Without a reference carousel it mirrors
 *  CriativosView's single-image flow; with one selected, the same prompt
 *  generates a complete new carousel from its slides. */
interface OutputNode {
  id: string;
  /** System-set once a generation lands, purely so the output connector line
   *  and the "Gerando..." placeholder know which card to point at. Never
   *  user-selected — there is no destination picker; every Gerar card always
   *  produces a brand-new result the first time, then (for the single-image
   *  flow only) keeps filling that same result's empty slides on repeat
   *  generations from that same card, exactly as before. */
  targetCarouselNodeId?: string;
  newFormat: string;
  prompt: string;
  generating: boolean;
  error: string | null;
}
interface CardPos { x: number; y: number; }
interface Viewport { x: number; y: number; scale: number; }
interface CtxMenu { x: number; y: number; cx: number; cy: number; }

const LIBRARY_TAG = "carrossel";
const DOT_SIZE = 24;
const NODE_WIDTH = 480;
const CONNECTOR_WIDTH = 228;
const CONNECTOR_PORT_Y = 17;
const CAROUSEL_PORT_Y = 20;
const OUTPUT_WIDTH = 340;
const OUTPUT_REF_PORT_Y = 22;
const OUTPUT_AVATAR_PORT_Y = 40;
const OUTPUT_CAROUSEL_REF_PORT_Y = 58;
const OUTPUT_OUT_PORT_Y = 22;

const FORMATS: { id: string; label: string; w: number; h: number; ratio: string }[] = [
  { id: "1:1",  label: "1080×1080",  w: 1080, h: 1080, ratio: "1/1" },
  { id: "4:5",  label: "1080×1350",  w: 1080, h: 1350, ratio: "4/5" },
  { id: "9:16", label: "1080×1920",  w: 1080, h: 1920, ratio: "9/16" },
];
const MIN_SLIDES = 1;
const MAX_SLIDES = 10;
const STORAGE_BUCKET = "ai-images";
const REPLACEMENT_FAILED_MESSAGE = "Não foi possível trocar a pessoa com segurança — imagem original mantida.";

function formatOf(id: string) {
  return FORMATS.find(f => f.id === id) ?? FORMATS[0];
}
let _nodeCtr = 0;
function nextNodeId() { _nodeCtr++; return `node-${Date.now()}-${_nodeCtr}`; }

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
async function imageUrlToDataUrl(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error("Falha ao carregar a imagem de referência.");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
async function downloadSlidesZip(urls: string[], baseName: string): Promise<number> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  let failed = 0;
  await Promise.all(urls.map(async (url, i) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (blob.size === 0) throw new Error("empty file");
      const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
      zip.file(`${baseName}-slide-${i + 1}.${ext}`, blob);
    } catch { failed++; }
  }));
  const blob = await zip.generateAsync({ type: "blob" });
  const obj = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = obj; a.download = `${baseName}.zip`; a.click();
  URL.revokeObjectURL(obj);
  return failed;
}

/* ─── Main component ─────────────────────────────────────── */
export function CarrosselView() {
  const supabase = createClient();

  const [mainTab, setMainTab] = useState<"biblioteca" | "gerar" | "gerados">("gerar");

  /* viewport (pan + zoom) */
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 });
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  /* canvas nodes */
  const [nodes, setNodes] = useState<CarouselNode[]>([]);
  const [refNodes, setRefNodes] = useState<RefNode[]>([]);
  const [avatarNodes, setAvatarNodes] = useState<AvatarNode[]>([]);
  const [outputNodes, setOutputNodes] = useState<OutputNode[]>([]);
  const [positions, setPositions] = useState<Record<string, CardPos>>({});
  const positionsRef = useRef<Record<string, CardPos>>({});
  useEffect(() => { positionsRef.current = positions; }, [positions]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; startMX: number; startMY: number; startX: number; startY: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ mx: 0, my: 0, vx: 0, vy: 0 });

  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);

  const [carousels, setCarousels]     = useState<Carousel[]>([]);
  const [covers, setCovers]           = useState<Record<string, string>>({});
  const carouselsWithCover = useMemo(() => carousels.filter(c => covers[c.id]), [carousels, covers]);
  const [loadingList, setLoadingList] = useState(true);

  const [library, setLibrary]                 = useState<LibraryItem[]>([]);
  const [libraryUploading, setLibraryUploading] = useState(false);
  const [libraryDragOver, setLibraryDragOver]   = useState(false);
  const libraryUploadRef = useRef<HTMLInputElement>(null);

  const [seedCarousels, setSeedCarousels] = useState<SeedCarousel[]>([]);
  const [usingSeedId, setUsingSeedId]     = useState<string | null>(null);
  useEffect(() => {
    fetch("/library-seed/carousel-examples.json")
      .then(r => r.json())
      .then(setSeedCarousels)
      .catch(() => {});
  }, []);

  /* ── Wheel zoom (non-passive) ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mainTab !== "gerar") return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
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
        setViewport(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [mainTab]);

  /* ── Context menu: close on outside click ── */
  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e: MouseEvent) => {
      if (ctxMenuRef.current?.contains(e.target as Node)) return;
      setCtxMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ctxMenu]);

  /* ── Canvas pan ── */
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
      setPositions(prev => ({ ...prev, [drag.id]: { x: drag.startX + dx, y: drag.startY + dy } }));
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
    const cy = (e.clientY - rect.top - vp.y) / vp.scale;
    setCtxMenu({ x: e.clientX, y: e.clientY, cx, cy });
  };

  const updateNode = useCallback((id: string, patch: Partial<CarouselNode>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));
  }, []);
  const removeNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
  }, []);

  /* ── Referência / Avatar connector nodes ──
   * Local-only (never persisted). Automatic, no manual pairing — exactly
   * like CriativosView: whichever Referência/Avatar cards exist on the
   * canvas (the first of each) feed every Gerar card's generation. */
  const spawnRefNode = useCallback((cx: number, cy: number) => {
    const id = nextNodeId();
    setRefNodes(prev => [...prev, { id, dataUrl: null }]);
    setPositions(prev => ({ ...prev, [id]: { x: cx, y: cy } }));
    setCtxMenu(null);
  }, []);
  const spawnAvatarNode = useCallback((cx: number, cy: number) => {
    const id = nextNodeId();
    setAvatarNodes(prev => [...prev, { id, name: "", dataUrl: null }]);
    setPositions(prev => ({ ...prev, [id]: { x: cx, y: cy } }));
    setCtxMenu(null);
  }, []);
  const updateRefNode = useCallback((id: string, patch: Partial<RefNode>) => {
    setRefNodes(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  }, []);
  const useImageAsReference = useCallback(async (imageUrl: string) => {
    const dataUrl = await imageUrlToDataUrl(imageUrl);

    const existingRef = refNodes[0];
    if (existingRef) {
      updateRefNode(existingRef.id, { dataUrl });
    } else {
      const id = nextNodeId();
      const vp = viewportRef.current;
      const rect = canvasRef.current?.getBoundingClientRect();
      const x = rect ? (rect.width / 2 - vp.x) / vp.scale - CONNECTOR_WIDTH / 2 : 120;
      const y = rect ? (rect.height / 2 - vp.y) / vp.scale - 120 : 120;
      setRefNodes(prev => [...prev, { id, dataUrl }]);
      setPositions(prev => ({ ...prev, [id]: { x, y } }));
    }
    setMainTab("gerar");
  }, [refNodes, updateRefNode]);
  const updateAvatarNode = useCallback((id: string, patch: Partial<AvatarNode>) => {
    setAvatarNodes(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  }, []);
  const removeRefNode = useCallback((id: string) => {
    setRefNodes(prev => prev.filter(r => r.id !== id));
  }, []);
  const removeAvatarNode = useCallback((id: string) => {
    setAvatarNodes(prev => prev.filter(a => a.id !== id));
  }, []);

  /* ── Output (Gerar) node ── */
  const spawnOutputNode = useCallback((cx: number, cy: number) => {
    const id = nextNodeId();
    setOutputNodes(prev => [...prev, { id, prompt: "", newFormat: "1:1", generating: false, error: null }]);
    setPositions(prev => ({ ...prev, [id]: { x: cx, y: cy } }));
    setCtxMenu(null);
  }, []);
  const updateOutputNode = useCallback((id: string, patch: Partial<OutputNode>) => {
    setOutputNodes(prev => prev.map(o => o.id === id ? { ...o, ...patch } : o));
  }, []);
  const removeOutputNode = useCallback((id: string) => {
    setOutputNodes(prev => prev.filter(o => o.id !== id));
  }, []);

  /* ── Load carousel list + cover thumbnails (Gerados tab) ── */
  const loadCarousels = useCallback(async () => {
    setLoadingList(true);
    const { data: rows } = await supabase
      .from("carousels").select("*").order("updated_at", { ascending: false });
    const list = (rows ?? []) as Carousel[];
    setCarousels(list);
    if (list.length > 0) {
      const { data: slideRows } = await supabase
        .from("carousel_slides")
        .select("carousel_id,thumbnail_url,position")
        .in("carousel_id", list.map(c => c.id))
        .order("position", { ascending: true });
      const coverMap: Record<string, string> = {};
      for (const s of (slideRows ?? []) as { carousel_id: string; thumbnail_url: string | null }[]) {
        if (!coverMap[s.carousel_id] && s.thumbnail_url) coverMap[s.carousel_id] = s.thumbnail_url;
      }
      setCovers(coverMap);
    }
    setLoadingList(false);
  }, [supabase]);
  useEffect(() => { loadCarousels(); }, [loadCarousels]);

  /* ── Library ── */
  const loadLibrary = useCallback(async () => {
    const { data } = await supabase
      .from("creative_library").select("id,url,name,created_at")
      .contains("tags", [LIBRARY_TAG])
      .order("created_at", { ascending: false });
    setLibrary((data ?? []) as LibraryItem[]);
  }, [supabase]);
  useEffect(() => { loadLibrary(); }, [loadLibrary]);

  /* ── Create carousel from a node's draft ── */
  /* ── Open an existing (saved) carousel as a node on the canvas ── */
  const openCarouselOnCanvas = useCallback(async (c: Carousel) => {
    setMainTab("gerar");
    const existing = nodes.find(n => n.carousel.id === c.id);
    if (existing) return;
    const id = nextNodeId();
    const { data: slideRows } = await supabase
      .from("carousel_slides").select("*").eq("carousel_id", c.id).order("position", { ascending: true });
    setNodes(prev => [...prev, { id, carousel: c, slides: (slideRows ?? []) as Slide[] }]);
    const stagger = nodes.length * 36;
    setPositions(prev => ({ ...prev, [id]: { x: 140 + stagger, y: 120 + stagger } }));
  }, [nodes, supabase]);

  /* ── Bootstrap a brand-new carousel from a reference example carousel —
   *  one slide per example image, each tagged with _seedUrl so opening it
   *  for the first time pre-loads that image as the background (via real
   *  fabric.js, inside CanvasEditor) instead of starting blank. ── */
  const applySeedCarousel = useCallback(async (example: SeedCarousel) => {
    if (usingSeedId) return;
    setUsingSeedId(example.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: carousel, error } = await supabase
        .from("carousels").insert({ user_id: user.id, name: example.name, format: example.format }).select().single();
      if (error || !carousel) return;
      const slideRows = example.slides.map((_, i) => ({ carousel_id: carousel.id, position: i }));
      const { data: slideData } = await supabase.from("carousel_slides").insert(slideRows).select();
      const sorted = ((slideData ?? []) as Slide[]).sort((a, b) => a.position - b.position);
      const slidesWithSeed = sorted.map((s, i) => ({ ...s, _seedUrl: example.slides[i] }));

      const id = nextNodeId();
      setNodes(prev => [...prev, { id, carousel: carousel as Carousel, slides: slidesWithSeed }]);
      const stagger = nodes.length * 36;
      setPositions(prev => ({ ...prev, [id]: { x: 140 + stagger, y: 120 + stagger } }));
      setMainTab("gerar");
      loadCarousels();
    } finally {
      setUsingSeedId(null);
    }
  }, [usingSeedId, supabase, nodes, loadCarousels]);

  /* ── Rename ── */
  const commitName = useCallback(async (nodeId: string, name: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.carousel) return;
    const finalName = name.trim() || node.carousel.name;
    if (finalName === node.carousel.name) return;
    await supabase.from("carousels").update({ name: finalName, updated_at: new Date().toISOString() }).eq("id", node.carousel.id);
    updateNode(nodeId, { carousel: { ...node.carousel, name: finalName } });
    setCarousels(prev => prev.map(c => c.id === node.carousel!.id ? { ...c, name: finalName } : c));
  }, [nodes, supabase, updateNode]);

  /* ── Delete carousel entirely ── */
  const deleteCarousel = useCallback(async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node?.carousel) {
      await supabase.from("carousels").delete().eq("id", node.carousel.id);
      setCarousels(prev => prev.filter(c => c.id !== node.carousel!.id));
    }
    removeNode(nodeId);
  }, [nodes, supabase, removeNode]);

  /* ── Slide ops (scoped to a node) ── */
  const addSlide = useCallback(async (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.carousel || node.slides.length >= MAX_SLIDES) return;
    const position = node.slides.length > 0 ? Math.max(...node.slides.map(s => s.position)) + 1 : 0;
    const { data } = await supabase
      .from("carousel_slides").insert({ carousel_id: node.carousel.id, position }).select().single();
    if (data) updateNode(nodeId, { slides: [...node.slides, data as Slide] });
  }, [nodes, supabase, updateNode]);

  const removeSlide = useCallback(async (nodeId: string, slide: Slide) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.slides.length <= MIN_SLIDES) return;
    await supabase.from("carousel_slides").delete().eq("id", slide.id);
    updateNode(nodeId, { slides: node.slides.filter(s => s.id !== slide.id) });
  }, [nodes, supabase, updateNode]);

  const moveSlide = useCallback(async (nodeId: string, index: number, dir: -1 | 1) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const j = index + dir;
    if (j < 0 || j >= node.slides.length) return;
    const a = node.slides[index], b = node.slides[j];
    await Promise.all([
      supabase.from("carousel_slides").update({ position: b.position }).eq("id", a.id),
      supabase.from("carousel_slides").update({ position: a.position }).eq("id", b.id),
    ]);
    const next = [...node.slides];
    [next[index], next[j]] = [{ ...next[j], position: next[index].position }, { ...next[index], position: next[j].position }];
    updateNode(nodeId, { slides: next });
  }, [nodes, supabase, updateNode]);

  /* ── CanvasEditor wiring ── */
  const editingNode = nodes.find(n => n.slides.some(s => s.id === editingSlideId));
  const editingSlide = editingNode?.slides.find(s => s.id === editingSlideId) ?? null;

  const uploadImageForNode = useCallback(async (file: File): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !editingNode?.carousel) throw new Error("Sem sessão.");
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/carrossel/${editingNode.carousel.id}/assets/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }, [supabase, editingNode]);

  const saveSlide = useCallback(async (nodeId: string, slideId: string, result: { fabricJson: Record<string, unknown>; thumbnailDataUrl: string }) => {
    const node = nodes.find(n => n.id === nodeId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !node?.carousel) return;
    let thumbnailUrl: string | null = null;
    try {
      const blob = await dataUrlToBlob(result.thumbnailDataUrl);
      const path = `${user.id}/carrossel/${node.carousel.id}/slides/${slideId}-${Date.now()}.png`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, { upsert: false });
      if (!error) thumbnailUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    } catch { /* keep thumbnailUrl null on failure — slide still saves its json */ }

    const patch: Partial<Omit<Slide, "_seedUrl" | "_sourceSlideUrl" | "_sourceSlideNumber" | "_sourceSlideTotal">> & { updated_at: string } = { fabric_json: result.fabricJson, updated_at: new Date().toISOString() };
    if (thumbnailUrl) patch.thumbnail_url = thumbnailUrl;
    await supabase.from("carousel_slides").update(patch).eq("id", slideId);
    await supabase.from("carousels").update({ updated_at: new Date().toISOString() }).eq("id", node.carousel.id);
    updateNode(nodeId, {
      slides: node.slides.map(s => s.id === slideId
        ? { ...s, ...patch, _sourceSlideUrl: undefined } as Slide
        : s),
    });
    loadCarousels();
  }, [nodes, supabase, updateNode, loadCarousels]);

  /* ── Reference-carousel batch generation — source images are first read as
   * one ordered carousel so every generated slide gets the same design-system
   * and cross-slide crop context. Person checks run alongside that one shared
   * analysis; the expensive per-slide generations remain fully parallel.
   * Slides without a visible person are copied unchanged. ── */
  const runCarouselBatchGeneration = useCallback(async (output: OutputNode, source: CarouselNode) => {
    const allSourceSlides = [...source.slides].sort((a, b) => a.position - b.position);
    const sourceSlides = allSourceSlides.slice(0, MAX_SLIDES);
    const wasCapped = allSourceSlides.length > MAX_SLIDES;
    const candidates = sourceSlides.flatMap((slide, index) => {
      const previewUrl = slide.thumbnail_url ?? slide._seedUrl;
      return previewUrl ? [{ slide, previewUrl, slideNumber: index + 1 }] : [];
    });
    const missingPreviewCount = sourceSlides.length - candidates.length;
    const missingPreviewNote = missingPreviewCount > 0
      ? ` ${missingPreviewCount} slide${missingPreviewCount === 1 ? " sem imagem foi ignorado" : "s sem imagem foram ignorados"}.`
      : "";

    if (candidates.length === 0) {
      updateOutputNode(output.id, {
        error: sourceSlides.length === 0
          ? "O carrossel de referência não tem slides."
          : `Nenhum slide do carrossel de referência tem imagem (${missingPreviewCount} ignorado${missingPreviewCount === 1 ? "" : "s"}).`,
      });
      return;
    }

    updateOutputNode(output.id, { generating: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        updateOutputNode(output.id, { generating: false, error: "Sem sessão." });
        return;
      }

      const format = source.carousel.format;
      const fmt = formatOf(format);
      const avatarImages = avatarNodes
        .map(avatar => avatar.dataUrl)
        .filter((dataUrl): dataUrl is string => Boolean(dataUrl));
      const preparedSettled = await Promise.allSettled(candidates.map(async candidate => ({
        ...candidate,
        dataUrl: await imageUrlToDataUrl(candidate.previewUrl),
      })));
      const prepared = preparedSettled.flatMap(result => result.status === "fulfilled" ? [result.value] : []);

      const carouselAnalysisPromise = (async () => {
        try {
          const res = await fetch("/api/analyze-carousel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              totalSlides: sourceSlides.length,
              slides: prepared.map(candidate => ({
                slideNumber: candidate.slideNumber,
                image: candidate.dataUrl,
              })),
            }),
          });
          const json = await res.json() as { error?: string; analysis?: string; bleedGroups?: number[][] };
          return res.ok && json.analysis?.trim()
            ? { analysis: json.analysis.trim(), bleedGroups: Array.isArray(json.bleedGroups) ? json.bleedGroups : [] }
            : null;
        } catch {
          // Keep the existing generation path available if this lightweight,
          // non-billable enrichment request is temporarily unavailable.
          return null;
        }
      })();
      const personChecksPromise = Promise.allSettled(prepared.map(async candidate => {
        const res = await fetch("/api/detect-person", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: candidate.dataUrl }),
        });
        const json = await res.json() as { error?: string; hasPerson?: boolean };
        if (!res.ok || typeof json.hasPerson !== "boolean") {
          throw new Error(json.error || "Erro ao detectar pessoa no slide.");
        }
        return json.hasPerson;
      }));
      const [carouselAnalysisResult, personChecksSettled] = await Promise.all([
        carouselAnalysisPromise,
        personChecksPromise,
      ]);
      const carouselAnalysis = carouselAnalysisResult?.analysis ?? null;
      const bleedGroups = carouselAnalysisResult?.bleedGroups ?? [];
      const classified = prepared.map((candidate, index) => ({
        ...candidate,
        hasPerson: personChecksSettled[index].status === "fulfilled"
          ? personChecksSettled[index].value
          : true,
      }));
      type ClassifiedCandidate = typeof classified[number];

      const generateIndependently = async (candidate: ClassifiedCandidate) => {
        const { slide, previewUrl, dataUrl, hasPerson, slideNumber } = candidate;
        if (!hasPerson) {
          return {
            sourcePosition: slide.position,
            sourceSlideUrl: undefined,
            dataUrl,
            ext: dataUrl.startsWith("data:image/png") ? "png" : "jpg",
            copiedThrough: true,
            replacementFailed: false,
            sourceSlideNumber: undefined,
            sourceSlideTotal: undefined,
          };
        }

        const res = await fetch("/api/generate-design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: output.prompt.trim(),
            referenceImages: [dataUrl],
            avatarImages,
            format,
            quality: "4K",
            targetWidth: fmt.w,
            targetHeight: fmt.h,
            carouselContext: carouselAnalysis ? {
              analysis: carouselAnalysis,
              slideNumber,
              totalSlides: sourceSlides.length,
            } : undefined,
          }),
        });
        const json = await res.json() as { error?: string; b64?: string; mimeType?: string; replacementFailed?: boolean };
        if (!res.ok || !json.b64 || !json.mimeType) {
          throw new Error(json.error || "Erro ao gerar slide.");
        }
        return {
          sourcePosition: slide.position,
          sourceSlideUrl: previewUrl,
          dataUrl: `data:${json.mimeType};base64,${json.b64}`,
          ext: json.mimeType.includes("png") ? "png" : "jpg",
          copiedThrough: false,
          replacementFailed: json.replacementFailed === true,
          sourceSlideNumber: slideNumber,
          sourceSlideTotal: sourceSlides.length,
        };
      };

      // Some reference carousels use one continuous photo of the person that
      // bleeds across the shared edge of 2+ adjacent slides (a real carousel
      // design technique). Generating those slides independently — each in
      // its own separate, non-deterministic AI call — cannot reproduce a
      // convincing seam, since nothing ties the two generations together.
      // /api/analyze-carousel identifies these groups; for each one, dispatch
      // a single joint call to /api/generate-design-bleed that stitches the
      // group's source slides into one photo, generates the person once, and
      // splits the continuity-guaranteed result back per slide. Any slide not
      // in a valid group (or a group where any member lacks a detected
      // person) keeps the proven independent path unchanged.
      const classifiedByNumber = new Map(classified.map(c => [c.slideNumber, c]));
      const validBleedGroups = bleedGroups
        .map(group => group.flatMap(n => {
          const candidate = classifiedByNumber.get(n);
          return candidate ? [candidate] : [];
        }))
        .filter(group => group.length >= 2 && group.every(c => c.hasPerson));
      const groupedSlideNumbers = new Set(validBleedGroups.flat().map(c => c.slideNumber));
      const independentCandidates = classified.filter(c => !groupedSlideNumbers.has(c.slideNumber));

      const independentTasks = independentCandidates.map(candidate => (async () => [await generateIndependently(candidate)])());

      const groupTasks = validBleedGroups.map(group => (async () => {
        const orderedGroup = [...group].sort((a, b) => a.slideNumber - b.slideNumber);
        try {
          const res = await fetch("/api/generate-design-bleed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: output.prompt.trim(),
              slides: orderedGroup.map(c => ({ slideNumber: c.slideNumber, referenceImage: c.dataUrl })),
              avatarImages,
              format,
              quality: "4K",
              targetWidth: fmt.w,
              targetHeight: fmt.h,
              carouselContext: carouselAnalysis ? { analysis: carouselAnalysis, totalSlides: sourceSlides.length } : undefined,
            }),
          });
          const json = await res.json() as {
            error?: string;
            slides?: Array<{ slideNumber: number; b64: string; mimeType: string }>;
            replacementFailed?: boolean;
          };
          if (!res.ok || !json.slides || json.slides.length !== orderedGroup.length) {
            throw new Error(json.error || "Erro ao gerar grupo de slides contínuos.");
          }
          const byNumber = new Map(json.slides.map(s => [s.slideNumber, s]));
          return orderedGroup.map(candidate => {
            const out = byNumber.get(candidate.slideNumber);
            if (!out) throw new Error(`Slide ${candidate.slideNumber} ausente na resposta do grupo.`);
            return {
              sourcePosition: candidate.slide.position,
              sourceSlideUrl: candidate.previewUrl,
              dataUrl: `data:${out.mimeType};base64,${out.b64}`,
              ext: out.mimeType.includes("png") ? "png" : "jpg",
              copiedThrough: false,
              replacementFailed: json.replacementFailed === true,
              sourceSlideNumber: candidate.slideNumber,
              sourceSlideTotal: sourceSlides.length,
            };
          });
        } catch {
          // Joint generation failed or was unavailable (e.g. the merged
          // person couldn't be located with confidence) — fall back to the
          // proven independent-per-slide path for this group instead of
          // losing its slides entirely.
          const fallbackSettled = await Promise.allSettled(orderedGroup.map(generateIndependently));
          return fallbackSettled.flatMap(r => r.status === "fulfilled" ? [r.value] : []);
        }
      })());

      const generationSettled = await Promise.allSettled([...independentTasks, ...groupTasks]);
      const slideResults = generationSettled
        .flatMap(result => result.status === "fulfilled" ? result.value : [])
        .sort((a, b) => a.sourcePosition - b.sourcePosition);

      if (slideResults.length === 0) {
        const failedCount = sourceSlides.length - missingPreviewCount;
        updateOutputNode(output.id, {
          generating: false,
          error: `Não foi possível gerar nenhum dos ${failedCount} slides com imagem.${missingPreviewNote}`,
        });
        return;
      }

      const name = output.prompt.trim().slice(0, 60) || source.carousel.name;
      const { data: carousel, error: carouselError } = await supabase
        .from("carousels")
        .insert({ user_id: user.id, name, format })
        .select()
        .single();
      if (carouselError || !carousel) {
        updateOutputNode(output.id, { generating: false, error: `Falha ao criar o novo carrossel.${missingPreviewNote}` });
        return;
      }

      const uploadStamp = Date.now();
      const uploadSettled = await Promise.allSettled(slideResults.map(async (result, index) => {
        const blob = await dataUrlToBlob(result.dataUrl);
        const path = `${user.id}/carrossel/${carousel.id}/generated/${uploadStamp}-${index}.${result.ext}`;
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, { upsert: false });
        if (error) throw error;
        const publicUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
        return {
          publicUrl,
          path,
          copiedThrough: result.copiedThrough,
          replacementFailed: result.replacementFailed,
          sourceSlideUrl: result.sourceSlideUrl,
          sourceSlideNumber: result.sourceSlideNumber,
          sourceSlideTotal: result.sourceSlideTotal,
        };
      }));
      const uploaded = uploadSettled.flatMap(result => result.status === "fulfilled" ? [result.value] : []);

      const savedSlides: Slide[] = [];
      for (const image of uploaded) {
        const position = savedSlides.length;
        const { data: slideRow, error: insertError } = await supabase
          .from("carousel_slides")
          .insert({ carousel_id: carousel.id, position })
          .select()
          .single();
        if (insertError || !slideRow) {
          await supabase.storage.from(STORAGE_BUCKET).remove([image.path]);
          continue;
        }
        const { error: updateError } = await supabase
          .from("carousel_slides")
          .update({ thumbnail_url: image.publicUrl })
          .eq("id", slideRow.id);
        if (updateError) {
          await supabase.from("carousel_slides").delete().eq("id", slideRow.id);
          await supabase.storage.from(STORAGE_BUCKET).remove([image.path]);
          continue;
        }
        savedSlides.push({
          ...(slideRow as Slide),
          thumbnail_url: image.publicUrl,
          ...(image.sourceSlideUrl ? { _sourceSlideUrl: image.sourceSlideUrl } : {}),
          ...(image.sourceSlideNumber ? { _sourceSlideNumber: image.sourceSlideNumber } : {}),
          ...(image.sourceSlideTotal ? { _sourceSlideTotal: image.sourceSlideTotal } : {}),
        });
      }

      if (savedSlides.length === 0) {
        await supabase.from("carousels").delete().eq("id", carousel.id);
        updateOutputNode(output.id, { generating: false, error: `As imagens foram preparadas, mas não foi possível salvar nenhum slide.${missingPreviewNote}` });
        return;
      }

      const newNode: CarouselNode = {
        id: nextNodeId(),
        carousel: carousel as Carousel,
        slides: savedSlides,
        _batchPrompt: output.prompt.trim(),
        ...(carouselAnalysis ? { _carouselAnalysis: carouselAnalysis } : {}),
      };
      setNodes(prev => [...prev, newNode]);
      const outPos = positionsRef.current[output.id] ?? { x: 0, y: 0 };
      const sourcePos = positionsRef.current[source.id];
      const sourceIsLeft = !sourcePos || sourcePos.x < outPos.x;
      setPositions(prev => ({
        ...prev,
        [newNode.id]: {
          x: sourceIsLeft ? outPos.x + OUTPUT_WIDTH + 80 : outPos.x - NODE_WIDTH - 80,
          y: outPos.y,
        },
      }));

      const failedCount = sourceSlides.length - savedSlides.length - missingPreviewCount;
      const notes: string[] = [];
      if (failedCount > 0) notes.push(`${failedCount} ${failedCount === 1 ? "falhou" : "falharam"}`);
      if (missingPreviewCount > 0) {
        notes.push(`${missingPreviewCount} ${missingPreviewCount === 1 ? "foi ignorado por não ter imagem" : "foram ignorados por não terem imagem"}`);
      }
      if (wasCapped) notes.push(`somente os primeiros ${MAX_SLIDES} foram processados`);
      updateOutputNode(output.id, {
        generating: false,
        targetCarouselNodeId: newNode.id,
        error: notes.length > 0
          ? `Gerados ${savedSlides.length} de ${sourceSlides.length} slides — ${notes.join("; ")}.`
          : null,
      });
      loadCarousels();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao gerar o carrossel.";
      updateOutputNode(output.id, { generating: false, error: `${message}${missingPreviewNote}` });
    }
  }, [avatarNodes, supabase, updateOutputNode, loadCarousels]);

  /* ── Retry one slide from its original batch reference. This intentionally
   * skips person detection: the user explicitly chose this slide for a new
   * generation attempt. ── */
  const regenerateBatchSlide = useCallback(async (nodeId: string, slideId: string, prompt: string) => {
    const node = nodes.find(candidate => candidate.id === nodeId);
    const slide = node?.slides.find(candidate => candidate.id === slideId);
    const sourceSlideUrl = slide?._sourceSlideUrl;
    const finalPrompt = prompt.trim();
    if (!node || !slide || !sourceSlideUrl) throw new Error("Referência original deste slide não encontrada.");
    if (!finalPrompt) throw new Error("Digite uma instrução para regenerar o slide.");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sem sessão.");

    const referenceImage = await imageUrlToDataUrl(sourceSlideUrl);
    const avatarImages = avatarNodes
      .map(avatar => avatar.dataUrl)
      .filter((dataUrl): dataUrl is string => Boolean(dataUrl));
    const format = node.carousel.format;
    const fmt = formatOf(format);
    const res = await fetch("/api/generate-design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: finalPrompt,
        referenceImages: [referenceImage],
        avatarImages,
        format,
        quality: "4K",
        targetWidth: fmt.w,
        targetHeight: fmt.h,
        carouselContext: node._carouselAnalysis && slide._sourceSlideNumber
          ? {
              analysis: node._carouselAnalysis,
              slideNumber: slide._sourceSlideNumber,
              totalSlides: slide._sourceSlideTotal ?? node.slides.length,
            }
          : undefined,
      }),
    });
    const json = await res.json() as { error?: string; b64?: string; mimeType?: string; replacementFailed?: boolean };
    if (!res.ok || !json.b64 || !json.mimeType) {
      throw new Error(json.error || "Erro ao regenerar slide.");
    }
    if (json.replacementFailed) throw new Error(REPLACEMENT_FAILED_MESSAGE);

    const dataUrl = `data:${json.mimeType};base64,${json.b64}`;
    const blob = await dataUrlToBlob(dataUrl);
    const ext = json.mimeType.includes("png") ? "png" : "jpg";
    const path = `${user.id}/carrossel/${node.carousel.id}/generated/${slide.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, blob, { upsert: false });
    if (uploadError) throw new Error("Falha ao salvar a imagem regenerada.");

    const publicUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    const { error: updateError } = await supabase
      .from("carousel_slides")
      .update({ thumbnail_url: publicUrl })
      .eq("id", slide.id);
    if (updateError) {
      await supabase.storage.from(STORAGE_BUCKET).remove([path]);
      throw new Error("Falha ao atualizar o slide regenerado.");
    }

    setNodes(prev => prev.map(candidate => candidate.id === nodeId
      ? {
          ...candidate,
          slides: candidate.slides.map(candidateSlide => candidateSlide.id === slideId
            ? { ...candidateSlide, thumbnail_url: publicUrl }
            : candidateSlide),
        }
      : candidate));
    loadCarousels();
  }, [nodes, avatarNodes, supabase, loadCarousels]);

  /* ── Output (Gerar) node generation — automatic, no manual pairing, same
   * as CriativosView: the first Referência (+ first Avatar, if any) on the
   * canvas feed a single prompt-driven generation. The result always drops
   * into the target carousel's next empty slide — creating that carousel
   * on the very first generation if none is picked yet, since a carousel
   * here only ever comes into existence already populated, never blank —
   * anchored on the Referência image itself, never a previously-generated
   * slide, so repeated generations can't drift away from the reference the
   * client set. ── */
  const runOutputGeneration = useCallback(async (outputId: string) => {
    const output = outputNodes.find(o => o.id === outputId);
    if (!output || output.generating || !output.prompt.trim()) return;
    /* Automatic — same mechanism as Referência/Avatar: the first Carrossel
     * node present on the canvas is the wired reference for every Gerar
     * card, no manual "which carrossel" picker. */
    const carouselRefNode = nodes[0];
    if (carouselRefNode) {
      await runCarouselBatchGeneration(output, carouselRefNode);
      return;
    }
    const refNode = refNodes[0];
    if (!refNode?.dataUrl) {
      updateOutputNode(outputId, { error: "Adicione uma Referência com imagem — a IA nunca cria do zero." });
      return;
    }
    const avatarImages = avatarNodes
      .map(avatar => avatar.dataUrl)
      .filter((dataUrl): dataUrl is string => Boolean(dataUrl));
    let target = nodes.find(n => n.id === output.targetCarouselNodeId);
    const format = target ? target.carousel.format : output.newFormat;
    const fmt = formatOf(format);

    updateOutputNode(outputId, { generating: true, error: null });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { updateOutputNode(outputId, { generating: false, error: "Sem sessão." }); return; }

      const res = await fetch("/api/generate-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: output.prompt.trim(),
          referenceImages: [refNode.dataUrl],
          avatarImages,
          format,
          quality: "2K",
          targetWidth: fmt.w,
          targetHeight: fmt.h,
        }),
      });
      const json = await res.json() as { error?: string; b64?: string; mimeType?: string; replacementFailed?: boolean };
      if (!res.ok || !json.b64 || !json.mimeType) {
        updateOutputNode(outputId, { generating: false, error: json.error || "Erro ao gerar." });
        return;
      }

      const dataUrl = `data:${json.mimeType};base64,${json.b64}`;
      const blob = await dataUrlToBlob(dataUrl);
      const ext = json.mimeType?.includes("png") ? "png" : "jpg";

      /* No target yet — this generation creates its carousel now, with
       * exactly the content just generated (never blank). */
      if (!target) {
        const name = output.prompt.trim().slice(0, 60) || "Carrossel sem título";
        const { data: carousel, error } = await supabase
          .from("carousels").insert({ user_id: user.id, name, format }).select().single();
        if (error || !carousel) { updateOutputNode(outputId, { generating: false, error: "Falha ao criar o carrossel." }); return; }
        const newNode: CarouselNode = { id: nextNodeId(), carousel: carousel as Carousel, slides: [] };
        setNodes(prev => [...prev, newNode]);
        const outPos = positionsRef.current[outputId] ?? { x: 0, y: 0 };
        setPositions(prev => ({ ...prev, [newNode.id]: { x: outPos.x + OUTPUT_WIDTH + 80, y: outPos.y } }));
        target = newNode;
        updateOutputNode(outputId, { targetCarouselNodeId: newNode.id });
        loadCarousels();
      }

      const path = `${user.id}/carrossel/${target.carousel.id}/generated/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, { upsert: false });
      if (upErr) { updateOutputNode(outputId, { generating: false, error: "Falha ao salvar a imagem gerada." }); return; }
      const publicUrl = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;

      /* Find the next empty slide, or make room for one if the carousel
       * isn't full yet. */
      let targetSlideId = target.slides.find(s => !s.thumbnail_url)?.id;
      if (!targetSlideId) {
        if (target.slides.length >= MAX_SLIDES) {
          updateOutputNode(outputId, { generating: false, error: "Carrossel cheio — abra-o e adicione um slide antes de gerar." });
          return;
        }
        const position = target.slides.length > 0 ? Math.max(...target.slides.map(s => s.position)) + 1 : 0;
        const { data: newSlide } = await supabase
          .from("carousel_slides").insert({ carousel_id: target.carousel.id, position }).select().single();
        if (!newSlide) { updateOutputNode(outputId, { generating: false, error: "Falha ao criar o slide." }); return; }
        targetSlideId = (newSlide as Slide).id;
        setNodes(prev => prev.map(n => n.id === target!.id ? { ...n, slides: [...n.slides, newSlide as Slide] } : n));
      }

      setNodes(prev => prev.map(n => n.id === target!.id
        ? { ...n, slides: n.slides.map(s => s.id === targetSlideId ? { ...s, _seedUrl: publicUrl } : s) }
        : n));
      updateOutputNode(outputId, {
        generating: false,
        error: json.replacementFailed ? REPLACEMENT_FAILED_MESSAGE : null,
      });
      setEditingSlideId(targetSlideId);
    } catch (err) {
      updateOutputNode(outputId, { generating: false, error: err instanceof Error ? err.message : "Erro ao gerar." });
    }
  }, [outputNodes, runCarouselBatchGeneration, refNodes, avatarNodes, nodes, supabase, updateOutputNode, loadCarousels]);

  /* ── Library management ── */
  async function uploadToLibrary(files: FileList | File[]) {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    setLibraryUploading(true);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const path = `${user.id}/library/carrossel-${Date.now()}-${file.name}`;
      const { error: uploadErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false });
      if (uploadErr) continue;
      const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      await supabase.from("creative_library").insert({ user_id: user.id, url: publicUrl, name: file.name.replace(/\.[^/.]+$/, ""), format: null, tags: [LIBRARY_TAG] });
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
  async function handleDeleteLibraryItem(item: LibraryItem) {
    await supabase.from("creative_library").delete().eq("id", item.id);
    try { const p = new URL(item.url).pathname.split(`/${STORAGE_BUCKET}/`)[1]; if (p) await supabase.storage.from(STORAGE_BUCKET).remove([p]); } catch { /* ok */ }
    setLibrary(prev => prev.filter(x => x.id !== item.id));
  }

  const editingTemplate: CanvasTemplate | null = editingSlide && editingNode?.carousel ? (() => {
    const fmt = formatOf(editingNode.carousel!.format);
    return {
      id: editingSlide.id, name: editingNode.carousel!.name, client: "", format: editingNode.carousel!.format,
      w: fmt.w, h: fmt.h, bgColor: "#ffffff", referencePath: "",
      objects: [], fabricJson: (editingSlide.fabric_json ?? undefined) as CanvasTemplate["fabricJson"],
    };
  })() : null;

  /* dot grid background moves with viewport */
  const dotSpacing = DOT_SIZE * viewport.scale;
  const dotGridStyle: React.CSSProperties = {
    backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.065) 1px, transparent 1px)",
    backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
    backgroundPosition: `${viewport.x}px ${viewport.y}px`,
  };

  /* ═══════════════ Slide editor (full takeover) ═══════════════ */
  if (editingTemplate && editingNode) {
    return (
      <CanvasEditor
        template={editingTemplate}
        onClose={() => setEditingSlideId(null)}
        onSave={data => saveSlide(editingNode.id, editingTemplate.id, data)}
        onUploadImage={uploadImageForNode}
        libraryImages={library.map(l => ({ id: l.id, url: l.url, name: l.name ?? "" }))}
        initialBackgroundUrl={!editingSlide?.fabric_json ? editingSlide?._seedUrl ?? editingSlide?.thumbnail_url ?? undefined : undefined}
      />
    );
  }

  const badge = (n: number) => n > 0 && (
    <span className="ml-0.5 min-w-[16px] h-4 rounded-full bg-white/[0.08] text-white/35 text-[9px] flex items-center justify-center px-1">{n}</span>
  );

  /* Where the transient "Gerando..." placeholder card sits for a Gerar node
   * whose target carousel doesn't exist on the canvas yet (new carousel, or
   * a fresh batch generation) — shared between the card render and its
   * connector line so they always agree. */
  const getPlaceholderPos = (output: OutputNode): CardPos => {
    const outPos = positions[output.id] ?? { x: 0, y: 0 };
    return { x: outPos.x + OUTPUT_WIDTH + 80, y: outPos.y };
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* ─── Tab bar ─────────────────────────── */}
      <div className="px-8 pt-6 pb-4 shrink-0 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-white/70 tracking-tight">Carrossel</h2>
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.07] rounded-xl p-1">
          {([
            { id: "biblioteca" as const, label: "Biblioteca", icon: <Library className="w-3.5 h-3.5" />, count: library.length },
            { id: "gerar"      as const, label: "Gerar",      icon: <Wand2 className="w-3.5 h-3.5" />,   count: 0 },
            { id: "gerados"    as const, label: "Gerados",    icon: <ImageIcon className="w-3.5 h-3.5" />, count: carouselsWithCover.length },
          ]).map(t => (
            <button key={t.id} onClick={() => setMainTab(t.id)}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                mainTab === t.id ? "bg-purple-600/20 text-purple-300" : "text-white/35 hover:text-white/60")}>
              {t.icon}{t.label}{badge(t.count)}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════ TAB: GERAR (infinite canvas) ═══════════════ */}
      {mainTab === "gerar" && (
        <div className="flex-1 overflow-hidden min-h-0 relative">
          <div
            ref={canvasRef}
            style={{ position: "absolute", inset: 0, cursor: isPanningRef.current ? "grabbing" : "default", ...dotGridStyle }}
            onContextMenu={handleCanvasContextMenu}
            onMouseDown={handleCanvasMouseDown}
          >
            <div style={{
              position: "absolute", left: 0, top: 0,
              transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`,
              transformOrigin: "0 0", willChange: "transform",
            }}>
              {nodes.map((node, nodeIndex) => {
                const pos = positions[node.id] || { x: 0, y: 0 };
                /* The first Carrossel node on the canvas is the one
                 * auto-wired to every Gerar card — same "first of type"
                 * mechanism as Referência/Avatar. Only it gets a live port,
                 * so a freshly generated result carousel doesn't misleadingly
                 * look wireable as a reference too. */
                const isWiredReference = nodeIndex === 0;
                return (
                  <div key={node.id} data-node="true" style={{
                    position: "absolute", left: pos.x, top: pos.y, width: NODE_WIDTH,
                    zIndex: draggingId === node.id ? 200 : 10,
                    cursor: draggingId === node.id ? "grabbing" : "grab",
                  }} onMouseDown={e => startDrag(node.id, e)}>
                    <CarouselNodeCard
                      node={node}
                      isDragging={draggingId === node.id}
                      onRemoveFromCanvas={() => removeNode(node.id)}
                      onDeleteCarousel={() => deleteCarousel(node.id)}
                      onRenameCommit={name => commitName(node.id, name)}
                      onOpenSlide={slideId => setEditingSlideId(slideId)}
                      onAddSlide={() => addSlide(node.id)}
                      onRemoveSlide={slide => removeSlide(node.id, slide)}
                      onMoveSlide={(i, dir) => moveSlide(node.id, i, dir)}
                      onUseAsReference={useImageAsReference}
                      onRegenerateSlide={(slideId, prompt) => regenerateBatchSlide(node.id, slideId, prompt)}
                      onDownloadAll={() => {
                        const withThumb = node.slides.filter(s => s.thumbnail_url);
                        downloadSlidesZip(
                          withThumb.map(s => s.thumbnail_url!),
                          node.carousel.name.replace(/\s+/g, "-").toLowerCase()
                        ).then(failed => {
                          if (failed > 0) {
                            alert(`${failed} de ${withThumb.length} imagens não puderam ser baixadas (arquivo indisponível no servidor). As demais foram salvas normalmente.`);
                          }
                        });
                      }}
                    />
                    {isWiredReference && (
                      <div title="Referência conectada ao Gerar" style={{
                        position: "absolute", right: -5, top: CAROUSEL_PORT_Y - 5,
                        width: 10, height: 10, borderRadius: "50%",
                        background: "#4ade80", border: "2px solid #0d0d11",
                        boxShadow: "0 0 6px rgba(74,222,128,.4)", zIndex: 3,
                      }} />
                    )}
                  </div>
                );
              })}

              {/* Referência connector cards */}
              {refNodes.map(ref => {
                const pos = positions[ref.id] || { x: 0, y: 0 };
                return (
                  <div key={ref.id} data-node="true" style={{
                    position: "absolute", left: pos.x, top: pos.y, width: CONNECTOR_WIDTH,
                    zIndex: draggingId === ref.id ? 200 : 10,
                    cursor: draggingId === ref.id ? "grabbing" : "grab",
                  }} onMouseDown={e => startDrag(ref.id, e)}>
                    <RefConnectorCard ref_={ref} onDelete={() => removeRefNode(ref.id)} onChange={p => updateRefNode(ref.id, p)} />
                    <div style={{
                      position: "absolute", right: -5, top: CONNECTOR_PORT_Y - 5,
                      width: 10, height: 10, borderRadius: "50%",
                      background: "#4ade80", border: "2px solid #0d0d11",
                      boxShadow: "0 0 6px rgba(74,222,128,.4)", zIndex: 3,
                    }} />
                  </div>
                );
              })}

              {/* Avatar connector cards */}
              {avatarNodes.map(av => {
                const pos = positions[av.id] || { x: 0, y: 0 };
                return (
                  <div key={av.id} data-node="true" style={{
                    position: "absolute", left: pos.x, top: pos.y, width: CONNECTOR_WIDTH,
                    zIndex: draggingId === av.id ? 200 : 10,
                    cursor: draggingId === av.id ? "grabbing" : "grab",
                  }} onMouseDown={e => startDrag(av.id, e)}>
                    <AvatarConnectorCard avatar={av} onDelete={() => removeAvatarNode(av.id)} onChange={p => updateAvatarNode(av.id, p)} />
                    <div style={{
                      position: "absolute", right: -5, top: CONNECTOR_PORT_Y - 5,
                      width: 10, height: 10, borderRadius: "50%",
                      background: "#fbbf24", border: "2px solid #0d0d11",
                      boxShadow: "0 0 6px rgba(251,191,36,.4)", zIndex: 3,
                    }} />
                  </div>
                );
              })}

              {/* Output (Gerar) cards */}
              {outputNodes.map(output => {
                const pos = positions[output.id] || { x: 0, y: 0 };
                return (
                  <div key={output.id} data-node="true" style={{
                    position: "absolute", left: pos.x, top: pos.y, width: OUTPUT_WIDTH,
                    zIndex: draggingId === output.id ? 200 : 20,
                    cursor: draggingId === output.id ? "grabbing" : "grab",
                  }} onMouseDown={e => startDrag(output.id, e)}>
                    <div style={{ position: "absolute", left: -5, top: OUTPUT_REF_PORT_Y - 5, width: 10, height: 10, borderRadius: "50%", background: "#4ade80", border: "2px solid #09090e", boxShadow: "0 0 6px rgba(74,222,128,.4)", zIndex: 3 }} />
                    <div style={{ position: "absolute", left: -5, top: OUTPUT_AVATAR_PORT_Y - 5, width: 10, height: 10, borderRadius: "50%", background: "#fbbf24", border: "2px solid #09090e", boxShadow: "0 0 6px rgba(251,191,36,.4)", zIndex: 3 }} />
                    {nodes.length > 0 && (
                      <div title="Carrossel de referência" style={{ position: "absolute", left: -5, top: OUTPUT_CAROUSEL_REF_PORT_Y - 5, width: 10, height: 10, borderRadius: "50%", background: "#4ade80", border: "2px solid #09090e", boxShadow: "0 0 6px rgba(74,222,128,.4)", zIndex: 3 }} />
                    )}
                    <div style={{ position: "absolute", right: -5, top: OUTPUT_OUT_PORT_Y - 5, width: 10, height: 10, borderRadius: "50%", background: "#a78bfa", border: "2px solid #09090e", boxShadow: output.generating ? "0 0 10px rgba(167,139,250,.9)" : "0 0 6px rgba(167,139,250,.5)", zIndex: 3 }} />
                    <OutputNodeCard
                      output={output}
                      refNodes={refNodes}
                      avatarNodes={avatarNodes}
                      carouselRefNode={nodes[0]}
                      onChange={p => updateOutputNode(output.id, p)}
                      onGenerate={() => runOutputGeneration(output.id)}
                      onDelete={() => removeOutputNode(output.id)}
                    />
                  </div>
                );
              })}

              {/* "Gerando..." placeholder — shown while a Gerar card's
                  generation is in flight and before its target carousel
                  exists on the canvas yet (new carousel, or a fresh batch
                  generation still assembling all of its slides). */}
              {outputNodes
                .filter(output => output.generating && !nodes.some(n => n.id === output.targetCarouselNodeId))
                .map(output => {
                  const pos = getPlaceholderPos(output);
                  return (
                    <div key={`placeholder-${output.id}`} data-node="true" style={{ position: "absolute", left: pos.x, top: pos.y, width: CONNECTOR_WIDTH, zIndex: 15 }}>
                      <div style={{ background: "#0d0d11", border: "1px solid rgba(124,58,237,.25)", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.4)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                          <ImageIcon style={{ width: 12, height: 12, color: "rgba(167,139,250,.4)", flexShrink: 0 }} />
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", color: "rgba(167,139,250,.4)", textTransform: "uppercase", flex: 1 }}>Output</span>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "32px 16px", minHeight: 140 }}>
                          <div style={{ position: "relative", width: 32, height: 32 }}>
                            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid rgba(124,58,237,.15)", borderTopColor: "#7c3aed", animation: "spin 1s linear infinite" }} />
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <ImagePlus style={{ width: 12, height: 12, color: "rgba(124,58,237,.5)" }} />
                            </div>
                          </div>
                          <p style={{ fontSize: 10, color: "rgba(255,255,255,.2)" }}>{nodes.length > 0 ? "Gerando carrossel..." : "Gerando..."}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* ── SVG connection lines: Referência/Avatar/Carrossel → Output → target Carrossel ── */}
            {(refNodes.length > 0 || avatarNodes.length > 0 || outputNodes.length > 0) && (
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 6, overflow: "visible" }}>
                {(() => {
                  const sc = viewport.scale;
                  const EnergyLine = ({ id, x1, y1, x2, y2 }: { id: string; x1: number; y1: number; x2: number; y2: number; active?: boolean }) => {
                    const cx = Math.max(50, Math.abs(x2 - x1) * 0.45);
                    const d = `M ${x1} ${y1} C ${x1 + cx} ${y1} ${x2 - cx} ${y2} ${x2} ${y2}`;
                    return <path key={id} d={d} fill="none" stroke="rgba(139,92,246,.45)" strokeWidth={1.5} strokeLinecap="round" />;
                  };
                  const lines: React.ReactNode[] = [];
                  /* Automatic — mirrors CriativosView: the first Referência
                   * and first Avatar on the canvas feed every Gerar card. */
                  const refNode = refNodes[0];
                  const avNode = avatarNodes[0];
                  for (const output of outputNodes) {
                    const outPos = positions[output.id];
                    if (!outPos) continue;
                    if (refNode) {
                      const rPos = positions[refNode.id];
                      if (rPos) lines.push(<EnergyLine key={`ref-${output.id}`} id={`ref-${output.id}`}
                        x1={(rPos.x + CONNECTOR_WIDTH) * sc + viewport.x} y1={(rPos.y + CONNECTOR_PORT_Y) * sc + viewport.y}
                        x2={outPos.x * sc + viewport.x} y2={(outPos.y + OUTPUT_REF_PORT_Y) * sc + viewport.y}
                        active={output.generating} />);
                    }
                    if (avNode) {
                      const aPos = positions[avNode.id];
                      if (aPos) lines.push(<EnergyLine key={`av-${output.id}`} id={`av-${output.id}`}
                        x1={(aPos.x + CONNECTOR_WIDTH) * sc + viewport.x} y1={(aPos.y + CONNECTOR_PORT_Y) * sc + viewport.y}
                        x2={outPos.x * sc + viewport.x} y2={(outPos.y + OUTPUT_AVATAR_PORT_Y) * sc + viewport.y}
                        active={output.generating} />);
                    }
                    /* Carrossel de referência — same auto-wiring as Referência/Avatar. */
                    const carouselRefNode = nodes[0];
                    if (carouselRefNode) {
                      const cPos = positions[carouselRefNode.id];
                      if (cPos) lines.push(<EnergyLine key={`carousel-ref-${output.id}`} id={`carousel-ref-${output.id}`}
                        x1={(cPos.x + NODE_WIDTH) * sc + viewport.x} y1={(cPos.y + CAROUSEL_PORT_Y) * sc + viewport.y}
                        x2={outPos.x * sc + viewport.x} y2={(outPos.y + OUTPUT_CAROUSEL_REF_PORT_Y) * sc + viewport.y}
                        active={output.generating} />);
                    }
                    const target = nodes.find(n => n.id === output.targetCarouselNodeId);
                    if (target) {
                      const tPos = positions[target.id];
                      if (tPos) lines.push(<EnergyLine key={`out-${output.id}`} id={`out-${output.id}`}
                        x1={(outPos.x + OUTPUT_WIDTH) * sc + viewport.x} y1={(outPos.y + OUTPUT_OUT_PORT_Y) * sc + viewport.y}
                        x2={tPos.x * sc + viewport.x} y2={(tPos.y + CAROUSEL_PORT_Y) * sc + viewport.y}
                        active={output.generating} />);
                    } else if (output.generating) {
                      const phPos = getPlaceholderPos(output);
                      lines.push(<EnergyLine key={`ph-${output.id}`} id={`ph-${output.id}`}
                        x1={(outPos.x + OUTPUT_WIDTH) * sc + viewport.x} y1={(outPos.y + OUTPUT_OUT_PORT_Y) * sc + viewport.y}
                        x2={phPos.x * sc + viewport.x} y2={(phPos.y + CAROUSEL_PORT_Y) * sc + viewport.y}
                        active={true} />);
                    }
                  }
                  return lines;
                })()}
              </svg>
            )}

            {/* Empty state */}
            {nodes.length === 0 && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", userSelect: "none" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,.02)",
                    border: "1px solid rgba(255,255,255,.05)", display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 16px",
                  }}>
                    <MousePointer2 style={{ width: 24, height: 24, color: "rgba(255,255,255,.10)" }} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.20)", marginBottom: 6 }}>Canvas vazio</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,.12)" }}>Clique com o botão direito para adicionar Referência, Avatar ou Gerar</p>
                </div>
              </div>
            )}

            {/* Context menu */}
            {ctxMenu && (
              <div
                ref={ctxMenuRef}
                style={{
                  position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 2000, minWidth: 210,
                  background: "#111117", border: "1px solid rgba(255,255,255,.10)", borderRadius: 12,
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
                  { icon: <ImageIcon style={{ width: 14, height: 14 }} />, label: "Referência",       sub: "Estilo que a IA nunca deve fugir", color: "#4ade80", bg: "rgba(74,222,128,.10)",  onClick: () => spawnRefNode(ctxMenu.cx, ctxMenu.cy) },
                  { icon: <User      style={{ width: 14, height: 14 }} />, label: "Avatar",            sub: "Pessoa ou personagem",             color: "#fbbf24", bg: "rgba(251,191,36,.10)", onClick: () => spawnAvatarNode(ctxMenu.cx, ctxMenu.cy) },
                  { icon: <Wand2     style={{ width: 14, height: 14 }} />, label: "Gerar",             sub: "Gera com IA e manda pro carrossel", color: "#a78bfa", bg: "rgba(124,58,237,.12)", onClick: () => spawnOutputNode(ctxMenu.cx, ctxMenu.cy) },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 12px", textAlign: "left", background: "none", border: "none", cursor: "pointer" }}
                    className="hover:bg-white/[0.04] transition-colors"
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 9, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", color: item.color, flexShrink: 0 }}>
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
      {mainTab === "biblioteca" && (
        <div className="flex-1 overflow-y-auto px-8 pb-10">
          {seedCarousels.length > 0 && (
            <div className="mb-6">
              <p className="text-[9px] font-semibold text-white/25 uppercase tracking-widest mb-2.5">Exemplos de carrossel</p>
              <div className="flex gap-4 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                {seedCarousels.map(example => (
                  <SeedCarouselCard
                    key={example.id}
                    example={example}
                    busy={usingSeedId === example.id}
                    onUse={() => applySeedCarousel(example)}
                    onUseAsReference={useImageAsReference}
                  />
                ))}
              </div>
            </div>
          )}

          <input ref={libraryUploadRef} type="file" accept="image/*" multiple onChange={handleLibraryFileInput} className="hidden" />
          <div
            onDragOver={e => { e.preventDefault(); setLibraryDragOver(true); }}
            onDragLeave={() => setLibraryDragOver(false)}
            onDrop={handleLibraryDrop}
            onClick={() => libraryUploadRef.current?.click()}
            className={cn(
              "w-full flex items-center justify-center gap-2.5 py-3.5 mb-5 rounded-2xl border border-dashed transition-all cursor-pointer",
              libraryDragOver ? "border-purple-500/50 bg-purple-500/[0.06]" : "border-white/[0.06] hover:border-purple-500/20 hover:bg-purple-500/[0.03]"
            )}
          >
            {libraryUploading
              ? <><Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" /><p className="text-[11px] text-white/35">Salvando...</p></>
              : <><Upload className="w-3.5 h-3.5 text-white/20" /><p className="text-[11px] text-white/25">Adicionar imagens para usar como fundo dos slides — PNG, JPG, WEBP</p></>
            }
          </div>

          {library.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                <Library className="w-6 h-6 text-white/15" />
              </div>
              <p className="text-[14px] font-semibold text-white/40 mb-1">Nenhuma imagem ainda</p>
              <p className="text-[12px] text-white/25">Suba fotos e artes aqui — elas ficam disponíveis no editor de slide, no botão &quot;Biblioteca&quot;.</p>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
              {library.map(item => (
                <div key={item.id} className="group rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/15 bg-white/[0.02] transition-all relative">
                  <div className="relative aspect-square overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.name ?? ""} className="w-full h-full object-cover group-hover:scale-105 duration-500 transition-transform" />
                    <button
                      onClick={useImageAsReference.bind(null, item.url)}
                      title="Usar como Referência"
                      className="absolute top-2 right-10 p-1.5 rounded-lg bg-emerald-500/20 backdrop-blur-sm text-emerald-300 opacity-0 group-hover:opacity-100 cursor-pointer hover:bg-emerald-500/40 transition-all">
                      <ImageIcon className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteLibraryItem(item)}
                      title="Excluir imagem"
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-500/20 backdrop-blur-sm text-red-300 opacity-0 group-hover:opacity-100 cursor-pointer hover:bg-red-500/40 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {item.name && <p className="px-2.5 py-2 text-[10px] text-white/40 truncate">{item.name}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ TAB: GERADOS ═══════════════ */}
      {mainTab === "gerados" && (
        <div className="flex-1 overflow-y-auto px-8 pb-10">
          {loadingList ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-5 h-5 text-white/20 animate-spin" /></div>
          ) : carouselsWithCover.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
                <GalleryHorizontalEnd className="w-6 h-6 text-white/15" />
              </div>
              <p className="text-[14px] font-semibold text-white/40 mb-1">Nenhum carrossel ainda</p>
              <p className="text-[12px] text-white/25">Crie um carrossel na aba Gerar (clique com o botão direito no canvas).</p>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
              {carouselsWithCover.map(c => {
                const fmt = formatOf(c.format);
                const cover = covers[c.id];
                return (
                  <div key={c.id} className="group rounded-2xl overflow-hidden border border-white/[0.06] hover:border-purple-500/30 bg-white/[0.02] transition-all cursor-pointer" onClick={() => openCarouselOnCanvas(c)}>
                    <div className="relative overflow-hidden bg-[#0d0d11]" style={{ aspectRatio: fmt.ratio }}>
                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover} alt={c.name} className="w-full h-full object-cover group-hover:scale-105 duration-500 transition-transform" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/10">
                          <GalleryHorizontalEnd className="w-6 h-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="p-3">
                      <p className="text-[12px] font-semibold text-white/75 truncate">{c.name}</p>
                      <p className="text-[10px] text-white/25 font-mono mt-0.5">{fmt.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Node card (draft form or storyboard) ─────────────────── */
function CarouselNodeCard({
  node, isDragging, onRemoveFromCanvas, onDeleteCarousel,
  onRenameCommit, onOpenSlide, onAddSlide, onRemoveSlide, onMoveSlide,
  onUseAsReference, onRegenerateSlide, onDownloadAll,
}: {
  node: CarouselNode; isDragging: boolean;
  onRemoveFromCanvas: () => void;
  onDeleteCarousel: () => void;
  onRenameCommit: (name: string) => void;
  onOpenSlide: (slideId: string) => void;
  onAddSlide: () => void;
  onRemoveSlide: (slide: Slide) => void;
  onMoveSlide: (index: number, dir: -1 | 1) => void;
  onUseAsReference: (imageUrl: string) => void;
  onRegenerateSlide: (slideId: string, prompt: string) => Promise<void>;
  onDownloadAll: () => void;
}) {
  const cardStyle: React.CSSProperties = {
    background: "#09090e", border: "1px solid rgba(124,58,237,.35)", borderRadius: 14,
    overflow: "hidden", boxShadow: "0 0 0 1px rgba(124,58,237,.08), 0 0 40px rgba(124,58,237,.10), 0 8px 40px rgba(0,0,0,.5)",
    cursor: isDragging ? "grabbing" : "default",
  };

  const fmt = formatOf(node.carousel.format);
  return (
    <div style={{ ...cardStyle, position: "relative" }}>
      {/* Receiving port — an Output (Gerar) card can target this carousel;
       * see the "carrossel de destino" picker on that card. */}
      <div style={{ position: "absolute", left: -5, top: CAROUSEL_PORT_Y - 5, width: 10, height: 10, borderRadius: "50%", background: "rgba(167,139,250,.5)", border: "2px solid #09090e", zIndex: 3 }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid rgba(124,58,237,.15)", cursor: isDragging ? "grabbing" : "grab" }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(124,58,237,.15)", border: "1px solid rgba(124,58,237,.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <GalleryHorizontalEnd style={{ width: 12, height: 12, color: "#a78bfa" }} />
        </div>
        <input
          key={node.carousel.name}
          defaultValue={node.carousel.name}
          onMouseDown={e => e.stopPropagation()}
          onBlur={e => onRenameCommit(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.85)" }}
        />
        <span style={{ fontSize: 9, color: "rgba(255,255,255,.3)", fontFamily: "monospace", flexShrink: 0 }}>{fmt.label}</span>
        <button onClick={onDownloadAll} disabled={!node.slides.some(s => s.thumbnail_url)} title="Baixar tudo"
          style={{ color: "rgba(255,255,255,.3)", cursor: "pointer", background: "none", border: "none", padding: 3, display: "flex" }} className="hover:text-white transition-colors">
          <Download style={{ width: 13, height: 13 }} />
        </button>
        <button onClick={onDeleteCarousel} title="Excluir carrossel"
          style={{ color: "rgba(255,255,255,.2)", cursor: "pointer", background: "none", border: "none", padding: 3, display: "flex" }} className="hover:text-red-400 transition-colors">
          <Trash2 style={{ width: 13, height: 13 }} />
        </button>
        <button onClick={onRemoveFromCanvas} title="Remover do canvas"
          style={{ color: "rgba(255,255,255,.2)", cursor: "pointer", background: "none", border: "none", padding: 3, display: "flex" }} className="hover:text-white transition-colors">
          <X style={{ width: 13, height: 13 }} />
        </button>
      </div>

      <div onMouseDown={e => e.stopPropagation()} style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {node.slides.map((slide, i) => (
          <SlideTile
            key={slide.id}
            slide={slide} index={i} total={node.slides.length} ratio={fmt.ratio}
            onOpen={() => onOpenSlide(slide.id)}
            onRemove={() => onRemoveSlide(slide)}
            onMove={dir => onMoveSlide(i, dir)}
            onUseAsReference={onUseAsReference}
            originalPrompt={node._batchPrompt ?? ""}
            onRegenerate={prompt => onRegenerateSlide(slide.id, prompt)}
          />
        ))}
        {node.slides.length < MAX_SLIDES && (
          <button onClick={onAddSlide}
            style={{ aspectRatio: fmt.ratio, borderRadius: 10, border: "1px dashed rgba(167,139,250,.3)", background: "rgba(124,58,237,.05)", color: "rgba(167,139,250,.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
            className="hover:bg-purple-500/[0.1] transition-colors">
            <Plus style={{ width: 16, height: 16 }} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── SlideTile — one slide in the storyboard grid, manual-edit or AI-generate ─── */
function SlideTile({
  slide, index, total, ratio, onOpen, onRemove, onMove,
  onUseAsReference, originalPrompt, onRegenerate,
}: {
  slide: Slide; index: number; total: number; ratio: string;
  onOpen: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onUseAsReference: (imageUrl: string) => void;
  originalPrompt: string;
  onRegenerate: (prompt: string) => Promise<void>;
}) {
  const previewUrl = slide.thumbnail_url ?? slide._seedUrl;
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const [regeneratePrompt, setRegeneratePrompt] = useState(originalPrompt);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const canRegenerate = Boolean(previewUrl && slide._sourceSlideUrl);

  const openRegeneratePrompt = () => {
    setRegeneratePrompt(originalPrompt);
    setRegenerateError(null);
    setShowRegeneratePrompt(true);
  };
  const confirmRegeneration = async () => {
    if (regenerating || !regeneratePrompt.trim()) return;
    setRegenerating(true);
    setRegenerateError(null);
    try {
      await onRegenerate(regeneratePrompt);
      setShowRegeneratePrompt(false);
    } catch (err) {
      setRegenerateError(err instanceof Error ? err.message : "Erro ao regenerar slide.");
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="group"
      onClick={onOpen}
      style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#0d0d11", cursor: "pointer", aspectRatio: ratio }}>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={`Slide ${index + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.12)" }}>
          <ImagePlus style={{ width: 16, height: 16 }} />
        </div>
      )}
      <span style={{ position: "absolute", top: 3, left: 3, fontSize: 8, fontWeight: 700, padding: "1px 4px", borderRadius: 8, background: "rgba(0,0,0,.6)", color: "rgba(255,255,255,.7)" }}>{index + 1}</span>
      <div className="opacity-0 group-hover:opacity-100" style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", transition: "opacity .15s" }}>
        <Pencil style={{ width: 13, height: 13, color: "white" }} />
      </div>
      {canRegenerate && (
        <button onClick={e => { e.stopPropagation(); openRegeneratePrompt(); }}
          className="opacity-0 group-hover:opacity-100"
          style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, 13px)", zIndex: 2, display: "flex", alignItems: "center", gap: 3, padding: "3px 6px", borderRadius: 7, background: "rgba(124,58,237,.8)", border: "1px solid rgba(196,181,253,.45)", color: "white", fontSize: 8, fontWeight: 700, cursor: "pointer", transition: "opacity .15s" }}>
          <Wand2 style={{ width: 8, height: 8 }} />
          Regenerar
        </button>
      )}
      <button onClick={e => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover:opacity-100"
        style={{ position: "absolute", top: 3, right: 3, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,.65)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "opacity .15s" }}>
        <X style={{ width: 9, height: 9 }} />
      </button>
      {index > 0 && (
        <button onClick={e => { e.stopPropagation(); onMove(-1); }}
          className="opacity-0 group-hover:opacity-100"
          style={{ position: "absolute", bottom: 3, left: 3, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,.65)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "opacity .15s" }}>
          <ChevronLeft style={{ width: 10, height: 10 }} />
        </button>
      )}
      {previewUrl && (
        <button onClick={e => { e.stopPropagation(); onUseAsReference(previewUrl); }}
          title="Usar como Referência"
          className="opacity-0 group-hover:opacity-100"
          style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,.65)", border: "none", color: "#4ade80", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "opacity .15s" }}>
          <ImageIcon style={{ width: 9, height: 9 }} />
        </button>
      )}
      {index < total - 1 && (
        <button onClick={e => { e.stopPropagation(); onMove(1); }}
          className="opacity-0 group-hover:opacity-100"
          style={{ position: "absolute", bottom: 3, right: 3, width: 16, height: 16, borderRadius: "50%", background: "rgba(0,0,0,.65)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "opacity .15s" }}>
          <ChevronRight style={{ width: 10, height: 10 }} />
        </button>
      )}
      {showRegeneratePrompt && canRegenerate && (
        <div
          onClick={e => e.stopPropagation()}
          style={{ position: "absolute", inset: 0, zIndex: 10, padding: 7, background: "rgba(9,9,14,.97)", display: "flex", flexDirection: "column", gap: 5, cursor: "default" }}
        >
          <textarea
            autoFocus
            value={regeneratePrompt}
            onChange={e => setRegeneratePrompt(e.target.value)}
            placeholder="Ex: faça a pessoa bem menor, só na lateral direita"
            disabled={regenerating}
            rows={3}
            style={{ width: "100%", minHeight: 0, flex: 1, resize: "none", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 6, padding: "5px 6px", fontSize: 9, lineHeight: 1.35, color: "rgba(255,255,255,.8)", outline: "none", fontFamily: "inherit" }}
            className="placeholder-white/25"
          />
          {regenerateError && (
            <p style={{ margin: 0, fontSize: 8, lineHeight: 1.25, color: "#f87171" }}>{regenerateError}</p>
          )}
          <div style={{ display: "flex", gap: 4 }}>
            <button
              onClick={() => { setShowRegeneratePrompt(false); setRegenerateError(null); }}
              disabled={regenerating}
              style={{ flex: 1, padding: "4px 0", borderRadius: 6, border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.04)", color: "rgba(255,255,255,.55)", fontSize: 8, fontWeight: 700, cursor: regenerating ? "not-allowed" : "pointer" }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmRegeneration}
              disabled={regenerating || !regeneratePrompt.trim()}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 3, padding: "4px 0", borderRadius: 6, border: "1px solid rgba(124,58,237,.4)", background: "rgba(124,58,237,.25)", color: "#c4b5fd", fontSize: 8, fontWeight: 700, cursor: regenerating || !regeneratePrompt.trim() ? "not-allowed" : "pointer", opacity: regenerating || !regeneratePrompt.trim() ? .5 : 1 }}
            >
              {regenerating && <Loader2 style={{ width: 9, height: 9, animation: "spin 1s linear infinite" }} />}
              {regenerating ? "Gerando..." : "Confirmar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Referência / Avatar connector cards — mirror CriativosView's
 * NodeRefCard/NodeAvatarCard visual language so both features feel the same. ── */
function RefConnectorCard({ ref_, onDelete, onChange }: {
  ref_: RefNode; onDelete: () => void; onChange: (p: Partial<RefNode>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ background: "#0d0d11", border: "1px solid rgba(74,222,128,.15)", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <ImageIcon style={{ width: 12, height: 12, color: "rgba(74,222,128,.5)", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", color: "rgba(74,222,128,.5)", textTransform: "uppercase", flex: 1 }}>Referência</span>
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
          <span style={{ fontSize: 9, color: "rgba(255,255,255,.15)" }}>Estilo/marca que a IA sempre deve seguir</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => {
        const f = e.target.files?.[0]; if (f) onChange({ dataUrl: await readFileAsDataUrl(f) });
        if (fileRef.current) fileRef.current.value = "";
      }} />
    </div>
  );
}

function AvatarConnectorCard({ avatar, onChange, onDelete }: {
  avatar: AvatarNode; onChange: (p: Partial<AvatarNode>) => void; onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div style={{ background: "#0d0d11", border: "1px solid rgba(251,191,36,.15)", borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,.4)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
        <User style={{ width: 12, height: 12, color: "rgba(251,191,36,.5)", flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", color: "rgba(251,191,36,.5)", textTransform: "uppercase", flex: 1 }}>Avatar</span>
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

/* ─── OutputNodeCard — one prompt can generate either one slide from the
 * automatic Referência image or a whole new carousel from the automatically
 * wired reference carousel (the first Carrossel node on the canvas — same
 * "first of type feeds every Gerar" mechanism as Referência/Avatar, no
 * manual picker). ── */
function OutputNodeCard({ output, refNodes, avatarNodes, carouselRefNode, onChange, onGenerate, onDelete }: {
  output: OutputNode;
  refNodes: RefNode[]; avatarNodes: AvatarNode[];
  carouselRefNode: CarouselNode | undefined;
  onChange: (patch: Partial<OutputNode>) => void;
  onGenerate: () => void;
  onDelete: () => void;
}) {
  const refNode = refNodes[0];
  const avatarNode = avatarNodes[0];
  const hasReferenceCarousel = !!carouselRefNode;
  const hasTarget = !!output.targetCarouselNodeId;
  const canGenerate = (hasReferenceCarousel || !!refNode?.dataUrl) && output.prompt.trim().length > 0 && !output.generating;

  return (
    <div style={{ background: "#09090e", border: "1px solid rgba(124,58,237,.35)", borderRadius: 14, overflow: "visible", boxShadow: "0 0 0 1px rgba(124,58,237,.08), 0 0 40px rgba(124,58,237,.10), 0 8px 40px rgba(0,0,0,.5)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid rgba(124,58,237,.15)", cursor: "grab" }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(124,58,237,.15)", border: "1px solid rgba(124,58,237,.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Wand2 style={{ width: 12, height: 12, color: "#a78bfa" }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.7)", flex: 1 }}>Gerar</span>
        <button onClick={onDelete} style={{ color: "rgba(255,255,255,.2)", cursor: "pointer", background: "none", border: "none", padding: 2, display: "flex" }} className="hover:text-red-400 transition-colors">
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>

      <div onMouseDown={e => e.stopPropagation()} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Referência / Avatar — automatic, no manual pairing: whichever
         * cards are on the canvas feed this generation, same as Criativos. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", background: "rgba(74,222,128,.06)", border: refNode?.dataUrl ? "1px solid rgba(74,222,128,.4)" : "1px dashed rgba(74,222,128,.25)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {refNode?.dataUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={refNode.dataUrl} alt="Referência" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <ImageIcon style={{ width: 14, height: 14, color: "rgba(74,222,128,.35)" }} />}
            </div>
            <span style={{ fontSize: 9, color: "rgba(74,222,128,.6)", fontWeight: 700 }}>Referência</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", background: "rgba(251,191,36,.06)", border: avatarNode?.dataUrl ? "1px solid rgba(251,191,36,.4)" : "1px dashed rgba(251,191,36,.2)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {avatarNode?.dataUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={avatarNode.dataUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                : <User style={{ width: 14, height: 14, color: "rgba(251,191,36,.3)" }} />}
            </div>
            <span style={{ fontSize: 9, color: "rgba(251,191,36,.5)", fontWeight: 700 }}>Avatar</span>
          </div>
          {carouselRefNode && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", background: "rgba(74,222,128,.06)", border: "1px solid rgba(74,222,128,.4)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {(() => {
                  const cover = carouselRefNode.slides.find(s => s.thumbnail_url)?.thumbnail_url;
                  return cover
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={cover} alt="Carrossel" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <GalleryHorizontalEnd style={{ width: 14, height: 14, color: "rgba(74,222,128,.35)" }} />;
                })()}
              </div>
              <span style={{ fontSize: 9, color: "rgba(74,222,128,.6)", fontWeight: 700 }}>Carrossel</span>
            </div>
          )}
        </div>
        {!hasReferenceCarousel && !refNode?.dataUrl && (
          <p style={{ fontSize: 9, color: "rgba(255,255,255,.3)", margin: 0, lineHeight: 1.4 }}>
            Adicione um nó Referência (imagem única) ou um Carrossel no canvas e conecte no Gerar — a IA nunca cria do zero, sempre parte dela.
          </p>
        )}

        {hasReferenceCarousel && (
          <p style={{ fontSize: 9, color: "rgba(74,222,128,.55)", margin: 0, lineHeight: 1.4 }}>
            Um novo carrossel será criado com um slide para cada imagem de &quot;{carouselRefNode!.carousel.name}&quot;.
          </p>
        )}

        {!hasReferenceCarousel && !hasTarget && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "rgba(255,255,255,.35)" }}>Formato</span>
            <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: 2 }}>
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => onChange({ newFormat: f.id })}
                  style={{ padding: "4px 8px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer",
                    background: output.newFormat === f.id ? "rgba(124,58,237,.25)" : "transparent",
                    color: output.newFormat === f.id ? "#a78bfa" : "rgba(255,255,255,.4)" }}>
                  {f.id}
                </button>
              ))}
            </div>
          </div>
        )}

        <textarea
          value={output.prompt}
          onChange={e => onChange({ prompt: e.target.value })}
          placeholder="O que muda neste slide — ex: troque a pessoa pelo avatar, mantenha o resto igual"
          rows={3}
          style={{ width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, padding: "8px 10px", fontSize: 12, lineHeight: 1.5, color: "rgba(255,255,255,.8)", outline: "none", resize: "vertical", fontFamily: "inherit" }}
          className="placeholder-white/25"
        />

        {output.error && <p style={{ fontSize: 10, color: "#f87171", margin: 0, lineHeight: 1.4 }}>{output.error}</p>}

        <button onClick={onGenerate} disabled={!canGenerate}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 10,
            background: canGenerate ? "rgba(124,58,237,.25)" : "rgba(255,255,255,.03)",
            border: canGenerate ? "1px solid rgba(124,58,237,.4)" : "1px solid rgba(255,255,255,.06)",
            color: canGenerate ? "#a78bfa" : "rgba(255,255,255,.2)",
            fontSize: 12, fontWeight: 700, cursor: canGenerate ? "pointer" : "not-allowed" }}>
          {output.generating ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Wand2 style={{ width: 14, height: 14 }} />}
          {output.generating ? "Gerando..." : "Gerar"}
        </button>
      </div>
    </div>
  );
}

/* ─── SeedCarouselCard — browsable reference example carousel ─── */
function SeedCarouselCard({ example, busy, onUse, onUseAsReference }: {
  example: SeedCarousel;
  busy: boolean;
  onUse: () => void;
  onUseAsReference: (imageUrl: string) => void;
}) {
  const [active, setActive] = useState(0);
  const fmt = formatOf(example.format);
  return (
    <div className="shrink-0 w-[220px] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-purple-500/30 transition-all bg-white/[0.02]">
      <div className="relative overflow-hidden" style={{ aspectRatio: fmt.ratio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={example.slides[active]} alt={`${example.name} — slide ${active + 1}`} className="w-full h-full object-cover" />
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 backdrop-blur-sm">
          <GalleryHorizontalEnd className="w-3 h-3 text-white/70" />
          <span className="text-[9px] font-bold text-white/70 font-mono">{active + 1}/{example.slides.length}</span>
        </div>
        {example.slides.length > 1 && (
          <>
            <button onClick={() => setActive(a => (a - 1 + example.slides.length) % example.slides.length)}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/80 cursor-pointer transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setActive(a => (a + 1) % example.slides.length)}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white/80 cursor-pointer transition-colors">
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div>
          <p className="text-[11px] font-semibold text-white/75 truncate">{example.name}</p>
          <p className="text-[9px] text-white/25 mt-0.5">{example.client} · {fmt.label}</p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={onUse} disabled={busy}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-500 text-white text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Usar como base
          </button>
          <button onClick={() => onUseAsReference(example.slides[active])}
            title="Usar slide atual como Referência"
            className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-emerald-400/20 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold cursor-pointer transition-colors">
            <ImageIcon className="w-3.5 h-3.5" /> Ref.
          </button>
        </div>
      </div>
    </div>
  );
}
