"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  X, Download, Loader2, ChevronLeft, Layers,
  Type, Square, Trash2, AlignLeft, AlignCenter, AlignRight, Italic,
  ImageIcon, Upload, Eye, EyeOff, Minus, Link, Link2Off,
  ChevronRight, ChevronDown, Folder,
} from "lucide-react";
import type { CanvasTemplate, ObjDef } from "../lib/canvas-templates";

/* ─── Font loaders ─────────────────────────────────────── */
const BASE_FONTS =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,300;1,400&family=Bebas+Neue&family=Montserrat:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=Sora:wght@300;400;600;700;800&family=Poppins:wght@300;400;500;600;700;800&family=Oswald:wght@300;400;500;600;700&family=Raleway:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap";

const SYSTEM_FONT_SET = new Set([
  "Helvetica Neue","Helvetica","Arial","Arial Black","Times New Roman",
  "Georgia","Verdana","Tahoma","Trebuchet MS","Impact","Courier New",
  "system-ui","-apple-system","sans-serif","serif","monospace",
]);

/* Tracks fonts from queryLocalFonts() — no Google Fonts load needed for these */
const _systemFontNames = new Set<string>([...SYSTEM_FONT_SET]);

/* Tracks Google Font families already injected, so we don't duplicate stylesheet requests */
const _loadedGFonts = new Set<string>();

/* Collect all font families from an objects array, including WFGroup children (recursive) */
function collectFontsFromObjects(objects: unknown[], fm: Map<string, Set<string>>) {
  for (const obj of objects) {
    const o = obj as Record<string, unknown>;
    const ff = o.fontFamily;
    const fw = o.fontWeight;
    if (typeof ff === "string") {
      if (!fm.has(ff)) fm.set(ff, new Set());
      fm.get(ff)!.add(typeof fw === "string" ? fw : "400");
    }
    /* Also collect fonts declared per-segment (mixed styles) */
    if (Array.isArray(o.segments)) {
      for (const seg of o.segments as Array<Record<string, unknown>>) {
        const sf = seg.fontFamily as string | undefined;
        const sw = seg.fontWeight as string | undefined;
        if (sf) {
          if (!fm.has(sf)) fm.set(sf, new Set());
          fm.get(sf)!.add(sw ?? "400");
        }
      }
    }
    /* Recurse into WFGroup children */
    if (o.type === "WFGroup" && Array.isArray(o.children)) {
      collectFontsFromObjects(o.children as unknown[], fm);
    }
  }
}

async function loadFontsFromObjects(objects: unknown[]) {
  const fm = new Map<string, Set<string>>();
  collectFontsFromObjects(objects, fm);

  const loadSheet = (id: string, href: string) => new Promise<void>((res) => {
    if (document.getElementById(id)) { res(); return; }
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet"; l.href = href;
    l.onload = () => res(); l.onerror = () => res();
    document.head.appendChild(l);
  });

  /* Always load base fonts first */
  const sheets: Promise<void>[] = [loadSheet("wf-canvas-fonts", BASE_FONTS)];

  /* Load ALL non-system fonts from template with full weight coverage.
     No "known" filter — even fonts already in BASE_FONTS get the full
     weight set loaded (BASE_FONTS only has a fixed weight subset).
     Track per-family to avoid duplicate requests across template changes. */
  const newFonts = Array.from(fm.keys()).filter(
    (f) => !SYSTEM_FONT_SET.has(f) && !_systemFontNames.has(f) && !_loadedGFonts.has(f)
  );
  if (newFonts.length > 0) {
    newFonts.forEach((f) => _loadedGFonts.add(f));
    const p = newFonts
      .map((f) => `family=${encodeURIComponent(f)}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400`)
      .join("&");
    /* Unique ID per batch so multiple templates don't conflict */
    const batchId = `wf-fonts-dyn-${newFonts.map((f) => f.replace(/\s/g, "").slice(0, 4)).join("")}`;
    sheets.push(loadSheet(batchId, `https://fonts.googleapis.com/css2?${p}&display=swap`));
  }

  await Promise.all(sheets);

  const loads: Promise<unknown>[] = [];
  for (const [fam, weights] of Array.from(fm.entries()))
    for (const w of Array.from(weights))
      loads.push(document.fonts.load(`${w} 40px "${fam}"`).catch(() => {}));
  await Promise.allSettled(loads);
}

async function loadSingleFont(family: string) {
  if (SYSTEM_FONT_SET.has(family) || _systemFontNames.has(family)) return;
  const id = `wf-font-${family.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id; link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap`;
  document.head.appendChild(link);
  await document.fonts.load(`700 40px "${family}"`).catch(() => {});
}

/* ─── Layer helpers ────────────────────────────────────── */
interface LayerInfo {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  isGroup: boolean;
  children?: LayerInfo[];
  depth: number;
  parentGroupId?: string;
}

function getLayerDisplayName(o: any): string {
  const name: string = o.name ?? "";
  if (name === "__background__") return "Fundo";
  if (name && !/^(text|rect|elem)-\d+$/.test(name)) return name;
  const type: string = o.type ?? "";
  if (type === "textbox" || type === "i-text") return (o.text ?? "").replace(/\n/g, " ").trim().slice(0, 24) || "Texto";
  if (type === "image") return "Imagem";
  if (type === "rect") return "Retangulo";
  if (type === "group") return "Grupo";
  if (type === "line") return "Linha";
  return "Elemento";
}

function buildLayerTree(objects: any[], depth = 0, parentGroupId?: string): LayerInfo[] {
  return [...objects].reverse().map((o: any) => {
    const isGrp = o.type === "group";
    const children: LayerInfo[] | undefined = isGrp && o._objects
      ? buildLayerTree(o._objects, depth + 1, o.name ?? "")
      : undefined;
    return {
      id: o.name ?? "",
      name: getLayerDisplayName(o),
      type: o.type ?? "",
      visible: o.visible !== false,
      isGroup: isGrp,
      children,
      depth,
      parentGroupId,
    };
  });
}

function LayerTypeIcon({ type }: { type: string }) {
  const cls = "w-3 h-3 shrink-0";
  if (type === "textbox" || type === "i-text") return <Type className={cls} />;
  if (type === "image") return <ImageIcon className={cls} />;
  if (type === "rect") return <Square className={cls} />;
  if (type === "line") return <Minus className={cls} />;
  if (type === "group") return <Folder className={cls} />;
  return <Layers className={cls} />;
}

/* ─── Alignment icons (inline SVG) ───────────────────────*/
const AlignIcons = {
  left:    <svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="1.5" height="11" fill="currentColor" opacity=".5"/><rect x="2.5" y="3.5" width="7" height="5.5" rx="1" fill="currentColor"/></svg>,
  centerH: <svg width="13" height="13" viewBox="0 0 13 13"><rect x="6" y="1" width="1.5" height="11" fill="currentColor" opacity=".5"/><rect x="2.5" y="3.5" width="8" height="5.5" rx="1" fill="currentColor"/></svg>,
  right:   <svg width="13" height="13" viewBox="0 0 13 13"><rect x="10.5" y="1" width="1.5" height="11" fill="currentColor" opacity=".5"/><rect x="3.5" y="3.5" width="7" height="5.5" rx="1" fill="currentColor"/></svg>,
  top:     <svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="1" width="11" height="1.5" fill="currentColor" opacity=".5"/><rect x="3.5" y="2.5" width="5.5" height="7" rx="1" fill="currentColor"/></svg>,
  centerV: <svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="6" width="11" height="1.5" fill="currentColor" opacity=".5"/><rect x="3.5" y="2.5" width="5.5" height="8" rx="1" fill="currentColor"/></svg>,
  bottom:  <svg width="13" height="13" viewBox="0 0 13 13"><rect x="1" y="10.5" width="11" height="1.5" fill="currentColor" opacity=".5"/><rect x="3.5" y="3.5" width="5.5" height="7" rx="1" fill="currentColor"/></svg>,
  flipH:   <svg width="13" height="13" viewBox="0 0 13 13"><path d="M6.5 1v11M2 4l4 4-4 4M11 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/></svg>,
  flipV:   <svg width="13" height="13" viewBox="0 0 13 13"><path d="M1 6.5h11M4 2l4 4 4-4M4 11l4-4 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none"/></svg>,
};

/* ─── Selection state ──────────────────────────────────── */
interface SelState {
  id: string | null; type: string;
  left: number; top: number; width: number; height: number; angle: number;
  flipX: boolean; flipY: boolean;
  text: string;
  fontSize: number; fontFamily: string; fontWeight: string; fontStyle: string;
  textAlign: string; lineHeight: number; charSpacing: number;
  fillType: "solid" | "gradient";
  fill: string;
  gradientStart: string; gradientEnd: string; gradientAngle: number;
  opacity: number;
  stroke: string; strokeWidth: number;
  rx: number;
  shadowEnabled: boolean;
  shadowColor: string; shadowBlur: number; shadowOffsetX: number; shadowOffsetY: number;
  /* Group context */
  parentGroupName: string | null;
  layoutDir: string;
  layoutGap: number;
}
const EMPTY: SelState = {
  id: null, type: "",
  left: 0, top: 0, width: 0, height: 0, angle: 0,
  flipX: false, flipY: false,
  text: "", fontSize: 48, fontFamily: "Montserrat", fontWeight: "700",
  fontStyle: "normal", textAlign: "left", lineHeight: 1.16, charSpacing: 0,
  fillType: "solid", fill: "#ffffff",
  gradientStart: "#6c47ff", gradientEnd: "#000000", gradientAngle: 180,
  opacity: 100,
  stroke: "#000000", strokeWidth: 0,
  rx: 0,
  shadowEnabled: false, shadowColor: "#000000", shadowBlur: 10, shadowOffsetX: 0, shadowOffsetY: 4,
  parentGroupName: null,
  layoutDir: "none",
  layoutGap: 0,
};

