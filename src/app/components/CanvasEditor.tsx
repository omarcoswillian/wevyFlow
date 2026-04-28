"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  X, Download, Loader2, ChevronLeft, Layers,
  Type, Square, Trash2, AlignLeft, AlignCenter, AlignRight, Italic,
  ImageIcon, Upload,
} from "lucide-react";
import type { CanvasTemplate, ObjDef } from "../lib/canvas-templates";

/* ─── Font loader ──────────────────────────────────────── */
const BASE_FONTS =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,300;1,400&family=Bebas+Neue&family=Montserrat:wght@400;600;700;900&family=Inter:wght@400;600;700&display=swap";

async function loadFonts() {
  if (document.getElementById("wf-canvas-fonts")) return;
  const link = document.createElement("link");
  link.id = "wf-canvas-fonts";
  link.rel = "stylesheet";
  link.href = BASE_FONTS;
  document.head.appendChild(link);
  await document.fonts.ready;
}

async function loadFontsFromObjects(objects: unknown[]) {
  const familyWeights = new Map<string, Set<string>>();
  for (const obj of objects) {
    const o = obj as Record<string, unknown>;
    const ff = o.fontFamily;
    const fw = o.fontWeight;
    if (typeof ff === "string") {
      if (!familyWeights.has(ff)) familyWeights.set(ff, new Set());
      familyWeights.get(ff)!.add(typeof fw === "string" ? fw : "400");
    }
  }

  const known = new Set(["Cormorant Garamond", "Bebas Neue", "Montserrat", "Inter"]);
  const extra = Array.from(familyWeights.keys()).filter((f) => !known.has(f));

  const loadSheet = (id: string, href: string) =>
    new Promise<void>((resolve) => {
      if (document.getElementById(id)) { resolve(); return; }
      const l = document.createElement("link");
      l.id = id; l.rel = "stylesheet"; l.href = href;
      l.onload = () => resolve();
      l.onerror = () => resolve();
      document.head.appendChild(l);
    });

  const sheets: Promise<void>[] = [loadSheet("wf-canvas-fonts", BASE_FONTS)];

  // Only load Google Fonts for families that aren't system fonts
  const SYSTEM_FONTS = new Set(["Helvetica Neue", "Helvetica", "Arial", "Arial Black",
    "Times New Roman", "Georgia", "Verdana", "Tahoma", "Trebuchet MS", "Impact",
    "Courier New", "system-ui", "-apple-system", "sans-serif", "serif", "monospace"]);
  const googleExtra = extra.filter((f) => !SYSTEM_FONTS.has(f));

  if (googleExtra.length > 0 && !document.getElementById("wf-canvas-fonts-dynamic")) {
    const params = googleExtra
      .map((f) => `family=${encodeURIComponent(f)}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400`)
      .join("&");
    sheets.push(loadSheet("wf-canvas-fonts-dynamic", `https://fonts.googleapis.com/css2?${params}&display=swap`));
  }

  await Promise.all(sheets);

  // Explicitly request each font variant so the browser downloads the actual font file
  const loads: Promise<unknown>[] = [];
  for (const [family, weights] of Array.from(familyWeights.entries())) {
    for (const weight of Array.from(weights)) {
      loads.push(document.fonts.load(`${weight} 40px "${family}"`).catch(() => {}));
    }
  }
  await Promise.allSettled(loads);
}

/* ─── Types ────────────────────────────────────────────── */
interface SelState {
  id: string | null;
  type: string;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  fill: string;
  textAlign: string;
  fillOpacity: string;
}
const EMPTY: SelState = {
  id: null, type: "", text: "", fontSize: 48,
  fontFamily: "Montserrat", fontWeight: "700", fontStyle: "normal",
  fill: "#ffffff", textAlign: "left", fillOpacity: "ff",
};

interface Props { template: CanvasTemplate; onClose: () => void; }

