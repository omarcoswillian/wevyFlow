"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { composeTextLayer } from "../lib/text-overlay";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles, Download, Trash2, Loader2, AlertCircle, Check, RefreshCw,
  ImageIcon, User, ImagePlus, X, Pencil,
  Library, Wand2, Upload, Play, ChevronDown, MousePointer2, PenTool,
} from "lucide-react";
import { useAppContext } from "../(app)/_context";
import { useCopyDocuments } from "../lib/copy/useCopyDocuments";

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
  status?: string; project_id?: string | null;
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
interface AdLineage { sourceAdExternalId: string | null; hypothesis: string; analysisId: string; prompt: string }
interface GenResult  {
  id: string; label: string; status: "loading" | "done" | "error";
  dataUrl?: string; mimeType?: string; error?: string;
  /** The headline/instruction that produced this result — used to build a
   * readable download filename instead of "design-<timestamp>.png". */
  sourceText?: string;
  /** Headline/CTA aprovados aplicados em camada de texto (não desenhados pelo modelo). */
  copy?: { headline: string; cta: string };
  textLayer?: boolean;
  /** De qual anúncio, hipótese e análise esta peça veio (variações geradas a partir de Anúncios). */
  lineage?: AdLineage;
  /** Fundo sem texto (só em peças com camada de texto) — base pra derivar outros formatos sem gerar de novo. */
  bgDataUrl?: string;
  /** Avisos do controle de qualidade do servidor (ex.: texto residual no fundo). */
  warning?: string;
  /** Formato próprio da peça (derivadas diferem do formato selecionado no gerador). */
  format?: string;
}
interface CardPos { x: number; y: number; }
interface Viewport { x: number; y: number; scale: number; }
interface CtxMenu  { x: number; y: number; cx: number; cy: number; }

/* ─── Constants ──────────────────────────────────────────── */
const DOT_SIZE = 24;

const GEN_FORMATS: { id: string; label: string; w: number; h: number; pxW: number; pxH: number }[] = [
  { id: "1:1",  label: "1080×1080", w: 14,   h: 14,    pxW: 1080, pxH: 1080 },
  { id: "4:5",  label: "1080×1350", w: 14,   h: 17.5,  pxW: 1080, pxH: 1350 },
  { id: "9:16", label: "1080×1920", w: 9.5,  h: 17.5,  pxW: 1080, pxH: 1920 },
  { id: "16:9", label: "1920×1080", w: 20,   h: 11.25, pxW: 1920, pxH: 1080 },
];
const MAX_BATCH_JOBS = 24;
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
/** Turns a headline/prompt into a short filename-safe slug, e.g. "Chega de
 * enrolar: o teste..." → "chega-de-enrolar-o-teste" — so a downloaded image
 * says what's in it instead of "design-1789478163299.png". */
function slugifyForFilename(text: string, maxLen = 40): string {
  const slug = text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen)
    .replace(/-+$/, "");
  return slug || "wevyflow";
}
function buildImageFilename(sourceText: string | undefined, format: string, id: string): string {
  const slug = slugifyForFilename(sourceText || "wevyflow");
  const shortId = id.replace(/[^a-z0-9]/gi, "").slice(-6);
  return `wevyflow-${slug}-${format.replace(":", "x")}-${shortId}.png`;
}
async function downloadFromUrl(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) { alert("Não foi possível baixar essa imagem (arquivo indisponível no servidor)."); return; }
  const blob = await res.blob();
  if (blob.size === 0) { alert("Não foi possível baixar essa imagem (arquivo vazio no servidor)."); return; }
  const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/webp" ? "webp" : "png";
  const obj = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = obj; a.download = filename.replace(/\.png$/, `.${ext}`); a.click();
  URL.revokeObjectURL(obj);
}
let _refCtr = 0; let _avCtr = 0;
function nextRefLabel() { _refCtr++; return `img${_refCtr}`; }
function nextAvLabel()  { _avCtr++;  return `avatar${_avCtr}`; }

/* The Supabase dev session (marcoswill180@gmail.com, set via
 * /api/dev/auto-signin) expires hourly like any real session, but there's
 * no login form to re-trigger it in dev (see src/app/login/page.tsx) — so
 * a stale session used to mean re-generating everything after manually
 * revisiting that URL. Auto-heal instead: on a 401, silently re-signin and
 * retry once. Production always has a real session and never 401s here.
 *
 * Batch generation fires several requests in parallel, so several of them
 * can 401 at once — each independently re-running signInWithPassword races
 * the others and only the last Set-Cookie sticks, so earlier retries still
 * see a stale/half-rotated session. Share one in-flight re-auth call across
 * all of them instead of letting each job trigger its own. */
let devReauthInFlight: Promise<void> | null = null;
function ensureDevReauth(): Promise<void> {
  if (!devReauthInFlight) {
    devReauthInFlight = fetch("/api/dev/auto-signin")
      .then(() => {})
      .catch(() => {})
      .finally(() => { devReauthInFlight = null; });
  }
  return devReauthInFlight;
}