const FONT_LIST = [
  "Montserrat","Sora","Inter","Poppins","DM Sans","Raleway","Oswald",
  "Bebas Neue","Cormorant Garamond","Playfair Display","Georgia","Arial","Arial Black",
];
const PANEL_FONT = { fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif" };

/* ─── Font Picker ──────────────────────────────────────────── */
interface FontEntry { name: string; category: string; system?: boolean; }

const GOOGLE_FONTS: FontEntry[] = [
  /* Sans-serif */
  { name: "Montserrat",          category: "Sans-serif" },
  { name: "Inter",               category: "Sans-serif" },
  { name: "Poppins",             category: "Sans-serif" },
  { name: "Roboto",              category: "Sans-serif" },
  { name: "Open Sans",           category: "Sans-serif" },
  { name: "Lato",                category: "Sans-serif" },
  { name: "Sora",                category: "Sans-serif" },
  { name: "DM Sans",             category: "Sans-serif" },
  { name: "Nunito",              category: "Sans-serif" },
  { name: "Raleway",             category: "Sans-serif" },
  { name: "Work Sans",           category: "Sans-serif" },
  { name: "Outfit",              category: "Sans-serif" },
  { name: "Plus Jakarta Sans",   category: "Sans-serif" },
  { name: "Figtree",             category: "Sans-serif" },
  { name: "Manrope",             category: "Sans-serif" },
  { name: "Mulish",              category: "Sans-serif" },
  { name: "Rubik",               category: "Sans-serif" },
  { name: "Space Grotesk",       category: "Sans-serif" },
  { name: "Quicksand",           category: "Sans-serif" },
  { name: "Karla",               category: "Sans-serif" },
  { name: "Barlow",              category: "Sans-serif" },
  { name: "Josefin Sans",        category: "Sans-serif" },
  { name: "Cabin",               category: "Sans-serif" },
  { name: "Exo 2",               category: "Sans-serif" },
  { name: "Urbanist",            category: "Sans-serif" },
  { name: "Jost",                category: "Sans-serif" },
  { name: "IBM Plex Sans",       category: "Sans-serif" },
  { name: "Noto Sans",           category: "Sans-serif" },
  { name: "Albert Sans",         category: "Sans-serif" },
  { name: "Schibsted Grotesk",   category: "Sans-serif" },
  /* Display */
  { name: "Oswald",              category: "Display" },
  { name: "Bebas Neue",          category: "Display" },
  { name: "Anton",               category: "Display" },
  { name: "Righteous",           category: "Display" },
  { name: "Orbitron",            category: "Display" },
  { name: "Big Shoulders Display", category: "Display" },
  { name: "Bungee",              category: "Display" },
  { name: "Russo One",           category: "Display" },
  /* Serif */
  { name: "Playfair Display",    category: "Serif" },
  { name: "Cormorant Garamond",  category: "Serif" },
  { name: "Lora",                category: "Serif" },
  { name: "Merriweather",        category: "Serif" },
  { name: "EB Garamond",         category: "Serif" },
  { name: "DM Serif Display",    category: "Serif" },
  { name: "Libre Baskerville",   category: "Serif" },
  { name: "Crimson Text",        category: "Serif" },
  { name: "Spectral",            category: "Serif" },
  { name: "Cinzel",              category: "Serif" },
  /* Cursivo */
  { name: "Pacifico",            category: "Cursivo" },
  { name: "Dancing Script",      category: "Cursivo" },
  { name: "Great Vibes",         category: "Cursivo" },
  { name: "Sacramento",          category: "Cursivo" },
  { name: "Satisfy",             category: "Cursivo" },
  { name: "Caveat",              category: "Cursivo" },
  { name: "Courgette",           category: "Cursivo" },
  /* Mono */
  { name: "JetBrains Mono",      category: "Mono" },
  { name: "Source Code Pro",     category: "Mono" },
  { name: "IBM Plex Mono",       category: "Mono" },
  /* Sistema */
  { name: "Arial",               category: "Sistema" },
  { name: "Arial Black",         category: "Sistema" },
  { name: "Georgia",             category: "Sistema" },
  { name: "Times New Roman",     category: "Sistema" },
  { name: "Helvetica Neue",      category: "Sistema" },
  { name: "Verdana",             category: "Sistema" },
  { name: "Impact",              category: "Sistema" },
];

/* Single CSS request for all Google Font previews */
const _PICKER_PREVIEW_URL = (() => {
  const gf = GOOGLE_FONTS.filter((f) => f.category !== "Sistema");
  return `https://fonts.googleapis.com/css2?${gf.map((f) => `family=${encodeURIComponent(f.name)}:wght@400;700`).join("&")}&display=swap`;
})();

function FontPickerItem({ font, selected, onSelect }: {
  font: FontEntry; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center justify-between px-3 py-[7px] text-left cursor-pointer transition-colors",
        selected ? "bg-purple-500/15" : "hover:bg-white/[0.05]"
      )}>
      <span className="text-[14px] text-white/80 truncate leading-tight" style={{ fontFamily: font.name }}>
        {font.name}
      </span>
      {font.system && <span className="text-[9px] text-white/20 ml-2 shrink-0">PC</span>}
    </button>
  );
}

function FontPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen]               = useState(false);
  const [search, setSearch]           = useState("");
  const [extraFonts, setExtraFonts]   = useState<FontEntry[]>([]);
  const [loadingSys, setLoadingSys]   = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef    = useRef<HTMLInputElement>(null);

  /* Load preview stylesheet once when picker first opens */
  useEffect(() => {
    if (!open) return;
    if (!previewLoaded) {
      const id = "wf-font-picker-preview";
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id; link.rel = "stylesheet"; link.href = _PICKER_PREVIEW_URL;
        document.head.appendChild(link);
      }
      setPreviewLoaded(true);
    }
    setTimeout(() => searchRef.current?.focus(), 40);
  }, [open, previewLoaded]);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const loadSystemFonts = async () => {
    setLoadingSys(true);
    try {
      const qf = (window as any).queryLocalFonts;
      if (!qf) {
        alert("Disponivel apenas no Chrome 103+. Abra no Chrome para usar fontes instaladas no seu PC.");
        return;
      }
      const fonts: any[] = await qf();
      const families = [...new Set<string>(fonts.map((f: any) => f.family as string))].sort();
      const known = new Set(GOOGLE_FONTS.map((f) => f.name));
      const newFonts = families
        .filter((name) => !known.has(name))
        .map((name) => {
          _systemFontNames.add(name);
          return { name, category: "Sistema", system: true } as FontEntry;
        });
      setExtraFonts(newFonts);
    } catch (err: any) {
      if (err.name === "SecurityError" || err.name === "NotAllowedError") {
        alert("Permissao negada. Clique em Permitir quando o navegador pedir acesso as fontes.");
      }
    } finally {
      setLoadingSys(false);
    }
  };

  const allFonts = [...GOOGLE_FONTS, ...extraFonts];
  const filtered = search.trim()
    ? allFonts.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    : allFonts;
  const grouped = !search.trim();
  const categories = grouped ? [...new Set(allFonts.map((f) => f.category))] : null;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-center justify-between gap-2 bg-white/[0.05] border border-white/[0.09] rounded-md px-2.5 py-2 text-[12px] text-white/80 hover:border-white/20 cursor-pointer transition-colors"
        style={{ fontFamily: value }}>
        <span className="truncate">{value}</span>
        <ChevronDown className="w-3 h-3 shrink-0 text-white/30" />
      </button>

      {/* Popover */}
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-[600] bg-[#18181f] border border-white/[0.12] rounded-xl shadow-2xl shadow-black/70 flex flex-col overflow-hidden"
          style={{ maxHeight: 320 }}>
          {/* Search */}
          <div className="p-2 border-b border-white/[0.07] shrink-0">
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar fonte..."
              className="w-full bg-white/[0.06] border border-white/[0.09] rounded-lg px-3 py-1.5 text-[11px] text-white/80 placeholder-white/25 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>

          {/* Load system fonts CTA */}
          {extraFonts.length === 0 && !search && (
            <div className="px-3 py-2 border-b border-white/[0.06] shrink-0">
              <button
                onClick={loadSystemFonts}
                disabled={loadingSys}
                className="text-[10px] text-purple-400/70 hover:text-purple-300 transition-colors cursor-pointer disabled:opacity-40">
                {loadingSys ? "Carregando fontes do PC..." : "+ Carregar fontes instaladas no PC"}
              </button>
            </div>
          )}

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {grouped && categories
              ? categories.map((cat) => {
                  const items = filtered.filter((f) => f.category === cat);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat}>
                      <p className="px-3 pt-2.5 pb-1 text-[9px] font-semibold text-white/25 uppercase tracking-[0.12em]">{cat}</p>
                      {items.map((f) => (
                        <FontPickerItem key={f.name} font={f} selected={value === f.name}
                          onSelect={async () => {
                            if (!_systemFontNames.has(f.name)) await loadSingleFont(f.name);
                            onChange(f.name);
                            setOpen(false); setSearch("");
                          }} />
                      ))}
                    </div>
                  );
                })
              : filtered.map((f) => (
                  <FontPickerItem key={f.name} font={f} selected={value === f.name}
                    onSelect={async () => {
                      if (!_systemFontNames.has(f.name)) await loadSingleFont(f.name);
                      onChange(f.name);
                      setOpen(false); setSearch("");
                    }} />
                ))
            }
            {filtered.length === 0 && (
              <p className="px-3 py-5 text-[11px] text-white/25 text-center">Nenhuma fonte encontrada</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Reusable UI atoms ────────────────────────────────── */
function NumInput({ label, value, onChange, min, max, step = 1, suffix }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] text-white/25 uppercase tracking-wider font-medium">{label}</span>
      <div className="relative flex items-center">
        <input type="number" value={value} min={min} max={max} step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-white/[0.05] border border-white/[0.09] rounded-md px-2 py-1.5 text-[11px] text-white/80 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.07] transition-colors [appearance:textfield] pr-5" />
        {suffix && <span className="absolute right-1.5 text-[9px] text-white/20 pointer-events-none">{suffix}</span>}
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const uid = `color-${label.replace(/\s/g, "-")}-${Math.random().toString(36).slice(2,6)}`;
  return (
    <div>
      {label && <span className="block text-[9px] text-white/25 uppercase tracking-wider font-medium mb-1">{label}</span>}
      <div className="flex items-center gap-2 bg-white/[0.05] border border-white/[0.09] rounded-md px-2.5 py-1.5 cursor-pointer hover:border-white/15 transition-colors"
        onClick={() => document.getElementById(uid)?.click()}>
        <div className="w-4 h-4 rounded shrink-0 ring-1 ring-white/10" style={{ backgroundColor: value }} />
        <span className="text-[11px] text-white/60 font-mono flex-1">{value.toUpperCase()}</span>
        <input id={uid} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="hidden" />
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pt-3 pb-1">
      <p className="text-[9px] font-semibold text-white/20 uppercase tracking-[0.12em] px-4 mb-2">{label}</p>
      <div className="px-4 space-y-2.5">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="mx-4 border-t border-white/[0.06]" />;
}

function IconBtn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title?: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={title}
      className={cn(
        "flex items-center justify-center w-7 h-7 rounded-md cursor-pointer transition-all border text-[11px]",
        active
          ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
          : "border-white/[0.09] text-white/40 hover:text-white/80 hover:bg-white/[0.06]"
      )}>
      {children}
    </button>
  );
}

