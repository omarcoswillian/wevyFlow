"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X, Download, Loader2, ChevronLeft, Eye } from "lucide-react";
import type { TemplateDef } from "../lib/creative-templates";

interface CreativeEditorProps {
  template: TemplateDef;
  onClose: () => void;
}

export function CreativeEditor({ template, onClose }: CreativeEditorProps) {
  /* ─── Form state ─ */
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(template.fields.map((f) => [f.id, f.default]))
  );
  const [exporting, setExporting] = useState(false);

  /* ─── Refs for export ─ */
  const exportRef = useRef<HTMLDivElement>(null);

  /* ─── Preview scale ─ */
  const PREVIEW_H = template.h === 1920 ? 540 : 480;
  const scale = PREVIEW_H / template.h;
  const previewW = Math.round(template.w * scale);

  const set = useCallback((id: string, val: string) => {
    setValues((prev) => ({ ...prev, [id]: val }));
  }, []);

  /* ─── Export PNG ─ */
  async function handleExport() {
    if (!exportRef.current) return;
    setExporting(true);
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(exportRef.current, {
        pixelRatio: 1,
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${template.id}-${Date.now()}.png`;
      a.click();
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[400] bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[401] flex items-center justify-center p-6 pointer-events-none">
        <div
          className="pointer-events-auto flex flex-col w-full max-w-[1100px] max-h-[calc(100vh-48px)] rounded-2xl bg-[#111114] border border-white/[0.08] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Header ── */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.07] shrink-0">
            <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-all">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-white truncate">{template.name}</p>
              <p className="text-[11px] text-white/30">{template.client} · {template.format === "stories" ? "Stories 9:16" : "Feed 1:1"} · {template.w}×{template.h}px</p>
            </div>
            {/* Reference thumbnail */}
            <div className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={template.referencePath} alt="ref" className="w-10 h-10 rounded-lg object-cover border border-white/[0.1] opacity-60" />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExport}
                disabled={exporting}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all cursor-pointer",
                  exporting ? "bg-white/[0.06] text-white/30" : "bg-purple-600 hover:bg-purple-500 text-white active:scale-[0.98]"
                )}
              >
                {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {exporting ? "Exportando..." : "Baixar PNG 1080px"}
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg text-white/25 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* Left: form */}
            <div className="w-[300px] shrink-0 border-r border-white/[0.06] overflow-y-auto px-5 py-5 space-y-4">
              <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">Campos editáveis</p>

              {template.fields.map((field) => (
                <div key={field.id}>
                  <label className="block text-[11px] text-white/40 mb-1.5 font-medium">{field.label}</label>

                  {field.type === "color" ? (
                    <div
                      className="flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2.5 cursor-pointer hover:border-white/15 transition-colors"
                      onClick={() => document.getElementById(`color-${field.id}`)?.click()}
                    >
                      <div className="w-5 h-5 rounded-md shrink-0 ring-1 ring-white/10" style={{ backgroundColor: values[field.id] }} />
                      <span className="text-[11px] text-white/50 font-mono flex-1">{values[field.id]?.toUpperCase()}</span>
                      <input
                        id={`color-${field.id}`}
                        type="color"
                        value={values[field.id]}
                        onChange={(e) => set(field.id, e.target.value)}
                        className="hidden"
                      />
                    </div>
                  ) : field.type === "textarea" ? (
                    <div>
                      <textarea
                        value={values[field.id]}
                        onChange={(e) => set(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        rows={3}
                        className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-white/15 focus:outline-none focus:border-purple-500/50 focus:bg-purple-500/5 transition-all resize-none leading-relaxed"
                      />
                      {field.hint && (
                        <p className="text-[10px] text-white/20 mt-1">{field.hint}</p>
                      )}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={values[field.id]}
                      onChange={(e) => set(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-white/15 focus:outline-none focus:border-purple-500/50 focus:bg-purple-500/5 transition-all"
                    />
                  )}
                </div>
              ))}

              {/* Reset */}
              <button
                onClick={() => setValues(Object.fromEntries(template.fields.map((f) => [f.id, f.default])))}
                className="w-full py-2 rounded-xl border border-white/[0.07] text-[11px] text-white/25 hover:text-white/50 hover:border-white/15 cursor-pointer transition-all mt-2"
              >
                Resetar valores
              </button>
            </div>

            {/* Right: live preview */}
            <div className="flex-1 min-w-0 bg-[#0a0a0c] flex flex-col items-center justify-center gap-4 overflow-hidden p-6">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-3.5 h-3.5 text-white/20" />
                <span className="text-[10px] text-white/20 uppercase tracking-widest font-semibold">Preview em tempo real</span>
              </div>

              {/* Scaled preview wrapper */}
              <div
                className="rounded-2xl overflow-hidden ring-1 ring-white/[0.08] shadow-2xl shadow-black/60"
                style={{ width: previewW, height: PREVIEW_H, flexShrink: 0 }}
              >
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: template.w, height: template.h }}>
                  {template.render(values)}
                </div>
              </div>

              <p className="text-[10px] text-white/15 font-mono">{template.w} × {template.h} px · PNG sem marca d&apos;água</p>
            </div>
          </div>

          {/* ── Hidden full-size export node ── */}
          <div
            style={{ position: "fixed", left: -9999, top: -9999, opacity: 0, pointerEvents: "none" }}
            aria-hidden
          >
            <div ref={exportRef} style={{ width: template.w, height: template.h }}>
              {template.render(values)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