async function fetchWithDevAuth(url: string, body: object): Promise<Response> {
  const post = () => fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let res = await post();
  if (res.status === 401 && process.env.NODE_ENV === "development") {
    await ensureDevReauth();
    res = await post();
  }
  return res;
}

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
  // achado: essa chamada já existia, mas o valor era descartado — por isso
  // /api/generate-design (que exige projectId desde a Centralização de
  // Lançamentos, 2026-09-08) sempre falhava com "lançamento ativo" pra quem
  // abria Criativos pelo menu, mesmo já com um lançamento aberto em outra
  // aba/página desta mesma sessão.
  const { activeLaunchKit } = useAppContext();
  const launchProjectId = activeLaunchKit?.projectId ?? null;
  const supabase = createClient();
  const searchParams = useSearchParams();
  const serviceType  = searchParams.get("tipo") ?? "criativos";
  const serviceLabel = DESIGN_SERVICE_LABELS[serviceType] ?? "Criativos";

  const [mainTab, setMainTab] = useState<"gerar" | "biblioteca" | "galeria">(
    searchParams.get("tab") === "biblioteca" ? "biblioteca" : "gerar"
  );

  /* viewport (pan + zoom) */
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const viewportRef = useRef<Viewport>({ x: 0, y: 0, scale: 1 });
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  /* design gen state */
  const [references, setReferences] = useState<RefCard[]>([]);
  const [avatars,    setAvatars]    = useState<AvatarCard[]>([]);
  const [genPrompt,  setGenPrompt]  = useState("");
  // Set only when genPrompt was populated by the Copy picker (never by manual
  // typing) — lets the backend tell "this is a real headline+CTA pair" from
  // "this is a freeform instruction", so it can adapt the reference's copy
  // wholesale instead of guessing which fragment maps to which overlay. Any
  // manual edit after picking clears it, since we can no longer trust the split.
  const [genPromptCopy, setGenPromptCopy] = useState<{ headline: string; cta: string } | null>(null);
  const [genCount,   setGenCount]   = useState(1);
  const [genFormat,  setGenFormat]  = useState("9:16");
  const [genQuality, setGenQuality] = useState("2K");
  const [genResults, setGenResults] = useState<GenResult[]>([]);
  const [genRunning, setGenRunning] = useState(false);
  const [genBatchMode, setGenBatchMode] = useState(false);
  const [genBatchCopies, setGenBatchCopies] = useState<string[]>([""]);
  const [genBatchCopiesStructured, setGenBatchCopiesStructured] = useState<({ headline: string; cta: string } | null)[]>([null]);

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
  // Dentro de um lançamento ativo, a galeria mostra só as peças dele; "all" mostra tudo.
  const [galleryScope, setGalleryScope] = useState<"launch" | "all">("launch");
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
    let query = supabase
      .from("criativos")
      .select("id,format,url,headline,produto,created_at,status,project_id")
      .or(`produto.eq.${serviceType},produto.is.null`)
      .order("created_at", { ascending: false });
    if (galleryScope === "launch" && launchProjectId) query = query.eq("project_id", launchProjectId);
    const { data } = await query;
    if (data) setGallery(data as SavedCriativo[]);
  }, [supabase, serviceType, galleryScope, launchProjectId]);
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
  const addAsReference = useCallback(async (imageUrl: string) => {
    const res = await fetch(imageUrl);
    // fetch() não rejeita em 404/403 — sem isso, uma URL quebrada (ex: um
    // handoff externo pra uma imagem que sumiu) virava uma página de erro
    // HTML disfarçada de referência, sem nenhum aviso pro usuário.
    if (!res.ok) throw new Error(`Não foi possível carregar a imagem (HTTP ${res.status}).`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) throw new Error("O link não aponta para uma imagem.");
    const blob = await res.blob();
    if (blob.size === 0) throw new Error("A imagem veio vazia.");
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

  /* ── Consume a pending "usar como referência" handoff from another route
   * (ex: Anúncios) — reads a one-shot sessionStorage payload and imports it
   * as a reference here. Removed BEFORE the await so React Strict Mode's
   * double-invoke of effects in dev can't import it twice. ── */
  const [pendingRefError, setPendingRefError] = useState<string | null>(null);
  const [adLineage, setAdLineage] = useState<AdLineage | null>(null);
  const [pendingAutorun, setPendingAutorun] = useState(false);
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem("wevyflow:pending-ad-reference");
      if (raw) sessionStorage.removeItem("wevyflow:pending-ad-reference");
    } catch { /* storage unavailable */ }
    if (!raw) return;
    (async () => {
      try {
        const payload = JSON.parse(raw!) as {
          url?: unknown;
          variants?: { prompt?: unknown; hypothesis?: unknown; analysisId?: unknown; sourceAdExternalId?: unknown; count?: unknown };
        };
        if (typeof payload.url !== "string" || !payload.url) throw new Error("Referência inválida.");
        await addAsReference(payload.url);
        const v = payload.variants;
        if (v && typeof v.prompt === "string" && v.prompt.trim()) {
          // Variações vindas de uma hipótese de Anúncios: a instrução entra pronta,
          // a linhagem vai junto e a geração dispara sozinha (o usuário já escolheu "gerar").
          setGenPrompt(v.prompt.trim());
          setGenPromptCopy(null);
          setGenCount(typeof v.count === "number" ? Math.max(1, Math.min(8, v.count)) : 3);
          setAdLineage({
            sourceAdExternalId: typeof v.sourceAdExternalId === "string" ? v.sourceAdExternalId : null,
            hypothesis: typeof v.hypothesis === "string" ? v.hypothesis : "",
            analysisId: typeof v.analysisId === "string" ? v.analysisId : "",
            prompt: v.prompt.trim(),
          });
          setPendingAutorun(true);
        }
      } catch (e) {
        setPendingRefError(e instanceof Error ? e.message : "Não foi possível importar a referência do anúncio.");
      }
    })();
  }, [addAsReference]);

  /* ── References ── */
  const updateReference = (id: string, patch: Partial<RefCard>) =>
    setReferences(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  const removeReference = (id: string) => setReferences(prev => prev.filter(r => r.id !== id));

  /* ── Avatars ── */
  const updateAvatar = (id: string, patch: Partial<AvatarCard>) =>
    setAvatars(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
  const removeAvatar = (id: string) => setAvatars(prev => prev.filter(a => a.id !== id));

  /* ── Generate ──
   * Non-batch: one job per reference image (× genCount variations each) —
   * so N references attached always yields N distinct outputs, one per style,
   * instead of collapsing onto whichever reference the backend picks first.
   * Batch mode: genBatchCopies holds one entry per copy block (a dedicated
   * field per copy, not a single textarea split on a typed "---" — that
   * separator was one typo away from silently merging everything into one
   * block). Each copy runs against every reference — lets someone paste a
   * list of headlines once instead of running "Gerar" one copy at a time. */
  const canGenerate = genBatchMode
    ? genBatchCopies.some(c => c.trim().length > 0)
    : genPrompt.trim().length > 0;

  const handleDesignGenerate = async () => {
    if (!canGenerate || genRunning) return;
    setGenRunning(true);

    const refImages = references.map(r => r.dataUrl).filter(Boolean) as string[];
    const avImages  = avatars.map(a => a.dataUrl).filter(Boolean) as string[];
    const variations = Math.max(1, Math.min(8, genCount));
    const fmt = GEN_FORMATS.find(f => f.id === genFormat) ?? GEN_FORMATS[2];

    type Instruction = { text: string; copy: { headline: string; cta: string } | null };
    const instructions: Instruction[] = genBatchMode
      ? genBatchCopies
          .map((s, i) => ({ text: s.trim(), copy: genBatchCopiesStructured[i] ?? null }))
          .filter(inst => inst.text.length > 0)
      : [{ text: genPrompt.trim(), copy: genPromptCopy }];

    type Job = { prompt: string; copy: { headline: string; cta: string } | null; refImage?: string; textLayer?: boolean };
    let jobs: Job[] = refImages.length > 0
      ? instructions.flatMap(instruction =>
          refImages.flatMap(ref =>
            Array.from({ length: variations }, () => ({ prompt: instruction.text, copy: instruction.copy, refImage: ref }))))
      : instructions.flatMap(instruction =>
          Array.from({ length: variations }, () => ({ prompt: instruction.text, copy: instruction.copy })));
    if (jobs.length > MAX_BATCH_JOBS) jobs = jobs.slice(0, MAX_BATCH_JOBS);

    // Texto como camada: geração do zero + headline/CTA aprovados + lançamento
    // ativo (precisa da fonte/cor da marca) = o modelo gera só o fundo e o
    // texto entra exato pelo canvas. Com referência, o modelo continua
    // adaptando o texto da própria referência (fidelidade a ela).
    jobs = jobs.map(job => ({ ...job, textLayer: Boolean(!job.refImage && job.copy && activeLaunchKit) }));

    // Pré-checagem de créditos do lote: evita disparar dezenas de gerações
    // que vão falhar no meio por falta de saldo.
    const costPerJob = avImages.length > 0 ? 4 : 2;
    try {
      const usageRes = await fetch("/api/usage");
      if (usageRes.ok) {
        const usage = await usageRes.json() as { remaining?: number };
        if (typeof usage.remaining === "number") {
          const affordable = Math.floor(usage.remaining / costPerJob);
          if (affordable <= 0) {
            setPendingRefError(`Créditos insuficientes: cada peça custa ${costPerJob} créditos e você tem ${usage.remaining}.`);
            setGenRunning(false);
            return;
          }
          if (jobs.length > affordable) {
            setPendingRefError(`Gerando ${affordable} de ${jobs.length} peças: seus créditos restantes (${usage.remaining}) cobrem só isso (${costPerJob} créditos por peça).`);
            jobs = jobs.slice(0, affordable);
          }
        }
      }
    } catch { /* sem a checagem o servidor ainda barra por crédito */ }

    const placeholders: GenResult[] = jobs.map((job, i) => ({
      id: crypto.randomUUID(), label: `img${Date.now()}-${i + 1}`, status: "loading" as const,
      sourceText: job.copy?.headline || job.prompt,
      // A linhagem só vale enquanto a instrução é a mesma da hipótese; se o usuário
      // editou o prompt, a peça deixou de ser "a variação dessa hipótese".
      lineage: adLineage && job.prompt === adLineage.prompt ? adLineage : undefined,
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
    // No máximo 4 gerações simultâneas: um lote de 24 não vira 24 chamadas
    // paralelas (estoura rate limit do provedor e dispara custo de uma vez).
    const runPool = async <T,>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) => {
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) { const idx = next++; await worker(items[idx], idx); }
      }));
    };
    await runPool(placeholders, 4, async (ph, i) => {
      const job = jobs[i];
      try {
        const res = await fetchWithDevAuth("/api/generate-design", {
          projectId: activeLaunchKit?.projectId,
          prompt: job.prompt,
          copy: job.copy ?? undefined,
          textLayer: job.textLayer || undefined,
          referenceImages: job.refImage ? [job.refImage] : [],
          avatarImages: avImages,
          format: genFormat,
          quality: genQuality,
          targetWidth: fmt.pxW,
          targetHeight: fmt.pxH,
        });
        const json = await res.json() as { error?: string; b64?: string; mimeType?: string; qualityWarnings?: string[] };
        if (!res.ok) throw new Error(json.error || "Erro ao gerar.");
        if (!json.b64 || !json.mimeType) throw new Error("Imagem não retornada.");
        let dataUrl = `data:${json.mimeType};base64,${json.b64}`;
        let mimeType = json.mimeType;
        let textLayerApplied = false;
        let bgDataUrl: string | undefined;
        if (job.textLayer && job.copy && activeLaunchKit) {
          const b = activeLaunchKit.briefing;
          const composed = await composeTextLayer({
            imageUrl: dataUrl,
            headline: job.copy.headline,
            cta: job.copy.cta,
            fontChoice: b.fontChoice,
            primaryColor: b.primaryColor,
            light: b.stylePreset === "light-clean",
            safeVertical: genFormat === "9:16",
          });
          bgDataUrl = dataUrl;
          dataUrl = composed.dataUrl;
          mimeType = composed.mimeType;
          textLayerApplied = true;
        }
        setGenResults(prev => prev.map(r => r.id === ph.id ? {
          ...r, status: "done", dataUrl, mimeType,
          copy: job.copy ?? undefined, textLayer: textLayerApplied, bgDataUrl, format: genFormat,
          warning: json.qualityWarnings?.[0],
        } : r));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro.";
        setGenResults(prev => prev.map(r => r.id === ph.id ? { ...r, status: "error", error: msg } : r));
      }
    });
    setGenRunning(false);
  };
  // Disparo automático das variações vindas de Anúncios: espera a referência carregar.
  useEffect(() => {
    if (!pendingAutorun || genRunning) return;
    if (references.some(r => r.dataUrl) && genPrompt.trim()) {
      setPendingAutorun(false);
      handleDesignGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAutorun, references, genPrompt, genRunning]);

  const removeResult = (id: string) => setGenResults(prev => prev.filter(r => r.id !== id));

  /* ── Refine a single result in place ──
   * Reuses the same EDIT MODE path as the main generator (one reference
   * image, an instruction) instead of asking the model to start over — the
   * already-generated image becomes the sole reference, so only what the
   * instruction mentions changes. */
  const handleRefineResult = useCallback(async (result: GenResult, instruction: string) => {
    if (!result.dataUrl || !instruction.trim()) return;
    const fmt = GEN_FORMATS.find(f => f.id === genFormat) ?? GEN_FORMATS[2];
    setGenResults(prev => prev.map(r => r.id === result.id ? { ...r, status: "loading" as const } : r));
    try {
      const res = await fetchWithDevAuth("/api/generate-design", {
        projectId: activeLaunchKit?.projectId,
        prompt: instruction,
        referenceImages: [result.dataUrl],
        avatarImages: [],
        format: genFormat,
        quality: genQuality,
        targetWidth: fmt.pxW,
        targetHeight: fmt.pxH,
      });
      const json = await res.json() as { error?: string; b64?: string; mimeType?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao ajustar.");
      if (!json.b64 || !json.mimeType) throw new Error("Imagem não retornada.");
      const dataUrl = `data:${json.mimeType};base64,${json.b64}`;
      setGenResults(prev => prev.map(r => r.id === result.id ? { ...r, status: "done", dataUrl, mimeType: json.mimeType, textLayer: false } : r));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro.";
      setGenResults(prev => prev.map(r => r.id === result.id ? { ...r, status: "error", error: msg } : r));
    }
  }, [genFormat, genQuality, activeLaunchKit]);

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

  /* ── Derivar formatos ──
   * A partir de um master com camada de texto, gera os outros formatos sem
   * chamar a IA (zero crédito): recorta o fundo sem texto e recompõe a
   * headline/CTA exatas. */
  const handleDeriveFormats = useCallback(async (result: GenResult) => {
    if (!result.bgDataUrl || !result.copy || !activeLaunchKit) return;
    const b = activeLaunchKit.briefing;
    const baseFormat = result.format ?? genFormat;
    const targets = GEN_FORMATS.filter(f => f.id !== baseFormat);
    const created: GenResult[] = [];
    for (const f of targets) {
      try {
        const composed = await composeTextLayer({
          imageUrl: result.bgDataUrl,
          headline: result.copy.headline,
          cta: result.copy.cta,
          fontChoice: b.fontChoice,
          primaryColor: b.primaryColor,
          light: b.stylePreset === "light-clean",
          safeVertical: f.pxH / f.pxW > 1.5,
          targetWidth: f.pxW,
          targetHeight: f.pxH,
        });
        created.push({
          id: crypto.randomUUID(), label: `${result.label.slice(0, 8)}-${f.id.replace(":", "x")}`,
          status: "done", dataUrl: composed.dataUrl, mimeType: composed.mimeType,
          sourceText: result.sourceText, copy: result.copy, textLayer: true,
          bgDataUrl: result.bgDataUrl, format: f.id,
        });
      } catch { /* formato que falhar simplesmente não entra */ }
    }
    if (created.length === 0) return;
    setGenResults(prev => [...prev, ...created]);
    setPositions(prev => {
      const next = { ...prev };
      const gPos = positionsRef.current["gerar"] || { x: 0, y: 0 };
      const offset = genResults.length;
      created.forEach((c, i) => {
        const idx = offset + i;
        next[c.id] = { x: gPos.x + 430 + (idx % 2) * 260, y: gPos.y + Math.floor(idx / 2) * 290 };
      });
      return next;
    });
  }, [activeLaunchKit, genFormat, genResults.length]);

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
      await supabase.from("criativos").insert({
        user_id: user.id, url: publicUrl, format: result.format ?? genFormat,
        headline: (result.copy?.headline ?? genPrompt).slice(0, 200) || null,
        produto: serviceType,
        project_id: launchProjectId,
        copy_headline: result.copy?.headline ?? null,
        copy_cta: result.copy?.cta ?? null,
        text_layer: Boolean(result.textLayer),
        source_ad_external_id: result.lineage?.sourceAdExternalId ?? null,
        hypothesis: result.lineage?.hypothesis || null,
        analysis_id: result.lineage?.analysisId || null,
      });
      await supabase.from("creative_library").insert({ user_id: user.id, url: publicUrl, name: `${serviceLabel} — ${new Date().toLocaleDateString("pt-BR")}`, format: genFormat, tags: [serviceType] });
      await loadGallery();
      await loadLibrary();
    } catch { /* silently fail */ }
  }, [supabase, serviceType, serviceLabel, genFormat, genPrompt, launchProjectId, loadGallery, loadLibrary]);

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

      {pendingRefError && (
        <div className="shrink-0 mx-8 mt-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-[11px] text-red-300 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {pendingRefError}</p>
          <button onClick={() => setPendingRefError(null)} className="text-red-400/60 hover:text-red-300 cursor-pointer shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── Tab bar ─────────────────────────── */}
      <div className="px-8 pt-6 pb-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-[15px] font-semibold text-white/70 tracking-tight">{serviceLabel}</h2>
          {launchProjectId && (
            <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.07] rounded-lg p-0.5">
              {([["launch", activeLaunchKit?.brandInfo.productName || "Este lançamento"], ["all", "Todos"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setGalleryScope(id)}
                  className={cn("px-2.5 py-1 rounded-md text-[10px] font-semibold max-w-[160px] truncate cursor-pointer transition-all",
                    galleryScope === id ? "bg-white/[0.1] text-white" : "text-white/35 hover:text-white/60")}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
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
                      promptCopy={genPromptCopy} onChangePromptCopy={setGenPromptCopy}
                      references={references} avatars={avatars}
                      genCount={genCount} setGenCount={setGenCount}
                      genFormat={genFormat} setGenFormat={setGenFormat}
                      genQuality={genQuality} setGenQuality={setGenQuality}
                      genBatchMode={genBatchMode} setGenBatchMode={setGenBatchMode}
                      genBatchCopies={genBatchCopies} setGenBatchCopies={setGenBatchCopies}
                      genBatchCopiesStructured={genBatchCopiesStructured} setGenBatchCopiesStructured={setGenBatchCopiesStructured}
                      canGenerate={canGenerate}
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
                    <NodeResultCard result={result} format={result.format ?? genFormat} onDerive={result.bgDataUrl && result.copy ? () => handleDeriveFormats(result) : undefined} onDelete={() => removeResult(result.id)} onUsar={() => handleUsarResult(result)} onRefine={instruction => handleRefineResult(result, instruction)} />
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
                onUseAsReference={addAsReference}
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
                  onUseAsReference={addAsReference}
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
                          <button onClick={() => addAsReference(criativo.url)} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-purple-600/80 backdrop-blur-sm text-white text-[11px] font-semibold cursor-pointer hover:bg-purple-500 transition-colors"><ImageIcon className="w-3.5 h-3.5" /> Usar como referencia</button>
                          <div className="flex gap-2">
                            <button onClick={() => downloadFromUrl(criativo.url, buildImageFilename(criativo.headline || criativo.produto || undefined, criativo.format, criativo.id))} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm text-white/80 text-[11px] cursor-pointer hover:bg-white/20 transition-colors"><Download className="w-3.5 h-3.5" /> Baixar</button>
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
  prompt, onChange, promptCopy, onChangePromptCopy, references, avatars,
  genCount, setGenCount, genFormat, setGenFormat, genQuality, setGenQuality,
  genBatchMode, setGenBatchMode, genBatchCopies, setGenBatchCopies,
  genBatchCopiesStructured, setGenBatchCopiesStructured,
  canGenerate, genRunning, onGenerate, isDragging, onDragStart,
}: {
  prompt: string; onChange: (v: string) => void;
  promptCopy: { headline: string; cta: string } | null; onChangePromptCopy: (v: { headline: string; cta: string } | null) => void;
  references: RefCard[]; avatars: AvatarCard[];
  genCount: number; setGenCount: (n: number) => void;
  genFormat: string; setGenFormat: (v: string) => void;
  genQuality: string; setGenQuality: (v: string) => void;
  genBatchMode: boolean; setGenBatchMode: (v: boolean) => void;
  genBatchCopies: string[]; setGenBatchCopies: (v: string[]) => void;
  genBatchCopiesStructured: ({ headline: string; cta: string } | null)[]; setGenBatchCopiesStructured: (v: ({ headline: string; cta: string } | null)[]) => void;
  canGenerate: boolean;
  genRunning: boolean; onGenerate: () => void;
  isDragging: boolean; onDragStart: (e: React.MouseEvent) => void;
}) {
  const batchCopiesCount = genBatchCopies.filter(c => c.trim()).length;
  const toggleBatch = () => {
    if (!genBatchMode && genBatchCopies.every(c => !c.trim()) && prompt.trim()) {
      // Turning batch on with an empty list — carry over whatever was
      // already typed in the single-prompt field instead of discarding it.
      setGenBatchCopies([prompt]);
      setGenBatchCopiesStructured([promptCopy]);
    }
    setGenBatchMode(!genBatchMode);
  };
  // Manual edits can no longer be trusted to be a clean headline+CTA split —
  // fall back to the freeform surgical-edit path (unchanged prior behavior).
  const handleManualChange = (v: string) => { onChange(v); onChangePromptCopy(null); };
  const handlePick = ({ headline, cta }: { headline: string; cta: string }) => {
    const text = `${headline}\n${cta}`;
    onChange(prompt.trim() ? `${prompt}\n${text}` : text);
    onChangePromptCopy(prompt.trim() ? null : { headline, cta }); // appending onto existing text also breaks the clean split
  };
  return (
    <div style={{ background: "#09090e", border: "1px solid rgba(124,58,237,.35)", borderRadius: 14, overflow: "visible", boxShadow: "0 0 0 1px rgba(124,58,237,.08), 0 0 40px rgba(124,58,237,.10), 0 8px 40px rgba(0,0,0,.5)", cursor: isDragging ? "grabbing" : "default" }}>
      <div onMouseDown={onDragStart} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderBottom: "1px solid rgba(124,58,237,.15)", cursor: isDragging ? "grabbing" : "grab" }}>
        <div style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(124,58,237,.15)", border: "1px solid rgba(124,58,237,.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Wand2 style={{ width: 12, height: 12, color: "#a78bfa" }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.7)", flex: 1 }}>Gerar Imagem</span>
        <button
          onClick={toggleBatch}
          onMouseDown={e => e.stopPropagation()}
          title="Modo lote: uma copy por campo, gera todas contra todas as referências"
          style={{
            display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 7,
            background: genBatchMode ? "rgba(124,58,237,.22)" : "rgba(255,255,255,.04)",
            border: genBatchMode ? "1px solid rgba(167,139,250,.4)" : "1px solid rgba(255,255,255,.08)",
            color: genBatchMode ? "#a78bfa" : "rgba(255,255,255,.35)",
            fontSize: 10, fontWeight: 700, cursor: "pointer", transition: "all .15s",
          }}
        >
          Lote{genBatchMode && batchCopiesCount > 0 ? ` (${batchCopiesCount})` : ""}
        </button>
      </div>
      {genBatchMode ? (
        <BatchCopyList
          copies={genBatchCopies} onChange={setGenBatchCopies}
          copiesStructured={genBatchCopiesStructured} onChangeStructured={setGenBatchCopiesStructured}
        />
      ) : (
        <div onMouseDown={e => e.stopPropagation()} style={{ position: "relative", minHeight: 180 }}>
          <MentionTextarea value={prompt} onChange={handleManualChange} references={references} avatars={avatars} />
          <div style={{ position: "absolute", bottom: 10, right: 12 }}>
            <CopyPickerButton onPick={handlePick} />
          </div>
        </div>
      )}
      <div onMouseDown={e => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderTop: "1px solid rgba(124,58,237,.12)", flexWrap: "wrap" }}>
        <CountPill count={genCount} setCount={setGenCount} />
        <FormatSelector value={genFormat} onChange={setGenFormat} />
        <QualityToggle value={genQuality} onChange={setGenQuality} />
        <button onClick={onGenerate} disabled={!canGenerate || genRunning}
          style={{ marginLeft: "auto", width: 36, height: 36, borderRadius: 10, background: (canGenerate && !genRunning) ? "rgba(124,58,237,.25)" : "rgba(255,255,255,.03)", border: (canGenerate && !genRunning) ? "1px solid rgba(124,58,237,.4)" : "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: (canGenerate && !genRunning) ? "pointer" : "not-allowed", color: (canGenerate && !genRunning) ? "#a78bfa" : "rgba(255,255,255,.12)", flexShrink: 0, transition: "all .15s" }}>
          {genRunning ? <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> : <Play style={{ width: 13, height: 13, marginLeft: 1 }} />}
        </button>
        {references.length > 0 && (
          <p style={{ width: "100%", fontSize: 9, color: "rgba(255,255,255,.25)", margin: 0 }}>
            {genBatchMode
              ? `${Math.max(batchCopiesCount, 1)} copy(s) × ${references.length} referência(s) × ${genCount} variação(ões)`
              : `${references.length} referência(s) × ${genCount} variação(ões) = ${references.length * genCount} imagem(ns)`}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Copy picker — autofill from an approved/saved Copy document ───────
   Simple by design: picking a document inserts its chosen option (or the
   first one, if the user hasn't picked yet) as "headline\ncta". No
   two-level option picker, no live sync back to Copy if it changes later
   — see memória project-copy-vs-design-architecture for the fuller plan. */
function CopyPickerButton({ onPick, openDirection = "up" }: { onPick: (result: { headline: string; cta: string }) => void; openDirection?: "up" | "down" }) {
  const { documents, loading } = useCopyDocuments();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const pick = (doc: ReturnType<typeof useCopyDocuments>["documents"][number]) => {
    const opt = doc.selected || doc.options[0];
    if (opt) onPick({ headline: opt.headline, cta: opt.cta });
    setOpen(false);
  };

  return (
    <div ref={ref} onMouseDown={e => e.stopPropagation()} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Usar copy salva"
        style={{ width: 28, height: 28, borderRadius: 8, background: open ? "rgba(124,58,237,.18)" : "rgba(255,255,255,.04)", border: open ? "1px solid rgba(167,139,250,.4)" : "1px solid rgba(255,255,255,.07)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: open ? "#a78bfa" : "rgba(255,255,255,.25)", flexShrink: 0 }}
        className="hover:text-purple-400 hover:border-purple-500/30 hover:bg-purple-500/[0.08] transition-colors"
      >
        <PenTool style={{ width: 12, height: 12 }} />
      </button>
      {open && (
        <div style={{ position: "absolute", ...(openDirection === "up" ? { bottom: "calc(100% + 6px)" } : { top: "calc(100% + 6px)" }), right: 0, width: 240, maxHeight: 260, overflowY: "auto", background: "#141418", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, boxShadow: "0 12px 32px rgba(0,0,0,.5)", zIndex: 20, padding: 6 }}>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".07em", color: "rgba(255,255,255,.25)", textTransform: "uppercase", padding: "4px 8px 6px" }}>Copy salva</p>
          {loading ? (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.3)", padding: "6px 8px" }}>Carregando...</p>
          ) : documents.length === 0 ? (
            <p style={{ fontSize: 11, color: "rgba(255,255,255,.3)", padding: "6px 8px", lineHeight: 1.4 }}>Nenhuma copy salva ainda. Gere uma na aba Copy.</p>
          ) : (
            documents.map(doc => (
              <button
                key={doc.id}
                onClick={() => pick(doc)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, width: "100%", padding: "7px 8px", borderRadius: 7, background: "transparent", border: "none", color: "rgba(255,255,255,.7)", fontSize: 11, textAlign: "left", cursor: "pointer" }}
                className="hover:bg-white/[0.06] transition-colors"
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</span>
                {doc.status === "approved" && <Check style={{ width: 11, height: 11, color: "#34d399", flexShrink: 0 }} />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function BatchCopyList({ copies, onChange, copiesStructured, onChangeStructured }: {
  copies: string[]; onChange: (v: string[]) => void;
  copiesStructured: ({ headline: string; cta: string } | null)[]; onChangeStructured: (v: ({ headline: string; cta: string } | null)[]) => void;
}) {
  const update = (i: number, v: string) => onChange(copies.map((c, idx) => idx === i ? v : c));
  // Manual typing invalidates the structured pair for that row (see handleManualChange above).
  const updateManual = (i: number, v: string) => {
    update(i, v);
    onChangeStructured(copiesStructured.map((c, idx) => idx === i ? null : c));
  };
  const pick = (i: number, { headline, cta }: { headline: string; cta: string }) => {
    const existing = copies[i] ?? "";
    update(i, existing.trim() ? `${existing}\n${headline}\n${cta}` : `${headline}\n${cta}`);
    onChangeStructured(copiesStructured.map((c, idx) => idx === i ? (existing.trim() ? null : { headline, cta }) : c));
  };
  const remove = (i: number) => {
    onChange(copies.length > 1 ? copies.filter((_, idx) => idx !== i) : [""]);
    onChangeStructured(copiesStructured.length > 1 ? copiesStructured.filter((_, idx) => idx !== i) : [null]);
  };
  const add = () => { onChange([...copies, ""]); onChangeStructured([...copiesStructured, null]); };
  return (
    <div onMouseDown={e => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, maxHeight: 320, overflowY: "auto" }}>
      {copies.map((copy, i) => (
        <div key={i} style={{ position: "relative", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", color: "rgba(167,139,250,.55)", textTransform: "uppercase" }}>Copy {i + 1}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <CopyPickerButton openDirection="down" onPick={(result) => pick(i, result)} />
              <button onClick={() => remove(i)} style={{ color: "rgba(255,255,255,.2)", cursor: "pointer", background: "none", border: "none", padding: 2, lineHeight: 1, display: "flex" }} className="hover:text-red-400 transition-colors">
                <X style={{ width: 12, height: 12 }} />
              </button>
            </div>
          </div>
          <textarea
            value={copy}
            onChange={e => updateManual(i, e.target.value)}
            placeholder="Cole a copy desta variação aqui..."
            rows={3}
            style={{
              width: "100%", padding: "8px 10px", fontSize: 12, lineHeight: 1.5,
              fontFamily: "inherit", color: "rgba(255,255,255,.75)",
              background: "transparent", border: "none", outline: "none", resize: "vertical",
            }}
            className="placeholder-white/[0.2]"
          />
        </div>
      ))}
      <button
        onClick={add}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "8px 0", borderRadius: 10, border: "1px dashed rgba(167,139,250,.3)",
          background: "rgba(124,58,237,.06)", color: "rgba(167,139,250,.7)",
          fontSize: 11, fontWeight: 600, cursor: "pointer",
        }}
        className="hover:bg-purple-500/[0.1] transition-colors"
      >
        + Adicionar copy
      </button>
    </div>
  );
}

function NodeResultCard({ result, format, onDerive, onDelete, onUsar, onRefine }: {
  result: GenResult; format: string; onDerive?: () => void; onDelete: () => void; onUsar: () => void; onRefine: (instruction: string) => void;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const [adjustText, setAdjustText] = useState("");
  const submitAdjust = () => {
    if (!adjustText.trim()) return;
    onRefine(adjustText);
    setAdjustText("");
    setAdjusting(false);
  };
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
          {result.warning && (
            <p style={{ margin: 0, padding: "6px 10px", fontSize: 10, lineHeight: 1.4, color: "rgba(251,191,36,.85)", background: "rgba(251,191,36,.08)" }}>{result.warning}</p>
          )}
          {adjusting ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: 8 }} onMouseDown={e => e.stopPropagation()}>
              <textarea
                autoFocus
                value={adjustText}
                onChange={e => setAdjustText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitAdjust(); } if (e.key === "Escape") setAdjusting(false); }}
                placeholder="O que mudar? Ex.: troque só o botão para verde"
                rows={2}
                style={{ width: "100%", padding: "6px 8px", fontSize: 11, lineHeight: 1.4, fontFamily: "inherit", color: "rgba(255,255,255,.8)", background: "rgba(255,255,255,.04)", border: "1px solid rgba(124,58,237,.3)", borderRadius: 7, outline: "none", resize: "vertical" }}
                className="placeholder-white/[0.2]"
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { setAdjusting(false); setAdjustText(""); }}
                  style={{ flex: 1, padding: "6px 0", borderRadius: 7, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", color: "rgba(255,255,255,.4)", fontSize: 10, cursor: "pointer" }}
                  className="hover:text-white hover:bg-white/[0.07] transition-colors">
                  Cancelar
                </button>
                <button onClick={submitAdjust} disabled={!adjustText.trim()}
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 0", borderRadius: 7, background: adjustText.trim() ? "rgba(124,58,237,.25)" : "rgba(255,255,255,.03)", border: adjustText.trim() ? "1px solid rgba(124,58,237,.4)" : "1px solid rgba(255,255,255,.06)", color: adjustText.trim() ? "#a78bfa" : "rgba(255,255,255,.15)", fontSize: 10, cursor: adjustText.trim() ? "pointer" : "not-allowed" }}>
                  <Sparkles style={{ width: 11, height: 11 }} /> Aplicar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 6, padding: 8 }} onMouseDown={e => e.stopPropagation()}>
              <button onClick={() => downloadDataUrl(result.dataUrl!, buildImageFilename(result.sourceText, format, result.id))}
                title="Baixar"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "6px 8px", borderRadius: 7, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", color: "rgba(255,255,255,.4)", fontSize: 10, cursor: "pointer" }}
                className="hover:text-white hover:bg-white/[0.07] transition-colors">
                <Download style={{ width: 12, height: 12 }} />
              </button>
              <button onClick={() => setAdjusting(true)}
                title="Ajustar só uma parte, sem gerar do zero"
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 0", borderRadius: 7, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", color: "rgba(255,255,255,.55)", fontSize: 10, cursor: "pointer" }}
                className="hover:text-white hover:bg-white/[0.07] transition-colors">
                <Pencil style={{ width: 11, height: 11 }} /> Ajustar
              </button>
              {onDerive && (
                <button onClick={onDerive}
                  title="Gera os outros formatos a partir desta peça, sem gastar créditos"
                  style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 0", borderRadius: 7, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", color: "rgba(255,255,255,.55)", fontSize: 10, cursor: "pointer" }}
                  className="hover:text-white hover:bg-white/[0.07] transition-colors">
                  <ImagePlus style={{ width: 11, height: 11 }} /> Formatos
                </button>
              )}
              <button onClick={onUsar} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px 0", borderRadius: 7, background: "rgba(124,58,237,.08)", border: "1px solid rgba(124,58,237,.2)", color: "rgba(167,139,250,.7)", fontSize: 10, cursor: "pointer" }}
                className="hover:bg-purple-500/15 hover:text-purple-300 transition-colors">
                <Check style={{ width: 12, height: 12 }} /> Usar
              </button>
            </div>
          )}
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState<{ query: string; start: number } | null>(null);

  // A camada de destaque fica atrás do campo e precisa rolar junto com ele.
  const syncScroll = () => {
    if (overlayRef.current && textareaRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };
  useEffect(syncScroll, [value]);

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

  // As duas camadas (destaque e campo) precisam ter geometria IDÊNTICA: mesma
  // fonte, padding e largura útil, senão o texto/cursor desalinham do destaque.
  // Por isso nenhuma mostra barra de rolagem (a barra mudaria a largura útil de
  // uma só) e o destaque não usa padding horizontal (ver renderHighlighted).
  const STYLE: React.CSSProperties = {
    position: "absolute", inset: 0, padding: "14px 16px 44px",
    fontSize: 13, lineHeight: 1.65, letterSpacing: "normal",
    fontFamily: "ui-monospace,'JetBrains Mono','Fira Code',monospace",
    whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word",
    overflowY: "auto", scrollbarWidth: "none",
  };
  const renderHighlighted = (text: string) =>
    text.split(/(@(?:img|avatar)\d+)/g).map((part, i) => {
      if (/^@img\d+$/.test(part)) {
        const exists = !!references[parseInt(part.replace("@img", "")) - 1];
        return <mark key={i} style={{ background: exists ? "rgba(34,197,94,.18)" : "rgba(255,255,255,.05)", boxShadow: `0 0 0 2px ${exists ? "rgba(34,197,94,.18)" : "rgba(255,255,255,.05)"}`, color: exists ? "#4ade80" : "#6b7280", borderRadius: 3, padding: 0 }}>{part}</mark>;
      }
      if (/^@avatar\d+$/.test(part)) {
        const exists = !!avatars[parseInt(part.replace("@avatar", "")) - 1];
        return <mark key={i} style={{ background: exists ? "rgba(251,191,36,.15)" : "rgba(255,255,255,.05)", boxShadow: `0 0 0 2px ${exists ? "rgba(251,191,36,.15)" : "rgba(255,255,255,.05)"}`, color: exists ? "#fbbf24" : "#6b7280", borderRadius: 3, padding: 0 }}>{part}</mark>;
      }
      // Regular text: same color as the textarea so only the marks stand out
      return <span key={i} style={{ color: "rgba(255,255,255,.72)" }}>{part}</span>;
    });

  return (
    <div style={{ position: "relative", minHeight: 180 }}>
      {/* Highlight layer — sits behind the textarea and renders @mention chips.
          The textarea is fully transparent so only this layer is visible. */}
      <div ref={overlayRef} aria-hidden style={{ ...STYLE, overflow: "hidden", pointerEvents: "none", userSelect: "none" }}>
        {renderHighlighted(value + "​")}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onScroll={syncScroll}
        onKeyDown={e => {
          if (e.key === "Escape") setMentionQuery(null);
          if (e.key === "Enter" && suggestions.length > 0) {
            e.preventDefault();
            insertMention(suggestions[0].label);
          }
        }}
        placeholder={"Recrie a @img1 e substitua o homem\npelo @avatar1 e troque a frase por IA GEN"}
        style={{ ...STYLE, background: "transparent", color: "transparent", caretColor: "#a78bfa", resize: "none", outline: "none", border: "none" }}
        className="placeholder-white/[0.15] [&::-webkit-scrollbar]:hidden"
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