/* ─── Fabric loading helpers ───────────────────────────── */

function loadFabricImageFromSrc(
  fab: any,
  src: string,
  props: Record<string, unknown>
): Promise<any> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const targetW = (props.width as number) ?? img.naturalWidth;
      const targetH = (props.height as number) ?? img.naturalHeight;
      const fi = new fab.FabricImage(img, {
        originX: "left",
        originY: "top",
        ...props,
        scaleX: img.naturalWidth > 0 ? targetW / img.naturalWidth : 1,
        scaleY: img.naturalHeight > 0 ? targetH / img.naturalHeight : 1,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      resolve(fi);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function buildFabricTextbox(fab: any, def: Record<string, unknown>): any {
  /* Resolve fill — supports plain color strings and gradient descriptors */
  const rawFill = def.fill ?? "#ffffff";
  let fabricFill: any = rawFill;
  if (rawFill && typeof rawFill === "object") {
    const fd = rawFill as Record<string, unknown>;
    if (fd.type === "linear") {
      const coords = fd.coords as Record<string, number> | undefined;
      const stops = fd.colorStops as Array<{ offset: number; color: string }> | undefined;
      if (coords && stops) {
        fabricFill = new fab.Gradient({
          type: "linear",
          gradientUnits: "pixels",
          coords: { x1: coords.x1 ?? 0, y1: coords.y1 ?? 0, x2: coords.x2 ?? 100, y2: coords.y2 ?? 0 },
          colorStops: stops,
          offsetX: (fd.offsetX as number) ?? 0,
          offsetY: (fd.offsetY as number) ?? 0,
        });
      }
    }
  }

  /* Build per-character styles from segments array if present */
  const segments = def.segments as Array<{ start: number; end: number; fontFamily?: string; fontWeight?: string; fontStyle?: string; fontSize?: number; fill?: string | null }> | undefined;
  const styles: Record<number, Record<number, Record<string, unknown>>> = {};
  if (segments && segments.length > 0) {
    for (const seg of segments) {
      for (let ci = seg.start; ci < seg.end; ci++) {
        const charStyle: Record<string, unknown> = {};
        if (seg.fontFamily) charStyle.fontFamily = seg.fontFamily;
        if (seg.fontWeight) charStyle.fontWeight = seg.fontWeight;
        if (seg.fontStyle) charStyle.fontStyle = seg.fontStyle;
        if (seg.fontSize) charStyle.fontSize = seg.fontSize;
        if (seg.fill) charStyle.fill = seg.fill;
        if (Object.keys(charStyle).length > 0) {
          if (!styles[0]) styles[0] = {};
          styles[0][ci] = charStyle;
        }
      }
    }
  }

  const tb = new fab.Textbox((def.text as string) ?? "", {
    originX: "left",
    originY: "top",
    left: (def.left as number) ?? 0,
    top: (def.top as number) ?? 0,
    width: (def.width as number) ?? 300,
    fontSize: (def.fontSize as number) ?? 16,
    fontFamily: (def.fontFamily as string) ?? "Montserrat",
    fontWeight: (def.fontWeight as string) ?? "400",
    fontStyle: ((def.fontStyle as string) ?? "normal") as any,
    fill: fabricFill,
    textAlign: ((def.textAlign as string) ?? "left") as any,
    charSpacing: (def.charSpacing as number) ?? 0,
    lineHeight: (def.lineHeight as number) ?? 1.2,
    opacity: (def.opacity as number) ?? 1,
    editable: true,
    selectable: true,
    name: (def.name as string) ?? "text",
    styles: Object.keys(styles).length > 0 ? styles : undefined,
  });
  return tb;
}

function buildFabricRect(fab: any, def: Record<string, unknown>): any {
  const fill = def.fill ?? "#cccccc";
  /* Reconstruct Fabric gradient if fill is an object descriptor from the plugin */
  let fabricFill: any = fill;
  if (fill && typeof fill === "object") {
    const fd = fill as Record<string, unknown>;
    if (fd.type === "linear") {
      const coords = fd.coords as Record<string, number> | undefined;
      const stops = fd.colorStops as Array<{ offset: number; color: string }> | undefined;
      if (coords && stops) {
        fabricFill = new fab.Gradient({
          type: "linear",
          gradientUnits: "pixels",
          coords: {
            x1: coords.x1 ?? 0,
            y1: coords.y1 ?? 0,
            x2: coords.x2 ?? 100,
            y2: coords.y2 ?? 0,
          },
          colorStops: stops,
          offsetX: (fd.offsetX as number) ?? 0,
          offsetY: (fd.offsetY as number) ?? 0,
        });
      }
    }
  }
  return new fab.Rect({
    originX: "left",
    originY: "top",
    left: (def.left as number) ?? 0,
    top: (def.top as number) ?? 0,
    width: (def.width as number) ?? 100,
    height: (def.height as number) ?? 100,
    rx: (def.rx as number) ?? 0,
    ry: (def.ry as number) ?? 0,
    fill: fabricFill,
    opacity: (def.opacity as number) ?? 1,
    selectable: true,
    evented: true,
    name: (def.name as string) ?? "rect",
    stroke: (def.stroke as string) ?? null,
    strokeWidth: (def.strokeWidth as number) ?? 0,
  });
}

async function buildFabricGroup(fab: any, def: Record<string, unknown>): Promise<any> {
  const groupAbsLeft = (def.left as number) ?? 0;
  const groupAbsTop = (def.top as number) ?? 0;
  const groupH = (def.height as number) ?? 0;
  const isHorizontal = (def.layoutDir as string) === "horizontal";
  const children: any[] = [];

  for (const rawChild of (def.children as unknown[]) ?? []) {
    const child = rawChild as Record<string, unknown>;

    /* Compute child absolute canvas position = group abs + child relative.
       For horizontal auto-layout groups, vertically center each child within
       the group height (compensates for Figma ↔ Fabric text-baseline differences). */
    const childAbsLeft = groupAbsLeft + ((child.left as number) ?? 0);
    const childH = (child.height as number) ?? 0;
    const childAbsTop = isHorizontal && groupH > 0 && childH > 0
      ? groupAbsTop + (groupH - childH) / 2
      : groupAbsTop + ((child.top as number) ?? 0);

    try {
      if (child.type === "WFImage") {
        const img = await loadFabricImageFromSrc(fab, child.src as string, {
          left: childAbsLeft,
          top: childAbsTop,
          width: (child.width as number) ?? 100,
          height: (child.height as number) ?? 100,
          name: (child.name as string) ?? "image",
          selectable: true,
          evented: true,
        });
        if (img) children.push(img);
      } else if (child.type === "WFTextbox") {
        const tb = buildFabricTextbox(fab, {
          ...child,
          left: childAbsLeft,
          top: childAbsTop,
        });
        if (tb) children.push(tb);
      } else if (child.type === "WFRect") {
        const r = buildFabricRect(fab, {
          ...child,
          left: childAbsLeft,
          top: childAbsTop,
        });
        if (r) children.push(r);
      } else if (child.type === "WFGroup") {
        /* Nested group — left/top are already relative to parent group, pass absolute */
        const nested = await buildFabricGroup(fab, {
          ...child,
          left: childAbsLeft,
          top: childAbsTop,
        });
        if (nested) children.push(nested);
      }
    } catch {
      /* skip failed children */
    }
  }

  if (children.length === 0) return null;

  /* Create the group — children have absolute canvas positions.
     FitContentLayout will compute the group bounding box and shift
     children to group-local coords automatically. */
  const group = new fab.Group(children, {
    originX: "left",
    originY: "top",
    subTargetCheck: true,
    interactive: true,
    name: (def.name as string) ?? "group",
    opacity: (def.opacity as number) ?? 1,
    selectable: true,
    evented: true,
  });

  group._wfLayoutDir = (def.layoutDir as string) ?? "none";
  group._wfLayoutGap = (def.layoutGap as number) ?? 0;

  return group;
}

async function loadFigmaObjects(fab: any, fc: any, objects: unknown[]): Promise<void> {
  for (const rawObj of objects) {
    const obj = rawObj as Record<string, unknown>;

    try {
      if (obj.type === "WFGroup") {
        const group = await buildFabricGroup(fab, obj);
        if (group) fc.add(group);
      } else if (obj.type === "Image") {
        const isBackground = obj.name === "__background__";
        const img = await loadFabricImageFromSrc(fab, obj.src as string, {
          left: (obj.left as number) ?? 0,
          top: (obj.top as number) ?? 0,
          width: (obj.width as number) ?? 100,
          height: (obj.height as number) ?? 100,
          name: (obj.name as string) ?? "image",
          selectable: !isBackground,
          evented: !isBackground,
          lockMovementX: isBackground ? true : (obj.lockMovementX as boolean) ?? false,
          lockMovementY: isBackground ? true : (obj.lockMovementY as boolean) ?? false,
          lockScalingX: isBackground ? true : (obj.lockScalingX as boolean) ?? false,
          lockScalingY: isBackground ? true : (obj.lockScalingY as boolean) ?? false,
          opacity: (obj.opacity as number) ?? 1,
        });
        if (img) fc.add(img);
      } else if (obj.type === "Rect") {
        const r = buildFabricRect(fab, obj);
        if (r) fc.add(r);
      } else if (obj.type === "Textbox") {
        const t = buildFabricTextbox(fab, obj);
        if (t) fc.add(t);
      }
    } catch {
      /* skip failed objects */
    }
  }
}

/* ─── Main component ───────────────────────────────────── */
interface Props { template: CanvasTemplate; onClose: () => void; }

export function CanvasEditor({ template, onClose }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const fcRef       = useRef<any>(null);
  const fabRef      = useRef<any>(null);
  const bgInputRef  = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const [ready, setReady]         = useState(false);
  const [exporting, setExp]       = useState(false);
  const [sel, setSel]             = useState<SelState>(EMPTY);
  const [layers, setLayers]       = useState<LayerInfo[]>([]);
  const [exportScale, setExportScale] = useState<number>(1);
  const [lockAspect, setLockAspect]   = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const TARGET_H = template.h === 1920 ? 580 : 560;
  const scale    = TARGET_H / template.h;
  const dispW    = Math.round(template.w * scale);
  const dispH    = TARGET_H;

  const rebuildLayers = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    setLayers(buildLayerTree(fc.getObjects() as any[]));
  }, []);

  const syncSel = useCallback((o: any) => {
    if (!o) { setSel(EMPTY); return; }
    const isText = o.type === "textbox" || o.type === "i-text";
    const shadow = o.shadow;

    let fillType: "solid" | "gradient" = "solid";
    let fillColor = "#ffffff";
    let gradStart = "#6c47ff", gradEnd = "#000000", gradAngle = 180;

    if (typeof o.fill === "string") {
      fillColor = o.fill || "#ffffff";
    } else if (o.fill && typeof o.fill === "object") {
      fillType = "gradient";
      const stops = o.fill.colorStops;
      if (stops?.length >= 2) {
        gradStart = stops[0].color ?? "#6c47ff";
        gradEnd = stops[stops.length - 1].color ?? "#000000";
        const coords = o.fill.coords;
        if (coords) {
          const w = o.width ?? 100, h = o.height ?? 100;
          const dx = (coords.x2 ?? w) - (w / 2), dy = (coords.y2 ?? h) - (h / 2);
          gradAngle = Math.round((Math.atan2(dy, dx) * 180 / Math.PI + 360)) % 360;
        }
      }
    }

    /* Determine parent group name (if object is inside a group) */
    const parentGroupName: string | null = o.group
      ? (o.group.name ?? "Grupo")
      : null;

    setSel({
      id: o.name ?? null, type: o.type ?? "",
      layoutDir: o._wfLayoutDir ?? "none",
      layoutGap: o._wfLayoutGap ?? 0,
      left: Math.round(o.left ?? 0), top: Math.round(o.top ?? 0),
      width: Math.round(o.getScaledWidth ? o.getScaledWidth() : (o.width ?? 0)),
      height: Math.round(o.getScaledHeight ? o.getScaledHeight() : (o.height ?? 0)),
      angle: Math.round(o.angle ?? 0),
      flipX: o.flipX ?? false, flipY: o.flipY ?? false,
      text: isText ? (o.text ?? "") : "",
      fontSize: o.fontSize ?? 48, fontFamily: o.fontFamily ?? "Montserrat",
      fontWeight: String(o.fontWeight ?? "700"), fontStyle: o.fontStyle ?? "normal",
      textAlign: o.textAlign ?? "left", lineHeight: o.lineHeight ?? 1.16, charSpacing: o.charSpacing ?? 0,
      fillType, fill: fillColor, gradientStart: gradStart, gradientEnd: gradEnd, gradientAngle: gradAngle,
      opacity: Math.round((o.opacity ?? 1) * 100),
      stroke: typeof o.stroke === "string" && o.stroke ? o.stroke : "#000000",
      strokeWidth: o.strokeWidth ?? 0,
      rx: o.rx ?? 0,
      shadowEnabled: !!shadow,
      shadowColor: shadow?.color ?? "#000000",
      shadowBlur: shadow?.blur ?? 10,
      shadowOffsetX: shadow?.offsetX ?? 0, shadowOffsetY: shadow?.offsetY ?? 4,
      parentGroupName,
    });
  }, []);

  const makeGrad = (fab: any, def: ObjDef, w: number, h: number) => {
    if (!def.gradient) return null;
    const rad = (def.gradient.angle * Math.PI) / 180;
    return new fab.Gradient({
      type: "linear",
      coords: {
        x1: w/2 - Math.cos(rad)*w/2, y1: h/2 - Math.sin(rad)*h/2,
        x2: w/2 + Math.cos(rad)*w/2, y2: h/2 + Math.sin(rad)*h/2,
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
      fc = new fab.Canvas(canvasRef.current!, {
        width: dispW, height: dispH, backgroundColor: template.bgColor, preserveObjectStacking: true,
      });
      fcRef.current = fc;

      if (template.fabricJson) {
        const rawObjects = (template.fabricJson as any).objects ?? [];
        await loadFontsFromObjects(rawObjects);

        /* Detect if any object is WFGroup — use new loading path */
        const hasWFGroup = rawObjects.some((o: any) => o.type === "WFGroup");

        if (hasWFGroup) {
          await loadFigmaObjects(fab, fc, rawObjects);
          fc.getObjects().forEach((o: any, idx: number) => { if (!o.name) o.set("name", `elem-${idx}`); });
        } else {
          /* Legacy path — old Fabric JSON without WFGroup */
          await fc.loadFromJSON(template.fabricJson);
          fc.getObjects().forEach((o: any, idx: number) => { if (!o.name) o.set("name", `elem-${idx}`); });
        }

        setTimeout(() => { fcRef.current?.renderAll(); rebuildLayers(); }, 300);
        setTimeout(() => { fcRef.current?.renderAll(); rebuildLayers(); }, 1200);
      } else {
        if (!document.getElementById("wf-canvas-fonts")) {
          const l = document.createElement("link");
          l.id = "wf-canvas-fonts"; l.rel = "stylesheet"; l.href = BASE_FONTS;
          document.head.appendChild(l);
        }
        await document.fonts.ready;
        for (const def of template.objects) {
          let obj: any = null;
          if (def.type === "rect") {
            obj = new fab.Rect({
              originX: "left", originY: "top", left: def.left, top: def.top,
              width: def.width ?? 100, height: def.height ?? 100,
              rx: def.rx ?? 0, ry: def.ry ?? 0, fill: def.fill ?? "#cccccc",
              opacity: def.opacity ?? 1, selectable: def.selectable !== false,
              lockMovementX: def.lockMovementX ?? false, lockMovementY: def.lockMovementY ?? false,
              stroke: def.stroke ?? null, strokeWidth: def.strokeWidth ?? 0, name: def.id,
            });
            const grad = makeGrad(fab, def, def.width ?? 100, def.height ?? 100);
            if (grad) obj.set("fill", grad);
          } else if (def.type === "textbox") {
            obj = new fab.Textbox(def.text ?? "", {
              originX: "left", originY: "top", left: def.left, top: def.top, width: def.width ?? 400,
              fontSize: def.fontSize ?? 48, fontFamily: def.fontFamily ?? "Montserrat",
              fontWeight: def.fontWeight ?? "700", fontStyle: (def.fontStyle ?? "normal") as any,
              fill: def.fill ?? "#ffffff", textAlign: (def.textAlign ?? "left") as any,
              charSpacing: def.charSpacing ?? 0, lineHeight: def.lineHeight ?? 1.16,
              editable: true, selectable: true, name: def.id,
            });
          } else if (def.type === "line") {
            obj = new fab.Line([def.x1 ?? 0, def.y1 ?? 0, def.x2 ?? 100, def.y2 ?? 0], {
              stroke: def.stroke ?? "#cccccc", strokeWidth: def.strokeWidth ?? 1,
              selectable: def.selectable !== false, name: def.id,
              left: def.left ?? def.x1 ?? 0, top: def.top ?? def.y1 ?? 0,
            });
          }
          if (obj) fc.add(obj);
        }
      }

      fc.setZoom(scale);

      /* ── Group interaction: double-click to enter ── */
      const handleDblClick = (e: any) => {
        const target = e.target;
        if (!target || target.type !== "group") return;
        const subTarget = e.subTargets?.[0];
        if (subTarget) {
          fc.setActiveObject(subTarget);
          fc.renderAll();
          syncSel(subTarget);
          if (subTarget.type === "textbox" || subTarget.type === "i-text") {
            subTarget.enterEditing?.();
          }
        }
      };
      fc.on("mouse:dblclick", handleDblClick);

      const onSel = (e?: any) => { const o = e?.selected?.[0] ?? fc.getActiveObject(); syncSel(o); };
      fc.on("selection:created", onSel);
      fc.on("selection:updated", onSel);
      fc.on("selection:cleared", () => setSel(EMPTY));
      fc.on("object:modified", (e: any) => { syncSel(e?.target ?? fc.getActiveObject()); rebuildLayers(); });
      fc.on("text:changed", (e: any) => { syncSel(e?.target ?? fc.getActiveObject()); rebuildLayers(); });
      fc.on("object:added", rebuildLayers);
      fc.on("object:removed", rebuildLayers);
      fc.renderAll(); rebuildLayers(); setReady(true);
    })();

    /* ── ESC key: exit group ── */
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const fc = fcRef.current;
        if (!fc) return;
        const active = fc.getActiveObject();
        if (active && active.group) {
          fc.setActiveObject(active.group);
          fc.renderAll();
          syncSel(active.group);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      fc?.dispose();
      window.removeEventListener("keydown", handleKeyDown);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  /* ── Apply helpers ─────────────────────────────────── */
  const apply = useCallback((prop: string, val: any) => {
    const o = fcRef.current?.getActiveObject();
    if (!o) return;
    o.set(prop as any, prop === "opacity" ? val / 100 : val);
    fcRef.current.renderAll();
    setSel((p) => ({ ...p, [prop]: val }));
  }, []);

  const applyPos = useCallback((prop: "left" | "top", val: number) => {
    const o = fcRef.current?.getActiveObject();
    if (!o) return;
    o.set(prop, val); o.setCoords?.();
    fcRef.current.renderAll();
    setSel((p) => ({ ...p, [prop]: val }));
  }, []);

  const applySize = useCallback((prop: "width" | "height", val: number) => {
    const o = fcRef.current?.getActiveObject();
    if (!o || val <= 0) return;
    const type = o.type as string;
    if (type === "rect" || type === "textbox" || type === "i-text") {
      if (lockAspect) {
        const ratio = (o.width ?? 1) / (o.height ?? 1);
        if (prop === "width") { o.set("width", val); o.set("height", Math.round(val / ratio)); }
        else { o.set("height", val); o.set("width", Math.round(val * ratio)); }
        setSel((p) => ({ ...p, width: Math.round(o.width), height: Math.round(o.height) }));
      } else {
        o.set(prop as any, val);
        setSel((p) => ({ ...p, [prop]: val }));
      }
    } else {
      const s = val / ((prop === "width" ? o.width : o.height) ?? 1);
      o.set(prop === "width" ? "scaleX" : "scaleY", s);
      setSel((p) => ({ ...p, [prop]: val }));
    }
    fcRef.current.renderAll();
  }, [lockAspect]);

  const alignTo = useCallback((dir: "left"|"centerH"|"right"|"top"|"centerV"|"bottom") => {
    const fc = fcRef.current; const o = fc?.getActiveObject();
    if (!o) return;
    const tw = template.w, th = template.h;
    const ow = o.getScaledWidth?.() ?? (o.width ?? 0);
    const oh = o.getScaledHeight?.() ?? (o.height ?? 0);
    switch (dir) {
      case "left":    o.set("left", 0); break;
      case "centerH": o.set("left", (tw - ow) / 2); break;
      case "right":   o.set("left", tw - ow); break;
      case "top":     o.set("top", 0); break;
      case "centerV": o.set("top", (th - oh) / 2); break;
      case "bottom":  o.set("top", th - oh); break;
    }
    o.setCoords?.(); fc.renderAll();
    setSel((p) => ({ ...p, left: Math.round(o.left ?? 0), top: Math.round(o.top ?? 0) }));
  }, [template.w, template.h]);

  const flipObj = useCallback((axis: "x" | "y") => {
    const o = fcRef.current?.getActiveObject();
    if (!o) return;
    if (axis === "x") { o.set("flipX", !o.flipX); setSel((p) => ({ ...p, flipX: !p.flipX })); }
    else              { o.set("flipY", !o.flipY); setSel((p) => ({ ...p, flipY: !p.flipY })); }
    fcRef.current.renderAll();
  }, []);

  const applyGradient = useCallback((start: string, end: string, angle: number) => {
    const o = fcRef.current?.getActiveObject();
    const fab = fabRef.current;
    if (!o || !fab) return;
    const rad = (angle * Math.PI) / 180;
    const w = o.width ?? 100, h = o.height ?? 100;
    const grad = new fab.Gradient({
      type: "linear", gradientUnits: "pixels",
      coords: {
        x1: w/2 - Math.cos(rad)*w/2, y1: h/2 - Math.sin(rad)*h/2,
        x2: w/2 + Math.cos(rad)*w/2, y2: h/2 + Math.sin(rad)*h/2,
      },
      colorStops: [{ offset: 0, color: start }, { offset: 1, color: end }],
    });
    o.set("fill", grad);
    fcRef.current.renderAll();
    setSel((p) => ({ ...p, fillType: "gradient", gradientStart: start, gradientEnd: end, gradientAngle: angle }));
  }, []);

  const applyShadow = useCallback((vals: Partial<SelState>) => {
    const o = fcRef.current?.getActiveObject();
    const fab = fabRef.current;
    if (!o || !fab) return;
    const next = { ...sel, ...vals };
    if (next.shadowEnabled) {
      o.set("shadow", new fab.Shadow({
        color: next.shadowColor, blur: next.shadowBlur,
        offsetX: next.shadowOffsetX, offsetY: next.shadowOffsetY,
      }));
    } else {
      o.set("shadow", null);
    }
    fcRef.current.renderAll();
    setSel((p) => ({ ...p, ...vals }));
  }, [sel]);

  /* ── Add / delete ──────────────────────────────────── */
  const addText = useCallback(() => {
    if (!fcRef.current || !fabRef.current) return;
    const t = new fabRef.current.Textbox("Novo texto", {
      originX: "left", originY: "top", left: 80, top: 80, width: 600,
      fontSize: 80, fontFamily: "Montserrat", fontWeight: "700", fill: "#ffffff",
      name: `text-${Date.now()}`,
    });
    fcRef.current.add(t); fcRef.current.setActiveObject(t); fcRef.current.renderAll();
  }, []);

  const addRect = useCallback(() => {
    if (!fcRef.current || !fabRef.current) return;
    const r = new fabRef.current.Rect({
      originX: "left", originY: "top", left: 80, top: 80, width: 400, height: 100, rx: 16,
      fill: "#6c47ff", name: `rect-${Date.now()}`,
    });
    fcRef.current.add(r); fcRef.current.setActiveObject(r); fcRef.current.renderAll();
  }, []);

  const del = useCallback(() => {
    const o = fcRef.current?.getActiveObject();
    if (o) { fcRef.current.remove(o); fcRef.current.renderAll(); setSel(EMPTY); }
  }, []);

  /* Exit group — select the parent group */
  const exitGroup = useCallback(() => {
    const fc = fcRef.current;
    if (!fc) return;
    const active = fc.getActiveObject();
    if (active?.group) {
      fc.setActiveObject(active.group);
      fc.renderAll();
      syncSel(active.group);
    }
  }, [syncSel]);

  /* ── Auto-layout re-layout ─────────────────────────── */
  const reLayoutGroup = useCallback((dir: string, gapVal: number) => {
    const fc = fcRef.current;
    const fab = fabRef.current;
    const group = fc?.getActiveObject();
    if (!group || group.type !== "group" || !fc || !fab) return;

    const gLeft   = (group.left  ?? 0);
    const gTop    = (group.top   ?? 0);
    const halfW   = (group.width ?? 0) / 2;
    const halfH   = (group.height ?? 0) / 2;
    const gName   = group.name;
    const gOpacity = group.opacity ?? 1;

    /* Convert group-relative child positions to absolute canvas positions */
    const childrenData = (group._objects as any[]).map((child: any) => ({
      obj: child,
      absLeft: gLeft + halfW + (child.left ?? 0),
      absTop:  gTop  + halfH + (child.top  ?? 0),
      w: child.getScaledWidth?.()  ?? (child.width  ?? 0),
      h: child.getScaledHeight?.() ?? (child.height ?? 0),
    }));

    /* Sort by current main-axis position */
    const sorted = dir === "horizontal"
      ? [...childrenData].sort((a, b) => a.absLeft - b.absLeft)
      : [...childrenData].sort((a, b) => a.absTop  - b.absTop);

    /* Re-position along main axis, preserve cross-axis */
    let pos = dir === "horizontal" ? gLeft : gTop;
    for (const item of sorted) {
      if (dir === "horizontal") {
        item.absLeft = pos;
        pos += item.w + gapVal;
      } else {
        item.absTop = pos;
        pos += item.h + gapVal;
      }
      item.obj.set({ left: item.absLeft, top: item.absTop });
      item.obj.setCoords?.();
    }

    /* Remove old group, re-create with new layout */
    fc.remove(group);
    const newGroup = new fab.Group(
      sorted.map((x: any) => x.obj),
      { originX: "left", originY: "top", subTargetCheck: true, interactive: true,
        name: gName, opacity: gOpacity, selectable: true, evented: true }
    );
    newGroup._wfLayoutDir = dir;
    newGroup._wfLayoutGap = gapVal;

    fc.add(newGroup);
    fc.setActiveObject(newGroup);
    fc.renderAll();
    rebuildLayers();
    syncSel(newGroup);
  }, [rebuildLayers, syncSel]);

  const moveChildInGroup = useCallback((groupId: string, childId: string, delta: 1 | -1) => {
    const fc = fcRef.current;
    const fab = fabRef.current;
    if (!fc || !fab) return;
    const group = (fc.getObjects() as any[]).find((o: any) => o.name === groupId);
    if (!group || group.type !== "group") return;

    const children: any[] = group._objects;
    const idx = children.findIndex((c: any) => c.name === childId);
    if (idx === -1) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= children.length) return;

    /* Swap adjacent children */
    const tmp = children[idx];
    children[idx] = children[newIdx];
    children[newIdx] = tmp;

    /* Also swap their main-axis positions so visual order matches */
    const dir: string = group._wfLayoutDir ?? "none";
    if (dir === "horizontal") {
      const tmpL = children[idx].left;
      children[idx].set({ left: children[newIdx].left });
      children[newIdx].set({ left: tmpL });
    } else if (dir === "vertical") {
      const tmpT = children[idx].top;
      children[idx].set({ top: children[newIdx].top });
      children[newIdx].set({ top: tmpT });
    }
    children[idx].setCoords?.();
    children[newIdx].setCoords?.();

    group.setCoords?.();
    fc.renderAll();
    rebuildLayers();
  }, [rebuildLayers]);

  /* ── Image replace ─────────────────────────────────── */
  const replaceBackground = useCallback((file: File) => {
    const fc = fcRef.current; const fab = fabRef.current;
    if (!fc || !fab) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const tw = template.w, th = template.h;
      const s = Math.max(tw / img.naturalWidth, th / img.naturalHeight);
      const cropW = tw/s, cropH = th/s;
      const bg = fc.getObjects().find((o: any) => o.name === "__background__");
      if (bg) fc.remove(bg);
      fc.insertAt(0, new fab.FabricImage(img, {
        originX: "left", originY: "top", left: 0, top: 0,
        cropX: Math.round((img.naturalWidth - cropW) / 2), cropY: Math.round((img.naturalHeight - cropH) / 2),
        width: Math.round(cropW), height: Math.round(cropH), scaleX: s, scaleY: s,
        selectable: false, evented: false,
        lockMovementX: true, lockMovementY: true, lockScalingX: true, lockScalingY: true,
        name: "__background__",
      }));
      fc.renderAll(); URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [template.w, template.h]);

  const replaceSelectedImage = useCallback((file: File) => {
    const o = fcRef.current?.getActiveObject();
    if (!o || o.type !== "image") return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const dW = (o.width ?? img.naturalWidth) * (o.scaleX ?? 1);
      const dH = (o.height ?? img.naturalHeight) * (o.scaleY ?? 1);
      const s = Math.max(dW / img.naturalWidth, dH / img.naturalHeight);
      const cropW = dW/s, cropH = dH/s;
      o.setElement(img);
      o.set({ width: Math.round(cropW), height: Math.round(cropH),
        cropX: Math.round((img.naturalWidth - cropW) / 2),
        cropY: Math.round((img.naturalHeight - cropH) / 2), scaleX: s, scaleY: s });
      fcRef.current.renderAll(); URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  /* ── Layers panel ──────────────────────────────────── */
  const selectFromPanel = useCallback((layerId: string) => {
    const fc = fcRef.current;
    if (!fc) return;
    /* Search top-level objects */
    let obj = (fc.getObjects() as any[]).find((o: any) => o.name === layerId);
    /* Search inside groups if not found at top level */
    if (!obj) {
      for (const topObj of fc.getObjects() as any[]) {
        if (topObj.type === "group" && topObj._objects) {
          const found = (topObj._objects as any[]).find((c: any) => c.name === layerId);
          if (found) { obj = found; break; }
        }
      }
    }
    if (!obj) return;
    fc.discardActiveObject();
    fc.setActiveObject(obj);
    fc.renderAll();
    syncSel(obj);
  }, [syncSel]);

  const toggleVisibility = useCallback((layerId: string) => {
    const fc = fcRef.current;
    if (!fc) return;
    const obj = (fc.getObjects() as any[]).find((o: any) => o.name === layerId);
    if (obj) { obj.set("visible", !(obj.visible !== false)); fc.renderAll(); rebuildLayers(); }
  }, [rebuildLayers]);

  const toggleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  /* ── Export ────────────────────────────────────────── */
  async function handleExport() {
    if (!fcRef.current) return;
    setExp(true);
    try {
      const dataUrl = fcRef.current.toDataURL({ format: "png", multiplier: exportScale / scale });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${template.id}-${exportScale}x-${Date.now()}.png`;
      a.click();
    } finally { setExp(false); }
  }

  const isBg    = sel.id === "__background__";
  const isText  = sel.type === "textbox" || sel.type === "i-text";
  const isRect  = sel.type === "rect";
  const isImage = sel.type === "image" && !isBg;
  const isGroup = sel.type === "group";
  const isInsideGroup = !!sel.parentGroupName;
  const hasSel  = !!sel.id;

  /* ── Layers recursive renderer ─────────────────────── */
  function renderLayerTree(nodes: LayerInfo[]): React.ReactNode {
    return nodes.map((layer) => {
      const isSel = sel.id === layer.id;
      const isCollapsed = collapsedGroups.has(layer.id);
      return (
        <div key={layer.id}>
          <div
            onClick={() => selectFromPanel(layer.id)}
            style={{ paddingLeft: `${12 + layer.depth * 12}px` }}
            className={cn(
              "group flex items-center gap-1.5 pr-3 py-[5px] cursor-pointer transition-colors border-l-2",
              isSel ? "bg-purple-500/15 border-purple-500" : "border-transparent hover:bg-white/[0.04]"
            )}>
            {/* Collapse toggle for groups */}
            {layer.isGroup ? (
              <button
                onClick={(e) => { e.stopPropagation(); toggleGroupCollapse(layer.id); }}
                className="shrink-0 text-white/25 hover:text-white/60 transition-colors">
                {isCollapsed
                  ? <ChevronRight className="w-2.5 h-2.5" />
                  : <ChevronDown className="w-2.5 h-2.5" />}
              </button>
            ) : (
              <span className="w-2.5 shrink-0" />
            )}
            <span className={cn("shrink-0", isSel ? "text-purple-400" : "text-white/25")}>
              <LayerTypeIcon type={layer.type} />
            </span>
            <span className={cn(
              "flex-1 truncate text-[11px] leading-none",
              !layer.visible && "opacity-40 italic",
              isSel ? "text-purple-200 font-medium" : "text-white/60"
            )}>
              {layer.name}
            </span>
            {!layer.isGroup && layer.parentGroupId && (
              <div className="shrink-0 flex opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={(e) => { e.stopPropagation(); moveChildInGroup(layer.parentGroupId!, layer.id, -1); }}
                  className="p-0.5 text-white/30 hover:text-white/70 transition-all" title="Mover para cima">
                  <ChevronRight className="w-3 h-3 -rotate-90" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveChildInGroup(layer.parentGroupId!, layer.id, 1); }}
                  className="p-0.5 text-white/30 hover:text-white/70 transition-all" title="Mover para baixo">
                  <ChevronRight className="w-3 h-3 rotate-90" />
                </button>
              </div>
            )}
            {!layer.isGroup && !layer.parentGroupId && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id); }}
                className="shrink-0 p-0.5 opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/70 transition-all">
                {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
            )}
          </div>
          {/* Render children if group is expanded */}
          {layer.isGroup && !isCollapsed && layer.children && renderLayerTree(layer.children)}
        </div>
      );
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-[400] bg-black/80" onClick={onClose} />
      <div className="fixed inset-0 z-[401] flex flex-col bg-[#0e0e11] pointer-events-auto"
        style={PANEL_FONT} onClick={(e) => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.07] shrink-0">
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-semibold text-white tracking-tight">{template.name}</span>
            <span className="ml-2 text-[10px] text-white/25">{template.w}x{template.h}px</span>
          </div>

          {/* Add elements */}
          <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            <button onClick={addText} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-white/50 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-all">
              <Type className="w-3.5 h-3.5" /> Texto
            </button>
            <button onClick={addRect} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-white/50 hover:text-white hover:bg-white/[0.08] cursor-pointer transition-all">
              <Square className="w-3.5 h-3.5" /> Forma
            </button>
          </div>

          {/* Export scale */}
          <div className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
            {([1, 1.5, 2] as const).map((s) => (
              <button key={s} onClick={() => setExportScale(s)}
                className={cn("px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all",
                  exportScale === s ? "bg-purple-600/30 text-purple-300" : "text-white/30 hover:text-white/60")}>
                {s}x
              </button>
            ))}
          </div>

          {hasSel && (
            <button onClick={del} className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={handleExport} disabled={!ready || exporting}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all",
              ready && !exporting
                ? "bg-purple-600 hover:bg-purple-500 text-white cursor-pointer active:scale-[0.98]"
                : "bg-white/[0.05] text-white/20 cursor-not-allowed")}>
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exporting ? "Exportando..." : `Baixar PNG ${exportScale > 1 ? exportScale+"x" : ""}`}
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/25 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── LEFT: Layers ─────────────────────────── */}
          <div className="w-[200px] shrink-0 border-r border-white/[0.07] bg-[#111114] flex flex-col">
            <div className="px-3.5 py-2.5 border-b border-white/[0.06] flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-white/20" />
              <span className="text-[9px] font-semibold text-white/25 uppercase tracking-[0.12em]">Camadas</span>
            </div>
            <div className="flex-1 overflow-y-auto py-1">
              {layers.length === 0 && ready && (
                <p className="px-4 pt-6 text-[11px] text-white/20 text-center leading-relaxed">Sem elementos</p>
              )}
              {renderLayerTree(layers)}
            </div>
          </div>

          {/* ── CENTER: Canvas ───────────────────────── */}
          <div className="flex-1 bg-[#080a0c] flex items-center justify-center overflow-auto">
            {!ready && (
              <div className="flex flex-col items-center gap-3 text-white/30">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-[13px]">Carregando editor...</p>
              </div>
            )}
            <div className="ring-1 ring-white/[0.1] shadow-2xl shadow-black"
              style={{ width: dispW, height: dispH, display: ready ? "block" : "none" }}>
              <canvas ref={canvasRef} />
            </div>
          </div>

          <input ref={bgInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceBackground(f); e.target.value = ""; }} />
          <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceSelectedImage(f); e.target.value = ""; }} />

          {/* ── RIGHT: Properties ────────────────────── */}
          <div className="w-[276px] shrink-0 border-l border-white/[0.07] bg-[#111114] flex flex-col overflow-y-auto" style={PANEL_FONT}>
            {!hasSel ? (
              <div className="flex flex-col flex-1">
                <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 text-center">
                  <div className="w-10 h-10 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                    <Layers className="w-4 h-4 text-white/15" />
                  </div>
                  <p className="text-[11px] text-white/25 leading-relaxed">Clique em um elemento para editar suas propriedades</p>
                </div>
                <div className="p-4 border-t border-white/[0.06]">
                  <p className="text-[9px] font-semibold text-white/20 uppercase tracking-[0.12em] mb-3">Foto de fundo</p>
                  <button onClick={() => bgInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/[0.1] text-[11px] text-white/50 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-all">
                    <Upload className="w-3.5 h-3.5" /> Trocar foto de fundo
                  </button>
                </div>
              </div>
            ) : isBg ? (
              /* ── Background selected ── */
              <div className="pb-4">
                <div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.12em]">Fundo</p>
                </div>
                <Section label="Foto de fundo">
                  <button onClick={() => bgInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/[0.1] text-[11px] text-white/50 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-all">
                    <Upload className="w-3.5 h-3.5" /> Trocar foto de fundo
                  </button>
                </Section>
                <Divider />
                <Section label="Layout">
                  <NumInput label="Opacidade" value={sel.opacity} min={0} max={100}
                    onChange={(v) => apply("opacity", v)} suffix="%" />
                </Section>
              </div>
            ) : isGroup ? (
              /* ── Group selected ── */
              <div className="pb-4">
                <div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.12em]">Grupo</p>
                </div>

                <Section label="Alinhamento">
                  <div className="flex gap-1">
                    {(["left","centerH","right","top","centerV","bottom"] as const).map((d) => (
                      <IconBtn key={d} onClick={() => alignTo(d)} title={d}>
                        {AlignIcons[d]}
                      </IconBtn>
                    ))}
                  </div>
                </Section>

                <Divider />

                <Section label="Layout">
                  <div className="grid grid-cols-2 gap-2">
                    <NumInput label="X" value={sel.left} onChange={(v) => applyPos("left", v)} suffix="px" />
                    <NumInput label="Y" value={sel.top}  onChange={(v) => applyPos("top", v)}  suffix="px" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumInput label="W" value={sel.width} min={1} onChange={(v) => applySize("width", v)} suffix="px" />
                    <NumInput label="H" value={sel.height} min={1} onChange={(v) => applySize("height", v)} suffix="px" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumInput label="Rotacao" value={sel.angle} min={-360} max={360} onChange={(v) => apply("angle", v)} suffix="deg" />
                    <NumInput label="Opacidade" value={sel.opacity} min={0} max={100} onChange={(v) => apply("opacity", v)} suffix="%" />
                  </div>
                </Section>

                <Divider />

                {/* ── Auto-layout ── */}
                <Section label="Auto-layout">
                  <div>
                    <span className="block text-[9px] text-white/25 uppercase tracking-wider font-medium mb-1">Direcao</span>
                    <div className="flex gap-1">
                      {(["horizontal", "vertical", "none"] as const).map((d) => (
                        <button key={d} onClick={() => {
                          setSel((p) => ({ ...p, layoutDir: d }));
                          reLayoutGroup(d, sel.layoutGap);
                        }}
                          className={cn("flex-1 py-1.5 rounded-md text-[10px] font-medium cursor-pointer transition-all border",
                            sel.layoutDir === d
                              ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                              : "border-white/[0.09] text-white/30 hover:text-white/60")}>
                          {d === "horizontal" ? "H" : d === "vertical" ? "V" : "Livre"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {sel.layoutDir !== "none" && (
                    <NumInput label="Espacamento entre itens" value={sel.layoutGap} min={0} max={200} step={1}
                      onChange={(v) => { setSel((p) => ({ ...p, layoutGap: v })); reLayoutGroup(sel.layoutDir, v); }} suffix="px" />
                  )}
                </Section>

                <Divider />

                <div className="px-4 pt-3">
                  <p className="text-[10px] text-white/30 leading-relaxed">Clique duplo para editar elementos dentro do grupo. ESC para sair.</p>
                </div>
              </div>
            ) : (
              <div className="pb-4">

                {/* Breadcrumb when inside a group */}
                {isInsideGroup && (
                  <div className="px-4 pt-3 pb-2 border-b border-white/[0.06] flex items-center gap-1.5">
                    <button
                      onClick={exitGroup}
                      className="text-[10px] text-purple-400/70 hover:text-purple-300 cursor-pointer transition-colors">
                      {sel.parentGroupName}
                    </button>
                    <ChevronRight className="w-2.5 h-2.5 text-white/20 shrink-0" />
                    <span className="text-[10px] text-white/50 truncate">
                      {isText ? "Texto" : isRect ? "Forma" : isImage ? "Imagem" : "Elemento"}
                    </span>
                  </div>
                )}

                {/* Type header */}
                {!isInsideGroup && (
                  <div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
                    <p className="text-[10px] font-semibold text-white/40 uppercase tracking-[0.12em]">
                      {isText ? "Texto" : isRect ? "Forma" : isImage ? "Imagem" : "Elemento"}
                    </p>
                  </div>
                )}

                {/* ── Alinhamento ── */}
                <Section label="Alinhamento">
                  <div className="flex gap-1">
                    {(["left","centerH","right","top","centerV","bottom"] as const).map((d) => (
                      <IconBtn key={d} onClick={() => alignTo(d)} title={d}>
                        {AlignIcons[d]}
                      </IconBtn>
                    ))}
                    <div className="flex-1" />
                    <IconBtn onClick={() => flipObj("x")} active={sel.flipX} title="Flip horizontal">
                      {AlignIcons.flipH}
                    </IconBtn>
                    <IconBtn onClick={() => flipObj("y")} active={sel.flipY} title="Flip vertical">
                      {AlignIcons.flipV}
                    </IconBtn>
                  </div>
                </Section>

                <Divider />

                {/* ── Layout / Transformar ── */}
                <Section label="Layout">
                  <div className="grid grid-cols-2 gap-2">
                    <NumInput label="X" value={sel.left} onChange={(v) => applyPos("left", v)} suffix="px" />
                    <NumInput label="Y" value={sel.top}  onChange={(v) => applyPos("top", v)}  suffix="px" />
                  </div>
                  {(isText || isRect) && (
                    <div className="grid grid-cols-[1fr_24px_1fr] items-end gap-1">
                      <NumInput label="W" value={sel.width}  min={1} onChange={(v) => applySize("width", v)}  suffix="px" />
                      <button
                        onClick={() => setLockAspect((x) => !x)}
                        title="Travar proporcao"
                        className={cn("mb-[3px] flex items-center justify-center w-6 h-6 rounded cursor-pointer transition-colors border",
                          lockAspect ? "border-purple-500/50 text-purple-400 bg-purple-500/10" : "border-white/10 text-white/20 hover:text-white/50")}>
                        {lockAspect ? <Link className="w-3 h-3" /> : <Link2Off className="w-3 h-3" />}
                      </button>
                      <NumInput label="H" value={sel.height} min={1} onChange={(v) => applySize("height", v)} suffix="px" />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <NumInput label="Rotacao" value={sel.angle} min={-360} max={360} onChange={(v) => apply("angle", v)} suffix="deg" />
                    <NumInput label="Opacidade" value={sel.opacity} min={0} max={100} onChange={(v) => apply("opacity", v)} suffix="%" />
                  </div>
                </Section>

                <Divider />

                {/* ── Aparencia (corner radius) ── */}
                {isRect && (
                  <>
                    <Section label="Aparencia">
                      <NumInput label="Raio de borda" value={sel.rx} min={0} max={500}
                        onChange={(v) => { apply("rx", v); apply("ry", v); }} suffix="px" />
                    </Section>
                    <Divider />
                  </>
                )}

                {/* ── Preenchimento ── */}
                <Section label="Preenchimento">
                  <div className="flex gap-1 mb-1">
                    {(["solid", "gradient"] as const).map((t) => (
                      <button key={t}
                        onClick={() => {
                          if (t === "solid") { apply("fill", sel.fill); setSel((p) => ({ ...p, fillType: "solid" })); }
                          else applyGradient(sel.gradientStart, sel.gradientEnd, sel.gradientAngle);
                        }}
                        className={cn("flex-1 py-1.5 rounded-md text-[10px] font-medium cursor-pointer transition-all border",
                          sel.fillType === t
                            ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                            : "border-white/[0.09] text-white/30 hover:text-white/60")}>
                        {t === "solid" ? "Solido" : "Degrade"}
                      </button>
                    ))}
                  </div>

                  {sel.fillType === "solid" ? (
                    <ColorInput label="" value={sel.fill} onChange={(v) => apply("fill", v)} />
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <ColorInput label="Inicio" value={sel.gradientStart}
                          onChange={(v) => applyGradient(v, sel.gradientEnd, sel.gradientAngle)} />
                        <ColorInput label="Fim" value={sel.gradientEnd}
                          onChange={(v) => applyGradient(sel.gradientStart, v, sel.gradientAngle)} />
                      </div>
                      <NumInput label="Angulo" value={sel.gradientAngle} min={0} max={360}
                        onChange={(v) => applyGradient(sel.gradientStart, sel.gradientEnd, v)} suffix="deg" />
                    </div>
                  )}
                </Section>

                <Divider />

                {/* ── Tracado ── */}
                {(isText || isRect) && (
                  <>
                    <Section label="Tracado">
                      <div className="grid grid-cols-[1fr_72px] gap-2 items-end">
                        <ColorInput label="Cor" value={sel.stroke} onChange={(v) => apply("stroke", v)} />
                        <NumInput label="Espessura" value={sel.strokeWidth} min={0} max={80} onChange={(v) => apply("strokeWidth", v)} suffix="px" />
                      </div>
                    </Section>
                    <Divider />
                  </>
                )}

                {/* ── Tipografia ── */}
                {isText && (
                  <>
                    <Section label="Tipografia">
                      <div>
                        <span className="block text-[9px] text-white/25 uppercase tracking-wider font-medium mb-1">Fonte</span>
                        <FontPicker value={sel.fontFamily}
                          onChange={async (v) => { await loadSingleFont(v); apply("fontFamily", v); }} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <NumInput label="Tamanho" value={sel.fontSize} min={8} max={600} step={2} onChange={(v) => apply("fontSize", v)} suffix="px" />
                        <NumInput label="Altura linha" value={Math.round(sel.lineHeight * 100) / 100} min={0.5} max={3} step={0.05} onChange={(v) => apply("lineHeight", v)} />
                      </div>
                      <NumInput label="Espaco entre letras" value={sel.charSpacing} min={-200} max={2000} step={10} onChange={(v) => apply("charSpacing", v)} />
                      <div>
                        <span className="block text-[9px] text-white/25 uppercase tracking-wider font-medium mb-1">Peso</span>
                        <div className="grid grid-cols-5 gap-1">
                          {(["300","400","600","700","900"] as const).map((w) => (
                            <button key={w} onClick={() => apply("fontWeight", w)}
                              className={cn("py-1.5 rounded-md text-[9px] font-semibold cursor-pointer transition-all border",
                                sel.fontWeight === w
                                  ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                                  : "border-white/[0.09] text-white/30 hover:text-white/60")}>
                              {w === "300" ? "Thin" : w === "400" ? "Reg" : w === "600" ? "Semi" : w === "700" ? "Bold" : "Black"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-[auto_1fr] gap-2">
                        <button onClick={() => apply("fontStyle", sel.fontStyle === "italic" ? "normal" : "italic")}
                          className={cn("px-3 py-1.5 rounded-md cursor-pointer transition-all border flex items-center justify-center",
                            sel.fontStyle === "italic"
                              ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                              : "border-white/[0.09] text-white/30 hover:text-white/60")}>
                          <Italic className="w-3 h-3" />
                        </button>
                        <div className="flex gap-1">
                          {(["left","center","right"] as const).map((a) => (
                            <button key={a} onClick={() => apply("textAlign", a)}
                              className={cn("flex-1 flex items-center justify-center py-1.5 rounded-md cursor-pointer transition-all border",
                                sel.textAlign === a
                                  ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                                  : "border-white/[0.09] text-white/30 hover:text-white/60")}>
                              {a === "left" ? <AlignLeft className="w-3.5 h-3.5" /> : a === "center" ? <AlignCenter className="w-3.5 h-3.5" /> : <AlignRight className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <ColorInput label="Cor do texto" value={sel.fill} onChange={(v) => apply("fill", v)} />
                    </Section>
                    <Divider />
                  </>
                )}

                {/* ── Efeitos (sombra) ── */}
                <Section label="Efeitos">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/50">Sombra</span>
                    <button
                      onClick={() => applyShadow({ shadowEnabled: !sel.shadowEnabled })}
                      className={cn("relative w-9 h-5 rounded-full transition-colors cursor-pointer",
                        sel.shadowEnabled ? "bg-purple-600" : "bg-white/10")}>
                      <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                        sel.shadowEnabled ? "left-4" : "left-0.5")} />
                    </button>
                  </div>
                  {sel.shadowEnabled && (
                    <div className="space-y-2 pt-1">
                      <ColorInput label="Cor" value={sel.shadowColor}
                        onChange={(v) => applyShadow({ shadowColor: v })} />
                      <div className="grid grid-cols-3 gap-2">
                        <NumInput label="Blur" value={sel.shadowBlur} min={0} max={100}
                          onChange={(v) => applyShadow({ shadowBlur: v })} suffix="px" />
                        <NumInput label="Offset X" value={sel.shadowOffsetX} min={-100} max={100}
                          onChange={(v) => applyShadow({ shadowOffsetX: v })} suffix="px" />
                        <NumInput label="Offset Y" value={sel.shadowOffsetY} min={-100} max={100}
                          onChange={(v) => applyShadow({ shadowOffsetY: v })} suffix="px" />
                      </div>
                    </div>
                  )}
                </Section>

                {/* ── Imagem ── */}
                {isImage && (
                  <>
                    <Divider />
                    <Section label="Imagem">
                      <button onClick={() => imgInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-white/[0.1] text-[11px] text-white/50 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-all">
                        <Upload className="w-3.5 h-3.5" /> Trocar imagem
                      </button>
                    </Section>
                  </>
                )}

                {/* ── Exportar (por elemento ou frame) ── */}
                <Divider />
                <Section label="Exportar">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {([1, 1.5, 2] as const).map((s) => (
                        <button key={s} onClick={() => setExportScale(s)}
                          className={cn("px-2.5 py-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all border",
                            exportScale === s
                              ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                              : "border-white/[0.09] text-white/30 hover:text-white/60")}>
                          {s}x
                        </button>
                      ))}
                    </div>
                    <span className="flex-1 text-[10px] text-white/25">PNG</span>
                  </div>
                  <button onClick={handleExport} disabled={!ready || exporting}
                    className={cn("w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                      ready && !exporting ? "bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600/30" : "bg-white/[0.04] border border-white/[0.06] text-white/20 cursor-not-allowed")}>
                    {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Exportar {template.name} {exportScale}x
                  </button>
                </Section>

                {/* ── Remover ── */}
                <div className="mx-4 mt-3 border-t border-white/[0.06] pt-3">
                  <button onClick={del}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-red-500/15 text-[11px] text-red-400/50 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-all">
                    <Trash2 className="w-3.5 h-3.5" /> Remover elemento
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Hint bar ───────────────────────────────── */}
        <div className="flex items-center gap-5 px-5 py-2 border-t border-white/[0.06] shrink-0">
          {["Clique duplo no grupo para entrar","ESC para sair do grupo","Arraste para mover","Del para remover"].map((h) => (
            <span key={h} className="text-[9px] text-white/15">{h}</span>
          ))}
        </div>
      </div>
    </>
  );
}
