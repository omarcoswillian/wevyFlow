"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Pipette, Eye, EyeOff } from "lucide-react";

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Popover anchored to the right of the trigger (default) or below. */
  align?: "right" | "bottom";
  /** Show alpha slider (default true). */
  allowAlpha?: boolean;
}

const SWATCHES_KEY = "wevyflow-color-swatches";

export function ColorPicker({ value, onChange, align = "right", allowAlpha = true }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [rgba, setRgba] = useState<RGBA>(() => parseColor(value));
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync when external value changes (undo/redo, selection)
  useEffect(() => { setRgba(parseColor(value)); }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!popoverRef.current || !triggerRef.current) return;
      if (popoverRef.current.contains(e.target as Node) || triggerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    setTimeout(() => document.addEventListener("mousedown", onClick), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commit = useCallback((next: RGBA) => {
    setRgba(next);
    onChange(formatColor(next, allowAlpha));
  }, [onChange, allowAlpha]);

  const saveSwatch = useCallback(() => {
    try {
      const raw = localStorage.getItem(SWATCHES_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      const hex = rgbaToHex(rgba);
      const next = [hex, ...list.filter((c) => c !== hex)].slice(0, 16);
      localStorage.setItem(SWATCHES_KEY, JSON.stringify(next));
    } catch {}
  }, [rgba]);

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        onClick={() => setOpen((x) => !x)}
        className="w-6 h-6 rounded-md border border-white/[0.1] cursor-pointer hover:scale-105 transition-transform relative overflow-hidden"
        style={{
          background: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='4' height='4' fill='%23555'/><rect x='4' y='4' width='4' height='4' fill='%23555'/><rect x='4' width='4' height='4' fill='%23999'/><rect y='4' width='4' height='4' fill='%23999'/></svg>")`,
        }}
      >
        <span className="absolute inset-0" style={{ background: formatColor(rgba, true) }} />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className={cn(
            "absolute z-[200] w-[240px] rounded-xl bg-[#1a1a1e] border border-white/[0.1] shadow-2xl p-3 space-y-3",
            align === "right" ? "right-full top-0 mr-2" : "top-full right-0 mt-2"
          )}
          onBlur={saveSwatch}
        >
          <SVArea hue={rgba.h} sat={rgba.s} val={rgba.v} onChange={(s, v) => commit({ ...rgba, s, v, ...hsvToRgb(rgba.h, s, v) })} />
          <HueSlider hue={rgba.h} onChange={(h) => commit({ ...rgba, h, ...hsvToRgb(h, rgba.s, rgba.v) })} />
          {allowAlpha && (
            <AlphaSlider alpha={rgba.a} color={rgba} onChange={(a) => commit({ ...rgba, a })} />
          )}

          {/* Hex + RGB row */}
          <div className="flex gap-1.5">
            <HexInput value={rgbaToHex(rgba)} onChange={(hex) => {
              const parsed = parseColor(hex);
              if (parsed) commit({ ...parsed, a: rgba.a });
            }} />
            {allowAlpha && (
              <input
                type="text"
                value={Math.round(rgba.a * 100)}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/\D/g, ""));
                  if (!isNaN(n)) commit({ ...rgba, a: Math.max(0, Math.min(100, n)) / 100 });
                }}
                className="w-12 bg-white/[0.04] border border-white/[0.06] rounded-md px-1.5 py-1 text-[10px] text-white text-center focus:outline-none focus:border-purple-500/30"
              />
            )}
          </div>

          <SwatchesRow
            current={rgbaToHex(rgba)}
            onPick={(hex) => {
              const parsed = parseColor(hex);
              if (parsed) commit({ ...parsed, a: rgba.a });
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ─── Saturation/Value 2D area ─── */
function SVArea({ hue, sat, val, onChange }: { hue: number; sat: number; val: number; onChange: (s: number, v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handle = (e: MouseEvent | React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    onChange(x, 1 - y);
  };

  useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) handle(e); };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      onMouseDown={(e) => { dragging.current = true; handle(e); }}
      className="relative w-full h-[140px] rounded-lg cursor-crosshair overflow-hidden"
      style={{
        background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue}, 100%, 50%))`,
      }}
    >
      <div
        className="absolute w-3 h-3 rounded-full border-2 border-white shadow-md pointer-events-none"
        style={{ left: `calc(${sat * 100}% - 6px)`, top: `calc(${(1 - val) * 100}% - 6px)` }}
      />
    </div>
  );
}

/* ─── Hue slider ─── */
function HueSlider({ hue, onChange }: { hue: number; onChange: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handle = (e: MouseEvent | React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onChange(x * 360);
  };

  useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) handle(e); };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      onMouseDown={(e) => { dragging.current = true; handle(e); }}
      className="relative w-full h-2 rounded-full cursor-pointer"
      style={{ background: "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)" }}
    >
      <div
        className="absolute -top-1 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
        style={{ left: `calc(${(hue / 360) * 100}% - 8px)`, background: `hsl(${hue}, 100%, 50%)` }}
      />
    </div>
  );
}

/* ─── Alpha slider ─── */
function AlphaSlider({ alpha, color, onChange }: { alpha: number; color: RGBA; onChange: (a: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handle = (e: MouseEvent | React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onChange(x);
  };

  useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) handle(e); };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const solid = `rgb(${color.r},${color.g},${color.b})`;

  return (
    <div
      ref={ref}
      onMouseDown={(e) => { dragging.current = true; handle(e); }}
      className="relative w-full h-2 rounded-full cursor-pointer overflow-hidden"
      style={{
        background: `linear-gradient(to right, transparent, ${solid}), url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><rect width='4' height='4' fill='%23555'/><rect x='4' y='4' width='4' height='4' fill='%23555'/><rect x='4' width='4' height='4' fill='%23999'/><rect y='4' width='4' height='4' fill='%23999'/></svg>")`,
      }}
    >
      <div
        className="absolute -top-1 w-4 h-4 rounded-full border-2 border-white shadow-md pointer-events-none"
        style={{ left: `calc(${alpha * 100}% - 8px)`, background: solid }}
      />
    </div>
  );
}

