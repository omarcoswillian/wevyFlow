"use client";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Type, Palette, Space, MousePointer } from "lucide-react";

export interface ElementProps {
  tag: string;
  text: string | null;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  marginTop: string;
  marginRight: string;
  marginBottom: string;
  marginLeft: string;
  paddingTop: string;
  paddingRight: string;
  paddingBottom: string;
  paddingLeft: string;
  borderRadius: string;
  textAlign: string;
  lineHeight: string;
  letterSpacing: string;
}

interface VisualEditorProps {
  elementProps: ElementProps | null;
  onStyleChange: (property: string, value: string) => void;
  onTextChange: (value: string) => void;
  onBack: () => void;
}

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "40px", "48px", "56px", "64px", "72px"];
const FONT_WEIGHTS = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
];

export function VisualEditor({ elementProps, onStyleChange, onTextChange, onBack }: VisualEditorProps) {
  if (!elementProps) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-3">
          <MousePointer className="w-5 h-5 text-purple-400" />
        </div>
        <p className="text-[13px] font-medium text-white/60 mb-1">Visual edits</p>
        <p className="text-[11px] text-white/30 leading-relaxed">Clique em um elemento no preview para editá-lo</p>
        <p className="text-[10px] text-white/15 mt-3">Cmd+click para múltiplos</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <button onClick={onBack} className="flex items-center gap-2 text-[12px] text-white/40 hover:text-white/70 transition-colors cursor-pointer mb-2">
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar ao Chat
        </button>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400 text-[10px] font-mono">{elementProps.tag}</span>
        </div>
      </div>

      <div className="px-4 py-3 space-y-5">
        {/* Text */}
        {elementProps.text !== null && (
          <section>
            <Label className="flex items-center gap-1.5 mb-2">
              <Type className="w-3 h-3" /> Texto
            </Label>
            <textarea
              defaultValue={elementProps.text}
              onChange={(e) => onTextChange(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30 resize-none h-20"
            />
          </section>
        )}

        {/* Typography */}
        <section>
          <Label className="flex items-center gap-1.5 mb-2">
            <Type className="w-3 h-3" /> Tipografia
          </Label>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-white/20 mb-1 block">Tamanho</span>
                <select
                  defaultValue={elementProps.fontSize}
                  onChange={(e) => onStyleChange("fontSize", e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none cursor-pointer"
                >
                  {FONT_SIZES.map((s) => (
                    <option key={s} value={s} className="bg-[#1a1a1a]">{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-[9px] text-white/20 mb-1 block">Peso</span>
                <select
                  defaultValue={elementProps.fontWeight}
                  onChange={(e) => onStyleChange("fontWeight", e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none cursor-pointer"
                >
                  {FONT_WEIGHTS.map((w) => (
                    <option key={w.value} value={w.value} className="bg-[#1a1a1a]">{w.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-white/20 mb-1 block">Alinhamento</span>
                <div className="flex gap-0.5">
                  {(["left", "center", "right"] as const).map((a) => (
                    <button key={a} onClick={() => onStyleChange("textAlign", a)}
                      className={cn("flex-1 py-1.5 rounded-lg text-[10px] cursor-pointer transition-all",
                        elementProps.textAlign === a ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/30 hover:text-white/50")}>
                      {a === "left" ? "Esq" : a === "center" ? "Centro" : "Dir"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[9px] text-white/20 mb-1 block">Estilo</span>
                <div className="flex gap-0.5">
                  <button onClick={() => onStyleChange("fontStyle", elementProps.fontStyle === "italic" ? "normal" : "italic")}
                    className={cn("flex-1 py-1.5 rounded-lg text-[10px] cursor-pointer transition-all italic",
                      elementProps.fontStyle === "italic" ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/30")}>
                    Itálico
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Colors */}
        <section>
          <Label className="flex items-center gap-1.5 mb-2">
            <Palette className="w-3 h-3" /> Cores
          </Label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">Texto</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/20 font-mono">{elementProps.color}</span>
                <input type="color" defaultValue={rgbToHex(elementProps.color)} onChange={(e) => onStyleChange("color", e.target.value)}
                  className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/30">Fundo</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/20 font-mono">{elementProps.backgroundColor}</span>
                <input type="color" defaultValue={rgbToHex(elementProps.backgroundColor)} onChange={(e) => onStyleChange("backgroundColor", e.target.value)}
                  className="w-6 h-6 rounded-md cursor-pointer bg-transparent border-0" />
              </div>
            </div>
          </div>
        </section>

        {/* Spacing */}
        <section>
          <Label className="flex items-center gap-1.5 mb-2">
            <Space className="w-3 h-3" /> Espaçamento
          </Label>

          <div className="space-y-3">
            <div>
              <span className="text-[9px] text-white/20 mb-1.5 block">Margin</span>
              <div className="grid grid-cols-4 gap-1.5">
                {(["marginTop", "marginRight", "marginBottom", "marginLeft"] as const).map((prop, i) => (
                  <div key={prop}>
                    <span className="text-[8px] text-white/15 block text-center mb-0.5">{["T", "R", "B", "L"][i]}</span>
                    <input type="text" defaultValue={elementProps[prop]} onChange={(e) => onStyleChange(prop, e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-[10px] text-white text-center focus:outline-none focus:border-purple-500/30" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[9px] text-white/20 mb-1.5 block">Padding</span>
              <div className="grid grid-cols-4 gap-1.5">
                {(["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const).map((prop, i) => (
                  <div key={prop}>
                    <span className="text-[8px] text-white/15 block text-center mb-0.5">{["T", "R", "B", "L"][i]}</span>
                    <input type="text" defaultValue={elementProps[prop]} onChange={(e) => onStyleChange(prop, e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-[10px] text-white text-center focus:outline-none focus:border-purple-500/30" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[9px] text-white/20 mb-1 block">Border Radius</span>
              <input type="text" defaultValue={elementProps.borderRadius} onChange={(e) => onStyleChange("borderRadius", e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[10px] text-white focus:outline-none focus:border-purple-500/30" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return "#000000";
  const [r, g, b] = match.map(Number);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