export function CanvasEditor({ template, onClose }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const fcRef        = useRef<any>(null);
  const fabRef       = useRef<any>(null);
  const bgInputRef   = useRef<HTMLInputElement>(null);
  const imgInputRef  = useRef<HTMLInputElement>(null);

  const [ready, setReady]     = useState(false);
  const [exporting, setExp]   = useState(false);
  const [sel, setSel]         = useState<SelState>(EMPTY);

  /* ── Compute display size ──────────────────────────────
     Keep the canvas at ~560px tall (or wide for 1:1),
     match aspect ratio, then use Fabric zoom.          */
  const TARGET_H = template.h === 1920 ? 580 : 560;
  const scale    = TARGET_H / template.h;
  const dispW    = Math.round(template.w * scale);
  const dispH    = TARGET_H;

  /* ── Helpers ───────────────────────────────────────── */
  const makeGrad = (fab: any, def: ObjDef, w: number, h: number) => {
    if (!def.gradient) return null;
    const rad = (def.gradient.angle * Math.PI) / 180;
    return new fab.Gradient({
      type: "linear",
      coords: {
        x1: w / 2 - (Math.cos(rad) * w) / 2,
        y1: h / 2 - (Math.sin(rad) * h) / 2,
        x2: w / 2 + (Math.cos(rad) * w) / 2,
        y2: h / 2 + (Math.sin(rad) * h) / 2,
      },
      colorStops: def.gradient.stops,
    });
  };

  /* ── Init ──────────────────────────────────────────── */
  useEffect(() => {
    if (!canvasRef.current) return;
    let fc: any;

    (async () => {
      const fab = await import("fabric");
      fabRef.current = fab;

      /* Create canvas at DISPLAY size — no CSS transforms */
      fc = new fab.Canvas(canvasRef.current!, {
        width: dispW,
        height: dispH,
        backgroundColor: template.bgColor,
        preserveObjectStacking: true,
      });

      fcRef.current = fc;

      if (template.fabricJson) {
        /* ── Figma-imported template: load via Fabric JSON ── */
        await loadFontsFromObjects((template.fabricJson as any).objects ?? []);
        await fc.loadFromJSON(template.fabricJson);
        /* Re-render after a brief tick in case any font finishes downloading late */
        setTimeout(() => fcRef.current?.renderAll(), 300);
        setTimeout(() => fcRef.current?.renderAll(), 1200);
      } else {
        /* ── Hand-coded template: build objects from ObjDef[] ── */
        await loadFonts();
        for (const def of template.objects) {
          let obj: any = null;

          if (def.type === "rect") {
            obj = new fab.Rect({
              originX: "left", originY: "top",
              left: def.left, top: def.top,
              width: def.width ?? 100, height: def.height ?? 100,
              rx: def.rx ?? 0, ry: def.ry ?? 0,
              fill: def.fill ?? "#cccccc",
              opacity: def.opacity ?? 1,
              selectable: def.selectable !== false,
              lockMovementX: def.lockMovementX ?? false,
              lockMovementY: def.lockMovementY ?? false,
              stroke: def.stroke ?? null,
              strokeWidth: def.strokeWidth ?? 0,
              name: def.id,
            });
            const grad = makeGrad(fab, def, def.width ?? 100, def.height ?? 100);
            if (grad) obj.set("fill", grad);

          } else if (def.type === "textbox") {
            obj = new fab.Textbox(def.text ?? "", {
              originX: "left", originY: "top",
              left: def.left, top: def.top,
              width: def.width ?? 400,
              fontSize: def.fontSize ?? 48,
              fontFamily: def.fontFamily ?? "Montserrat",
              fontWeight: def.fontWeight ?? "700",
              fontStyle: (def.fontStyle ?? "normal") as any,
              fill: def.fill ?? "#ffffff",
              textAlign: (def.textAlign ?? "left") as any,
              charSpacing: def.charSpacing ?? 0,
              lineHeight: def.lineHeight ?? 1.16,
              editable: true,
              selectable: true,
              name: def.id,
            });

          } else if (def.type === "line") {
            obj = new fab.Line(
              [def.x1 ?? 0, def.y1 ?? 0, def.x2 ?? 100, def.y2 ?? 0],
              {
                stroke: def.stroke ?? "#cccccc",
                strokeWidth: def.strokeWidth ?? 1,
                selectable: def.selectable !== false,
                name: def.id,
                left: def.left ?? def.x1 ?? 0,
                top: def.top ?? def.y1 ?? 0,
              }
            );
          }

          if (obj) fc.add(obj);
        }
      }

      /* Zoom viewport so 1080-space coords fit display */
      fc.setZoom(scale);

      /* Selection sync */
      const sync = (e?: any) => {
        const o = e?.selected?.[0] ?? fc.getActiveObject();
        if (!o) { setSel(EMPTY); return; }
        const isText = o.type === "textbox" || o.type === "i-text";
        setSel({
          id: o.name ?? null,
          type: o.type ?? "",
          text: isText ? (o.text ?? "") : "",
          fontSize: o.fontSize ?? 48,
          fontFamily: o.fontFamily ?? "Montserrat",
          fontWeight: o.fontWeight ?? "700",
          fontStyle: o.fontStyle ?? "normal",
          fill: typeof o.fill === "string" ? o.fill : "#ffffff",
          textAlign: o.textAlign ?? "left",
          fillOpacity: "ff",
        });
      };
      fc.on("selection:created", sync);
      fc.on("selection:updated", sync);
      fc.on("selection:cleared", () => setSel(EMPTY));
      fc.on("object:modified", sync);
      fc.on("text:changed", sync);

      fc.renderAll();
      setReady(true);
    })();

    return () => { fc?.dispose(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  /* ── Apply property to selected object ─────────────── */
  const apply = useCallback((prop: string, val: any) => {
    const o = fcRef.current?.getActiveObject();
    if (!o) return;
    o.set(prop as any, val);
    fcRef.current.renderAll();
    setSel((p) => ({ ...p, [prop]: val }));
  }, []);

  /* ── Add text ───────────────────────────────────────── */
  const addText = useCallback(() => {
    if (!fcRef.current || !fabRef.current) return;
    const t = new fabRef.current.Textbox("Novo texto", {
      originX: "left", originY: "top",
      left: 80, top: 80, width: 600,
      fontSize: 80, fontFamily: "Montserrat", fontWeight: "700",
      fill: "#ffffff", name: `text-${Date.now()}`,
    });
    fcRef.current.add(t);
    fcRef.current.setActiveObject(t);
    fcRef.current.renderAll();
  }, []);

  /* ── Add rect ───────────────────────────────────────── */
  const addRect = useCallback(() => {
    if (!fcRef.current || !fabRef.current) return;
    const r = new fabRef.current.Rect({
      originX: "left", originY: "top",
      left: 80, top: 80, width: 400, height: 100, rx: 16,
      fill: "#6c47ff", name: `rect-${Date.now()}`,
    });
    fcRef.current.add(r);
    fcRef.current.setActiveObject(r);
    fcRef.current.renderAll();
  }, []);

  /* ── Delete ─────────────────────────────────────────── */
  const del = useCallback(() => {
    const o = fcRef.current?.getActiveObject();
    if (o) { fcRef.current.remove(o); fcRef.current.renderAll(); setSel(EMPTY); }
  }, []);

  /* ── Replace background photo ───────────────────────── */
  const replaceBackground = useCallback((file: File) => {
    const fc = fcRef.current;
    const fab = fabRef.current;
    if (!fc || !fab) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const tw = template.w, th = template.h;
      const s = Math.max(tw / img.naturalWidth, th / img.naturalHeight);
      // crop to center
      const cropW = tw / s, cropH = th / s;
      const cropX = (img.naturalWidth  - cropW) / 2;
      const cropY = (img.naturalHeight - cropH) / 2;
      const bg = fc.getObjects().find((o: any) => o.name === "__background__");
      if (bg) fc.remove(bg);
      const fabImg = new fab.FabricImage(img, {
        originX: "left", originY: "top",
        left: 0, top: 0,
        cropX: Math.round(cropX), cropY: Math.round(cropY),
        width: Math.round(cropW), height: Math.round(cropH),
        scaleX: s, scaleY: s,
        selectable: false, evented: false,
        lockMovementX: true, lockMovementY: true,
        lockScalingX: true, lockScalingY: true,
        name: "__background__",
      });
      fc.insertAt(0, fabImg);
      fc.renderAll();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [template.w, template.h]);

  /* ── Replace selected image ─────────────────────────── */
  const replaceSelectedImage = useCallback((file: File) => {
    const o = fcRef.current?.getActiveObject();
    if (!o || o.type !== "image") return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      // Scale new image to match the object's displayed dimensions (w*scaleX, h*scaleY)
      const dispW = (o.width ?? img.naturalWidth) * (o.scaleX ?? 1);
      const dispH = (o.height ?? img.naturalHeight) * (o.scaleY ?? 1);
      const s = Math.max(dispW / img.naturalWidth, dispH / img.naturalHeight);
      const cropW = dispW / s, cropH = dispH / s;
      const cropX = (img.naturalWidth  - cropW) / 2;
      const cropY = (img.naturalHeight - cropH) / 2;
      o.setElement(img);
      o.set({
        width: Math.round(cropW), height: Math.round(cropH),
        cropX: Math.round(cropX), cropY: Math.round(cropY),
        scaleX: s, scaleY: s,
      });
      fcRef.current.renderAll();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  /* ── Export PNG at full 1080px resolution ───────────── */
  async function handleExport() {
    if (!fcRef.current) return;
    setExp(true);
    try {
      const dataUrl = fcRef.current.toDataURL({
        format: "png",
        multiplier: 1 / scale,   // up-scales back to template.w × template.h
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${template.id}-${Date.now()}.png`;
      a.click();
    } finally {
      setExp(false);
    }
  }

  const isText  = sel.type === "textbox" || sel.type === "i-text";
  const isRect  = sel.type === "rect";
  const isImage = sel.type === "image" && sel.id !== "__background__";
  const hasSel  = !!sel.id;

  return (
    <>
      <div className="fixed inset-0 z-[400] bg-black/80" onClick={onClose} />
      <div
        className="fixed inset-0 z-[401] flex flex-col bg-[#0e0e11] pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ───────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.07] shrink-0">
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-[14px] font-semibold text-white">{template.name}</span>
            <span className="ml-2 text-[11px] text-white/25">{template.w}×{template.h}px</span>
          </div>

          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            <button onClick={addText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-white/50 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-all">
              <Type className="w-3.5 h-3.5" /> Texto
            </button>
            <button onClick={addRect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] text-white/50 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-all">
              <Square className="w-3.5 h-3.5" /> Forma
            </button>
          </div>

          {hasSel && (
            <button onClick={del} title="Deletar"
              className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button onClick={handleExport} disabled={!ready || exporting}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all",
              ready && !exporting ? "bg-purple-600 hover:bg-purple-500 text-white cursor-pointer active:scale-[0.98]" : "bg-white/[0.05] text-white/20 cursor-not-allowed"
            )}>
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exporting ? "Exportando..." : "Baixar PNG"}
          </button>

          <button onClick={onClose} className="p-1.5 rounded-lg text-white/25 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Canvas area */}
          <div className="flex-1 bg-[#080a0c] flex items-center justify-center overflow-auto">
            {!ready && (
              <div className="flex flex-col items-center gap-3 text-white/30">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-[13px]">Carregando fontes e editor...</p>
              </div>
            )}
            {/* Exact-size wrapper — no transform, canvas IS this size */}
            <div
              className="ring-1 ring-white/[0.1] shadow-2xl shadow-black"
              style={{ width: dispW, height: dispH, display: ready ? "block" : "none" }}
            >
              <canvas ref={canvasRef} />
            </div>
          </div>

          {/* hidden file inputs */}
          <input ref={bgInputRef}  type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceBackground(f); e.target.value = ""; }} />
          <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceSelectedImage(f); e.target.value = ""; }} />

          {/* Properties panel */}
          <div className="w-[268px] shrink-0 border-l border-white/[0.07] bg-[#111114] flex flex-col overflow-y-auto">
            {!hasSel ? (
              <div className="flex flex-col flex-1 gap-0">
                <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 text-center">
                  <div className="w-11 h-11 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                    <Layers className="w-5 h-5 text-white/15" />
                  </div>
                  <p className="text-[12px] text-white/25 leading-relaxed">Clique em qualquer elemento para editar</p>
                </div>
                {/* Trocar foto de fundo */}
                <div className="p-4 border-t border-white/[0.06]">
                  <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest mb-3">Foto de fundo</p>
                  <button
                    onClick={() => bgInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.1] text-[11px] text-white/50 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-all">
                    <Upload className="w-3.5 h-3.5" /> Trocar foto de fundo
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest">
                  {isText ? "Texto" : isRect ? "Forma" : isImage ? "Imagem" : "Elemento"}
                </p>

                {/* ── Image replace ── */}
                {isImage && (
                  <div>
                    <label className="block text-[10px] text-white/35 mb-1.5">Trocar imagem</label>
                    <button
                      onClick={() => imgInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/[0.1] text-[11px] text-white/50 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-all">
                      <Upload className="w-3.5 h-3.5" /> Selecionar arquivo
                    </button>
                  </div>
                )}

                {/* ── Text content ── */}
                {isText && (
                  <div>
                    <label className="block text-[10px] text-white/35 mb-1">Conteúdo</label>
                    <textarea rows={4} value={sel.text}
                      onChange={(e) => {
                        const o = fcRef.current?.getActiveObject();
                        if (o) { o.set("text", e.target.value); fcRef.current.renderAll(); }
                        setSel((p) => ({ ...p, text: e.target.value }));
                      }}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[12px] text-white focus:outline-none focus:border-purple-500/50 resize-none leading-relaxed"
                    />
                  </div>
                )}

                {/* ── Font ── */}
                {isText && (
                  <div>
                    <label className="block text-[10px] text-white/35 mb-1">Fonte</label>
                    <select value={sel.fontFamily} onChange={(e) => apply("fontFamily", e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[12px] text-white focus:outline-none cursor-pointer">
                      {["Montserrat","Bebas Neue","Cormorant Garamond","Inter","Georgia","Arial","Arial Black"].map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* ── Size ── */}
                {isText && (
                  <div>
                    <label className="block text-[10px] text-white/35 mb-1">Tamanho — {sel.fontSize}px</label>
                    <input type="range" min="12" max="600" step="2" value={sel.fontSize}
                      onChange={(e) => apply("fontSize", Number(e.target.value))}
                      className="w-full accent-purple-500 cursor-pointer" />
                  </div>
                )}

                {/* ── Weight + Italic ── */}
                {isText && (
                  <div>
                    <label className="block text-[10px] text-white/35 mb-1">Peso</label>
                    <div className="grid grid-cols-5 gap-1">
                      {(["400","600","700","900"] as const).map((w) => (
                        <button key={w} onClick={() => apply("fontWeight", w)}
                          className={cn("py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer transition-all border",
                            sel.fontWeight === w
                              ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                              : "border-white/[0.08] text-white/30 hover:text-white/60")}>
                          {w === "400" ? "Reg" : w === "600" ? "Semi" : w === "700" ? "Bold" : "Black"}
                        </button>
                      ))}
                      <button onClick={() => apply("fontStyle", sel.fontStyle === "italic" ? "normal" : "italic")}
                        className={cn("py-1.5 rounded-lg cursor-pointer transition-all border flex items-center justify-center",
                          sel.fontStyle === "italic"
                            ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                            : "border-white/[0.08] text-white/30 hover:text-white/60")}>
                        <Italic className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── Align ── */}
                {isText && (
                  <div>
                    <label className="block text-[10px] text-white/35 mb-1">Alinhamento</label>
                    <div className="flex gap-1">
                      {(["left","center","right"] as const).map((a) => (
                        <button key={a} onClick={() => apply("textAlign", a)}
                          className={cn("flex-1 flex items-center justify-center py-2 rounded-lg cursor-pointer transition-all border",
                            sel.textAlign === a
                              ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                              : "border-white/[0.08] text-white/30 hover:text-white/60")}>
                          {a === "left" ? <AlignLeft className="w-3.5 h-3.5" /> : a === "center" ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Color ── */}
                <div>
                  <label className="block text-[10px] text-white/35 mb-1">{isText ? "Cor do texto" : "Cor"}</label>
                  <div
                    className="flex items-center gap-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 cursor-pointer hover:border-white/15 transition-colors"
                    onClick={() => document.getElementById("prop-color")?.click()}
                  >
                    <div className="w-5 h-5 rounded-md ring-1 ring-white/10 shrink-0" style={{ backgroundColor: sel.fill }} />
                    <span className="text-[11px] text-white/50 font-mono flex-1">{sel.fill.toUpperCase()}</span>
                    <input id="prop-color" type="color" value={sel.fill}
                      onChange={(e) => { apply("fill", e.target.value); }}
                      className="hidden" />
                  </div>
                </div>

                {/* ── Delete ── */}
                <button onClick={del}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/20 text-[11px] text-red-400/50 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all mt-1">
                  <Trash2 className="w-3.5 h-3.5" /> Remover
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Hint bar ─────────────────────────────────── */}
        <div className="flex items-center gap-5 px-5 py-2 border-t border-white/[0.06] shrink-0">
          {[
            "Clique duplo no texto → editar inline",
            "Arraste → mover",
            "Handles → redimensionar",
            "Del → remover seleção",
          ].map((h) => (
            <span key={h} className="text-[10px] text-white/15">{h}</span>
          ))}
        </div>
      </div>
    </>
  );
}