/* ─── Hex input ─── */
function HexInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <div className="flex-1 flex items-center bg-white/[0.04] border border-white/[0.06] rounded-md focus-within:border-purple-500/30">
      <span className="text-[10px] text-white/30 pl-2 select-none">#</span>
      <input
        type="text"
        value={local.replace(/^#/, "")}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const clean = local.trim().replace(/^#/, "");
          if (/^[0-9a-fA-F]{3}$/.test(clean) || /^[0-9a-fA-F]{6}$/.test(clean)) {
            onChange("#" + clean);
          } else {
            setLocal(value);
          }
        }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="flex-1 min-w-0 bg-transparent px-1 py-1 text-[11px] text-white uppercase font-mono focus:outline-none"
      />
    </div>
  );
}

/* ─── Swatches row (recent) ─── */
function SwatchesRow({ current, onPick }: { current: string; onPick: (hex: string) => void }) {
  const [swatches, setSwatches] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SWATCHES_KEY);
      if (raw) setSwatches(JSON.parse(raw));
    } catch {}
  }, []);

  // Refresh when current changes (after a commit, a save may have happened)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SWATCHES_KEY);
      if (raw) setSwatches(JSON.parse(raw));
    } catch {}
  }, [current]);

  const defaults = ["#000000", "#FFFFFF", "#FF5C00", "#6366F1", "#A855F7", "#22C55E", "#EF4444", "#F59E0B"];
  const list = swatches.length > 0 ? swatches : defaults;

  return (
    <div className="grid grid-cols-8 gap-1">
      {list.map((hex) => (
        <button
          key={hex}
          onClick={() => onPick(hex)}
          title={hex}
          className="w-5 h-5 rounded border border-white/[0.08] hover:scale-110 transition-transform cursor-pointer"
          style={{ background: hex }}
        />
      ))}
    </div>
  );
}

/* ─── Color utilities ─── */

interface RGBA { r: number; g: number; b: number; a: number; h: number; s: number; v: number }

function parseColor(input: string): RGBA {
  if (!input) return { r: 0, g: 0, b: 0, a: 1, h: 0, s: 0, v: 0 };

  // rgba(r, g, b, a) / rgb(r, g, b)
  let m = input.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (m) {
    const r = Math.round(+m[1]);
    const g = Math.round(+m[2]);
    const b = Math.round(+m[3]);
    const a = m[4] !== undefined ? +m[4] : 1;
    return { r, g, b, a, ...rgbToHsv(r, g, b) };
  }

  // Hex #RGB / #RRGGBB / #RRGGBBAA
  m = input.match(/^#?([0-9a-fA-F]{3,8})$/);
  if (m) {
    let hex = m[1];
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a, ...rgbToHsv(r, g, b) };
    }
  }

  return { r: 0, g: 0, b: 0, a: 1, h: 0, s: 0, v: 0 };
}

function formatColor(c: RGBA, allowAlpha: boolean): string {
  if (!allowAlpha || c.a === 1) {
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  }
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${Math.round(c.a * 100) / 100})`;
}

function rgbaToHex(c: RGBA): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return "#" + toHex(c.r) + toHex(c.g) + toHex(c.b);
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rr) h = ((gg - bb) / d) % 6;
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rr = 0, gg = 0, bb = 0;
  if (h < 60)       { rr = c; gg = x; bb = 0; }
  else if (h < 120) { rr = x; gg = c; bb = 0; }
  else if (h < 180) { rr = 0; gg = c; bb = x; }
  else if (h < 240) { rr = 0; gg = x; bb = c; }
  else if (h < 300) { rr = x; gg = 0; bb = c; }
  else              { rr = c; gg = 0; bb = x; }
  return {
    r: Math.round((rr + m) * 255),
    g: Math.round((gg + m) * 255),
    b: Math.round((bb + m) * 255),
  };
}
