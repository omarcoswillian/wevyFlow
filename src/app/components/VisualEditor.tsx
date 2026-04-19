"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Type, Palette, Space, MousePointer, AlignLeft, AlignCenter, AlignRight, AlignJustify, Underline, Strikethrough, Italic, LayoutGrid, MoveHorizontal, MoveVertical, ArrowDownNarrowWide, Copy, Trash2, ArrowUp, ArrowDown, Link2, FileText, LogIn, Mail, Phone, Anchor, Package, PlayCircle } from "lucide-react";
import { GOOGLE_FONTS, findFont, cssFontStack } from "@/app/lib/editor/google-fonts";
import { NumberInput } from "./inspector/NumberInput";
import { ColorPicker } from "./inspector/ColorPicker";

export interface ElementProps {
  tag: string;
  tagName: string;
  text: string | null;
  href: string;
  target: string;
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
  textTransform: string;
  textDecoration: string;
  display: string;
  flexDirection: string;
  flexWrap: string;
  justifyContent: string;
  alignItems: string;
  gap: string;
  width: string;
  height: string;
  opacity: string;
  backgroundImage: string;
  backgroundSize: string;
  backgroundPosition: string;
  filter: string;
}

interface VisualEditorProps {
  elementProps: ElementProps | null;
  viewport?: "ultrawide" | "desktop" | "tablet" | "mobile";
  onStyleChange: (property: string, value: string) => void;
  onTextChange: (value: string) => void;
  onAttrChange: (name: string, value: string | null) => void;
  onFontLoad: (family: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
  onSaveComponent: () => void;
  onBack: () => void;
}

const VIEWPORT_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  ultrawide: { label: "ULTRA-WIDE",  bg: "bg-indigo-500/15",   text: "text-indigo-300" },
  desktop:   { label: "DESKTOP",     bg: "bg-emerald-500/12",  text: "text-emerald-300" },
  tablet:    { label: "TABLET",      bg: "bg-amber-500/15",    text: "text-amber-300" },
  mobile:    { label: "MOBILE",      bg: "bg-rose-500/15",     text: "text-rose-300" },
};

const FONT_SIZES = ["10px", "11px", "12px", "13px", "14px", "15px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "40px", "48px", "56px", "64px", "72px", "84px", "96px"];
const FONT_WEIGHTS = [
  { value: "100", label: "Thin" },
  { value: "200", label: "Extra Light" },
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
  { value: "900", label: "Black" },
];

const CATEGORIES: { id: "sans" | "serif" | "display" | "mono"; label: string }[] = [
  { id: "sans", label: "Sans-serif" },
  { id: "display", label: "Display" },
  { id: "serif", label: "Serif" },
  { id: "mono", label: "Mono" },
];

const ALIGN_OPTIONS = [
  { value: "left", label: "Esquerda", icon: <AlignLeft className="w-3 h-3" /> },
  { value: "center", label: "Centro", icon: <AlignCenter className="w-3 h-3" /> },
  { value: "right", label: "Direita", icon: <AlignRight className="w-3 h-3" /> },
  { value: "justify", label: "Justificar", icon: <AlignJustify className="w-3 h-3" /> },
];

const TRANSFORM_OPTIONS = [
  { value: "none", label: "Normal", display: "—" },
  { value: "uppercase", label: "Maiúsculas", display: "AG" },
  { value: "lowercase", label: "Minúsculas", display: "ag" },
  { value: "capitalize", label: "Capitalizar", display: "Ag" },
];

const DISPLAY_OPTIONS = [
  { value: "block", label: "Block", display: "Block" },
  { value: "flex", label: "Flex", display: "Flex" },
  { value: "grid", label: "Grid", display: "Grid" },
  { value: "inline-block", label: "Inline", display: "Inline" },
  { value: "none", label: "Hidden", display: "—" },
];

const JUSTIFY_OPTIONS = [
  { value: "flex-start", label: "Início" },
  { value: "center", label: "Centro" },
  { value: "flex-end", label: "Fim" },
  { value: "space-between", label: "Space between" },
  { value: "space-around", label: "Space around" },
  { value: "space-evenly", label: "Space evenly" },
];

const ALIGN_ITEMS_OPTIONS = [
  { value: "stretch", label: "Esticar" },
  { value: "flex-start", label: "Início" },
  { value: "center", label: "Centro" },
  { value: "flex-end", label: "Fim" },
  { value: "baseline", label: "Baseline" },
];

function normalizeFontFamily(raw: string): string {
  const first = raw.split(",")[0].replace(/["']/g, "").trim();
  return first;
}

function normalizeLineHeight(raw: string, fontSize: string): string {
  if (!raw || raw === "normal") return "normal";
  // Convert "24px" to ratio when fontSize is known
  const lhPx = parseFloat(raw);
  const fsPx = parseFloat(fontSize);
  if (!isNaN(lhPx) && !isNaN(fsPx) && fsPx > 0 && raw.endsWith("px")) {
    return (lhPx / fsPx).toFixed(2).replace(/\.?0+$/, "");
  }
  return raw;
}

// Tags whose internal interactivity (play, click, scroll) gets blocked by the editor's
// click-capture in edit mode. The inspector surfaces a hint + exit-edit button for these.
const INTERACTIVE_TAGS = new Set([
  "vturb-smartplayer",
  "iframe",
  "video",
  "audio",
]);

export function VisualEditor({ elementProps, viewport = "desktop", onStyleChange, onTextChange, onAttrChange, onFontLoad, onDuplicate, onDelete, onMove, onSaveComponent, onBack }: VisualEditorProps) {
  const badge = VIEWPORT_BADGE[viewport] || VIEWPORT_BADGE.desktop;
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400 text-[10px] font-mono truncate">{elementProps.tag}</span>
            <span
              title={
                viewport === "desktop"
                  ? "Edicoes em desktop sao a base — propagam para todos os breakpoints"
                  : `Edicoes aqui SO valem em ${badge.label.toLowerCase()}`
              }
              className={cn("px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wider whitespace-nowrap", badge.bg, badge.text)}
            >
              {badge.label}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <button onClick={() => onMove("up")} title="Mover para cima (⌘↑)"
              className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onMove("down")} title="Mover para baixo (⌘↓)"
              className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDuplicate} title="Duplicar (⌘D)"
              className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button onClick={onSaveComponent} title="Salvar como componente"
              className="p-1 rounded-md text-purple-400/70 hover:text-purple-400 hover:bg-purple-500/10 cursor-pointer transition-colors">
              <Package className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} title="Excluir (Delete)"
              className="p-1 rounded-md text-red-400/70 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive-element hint: clicks in edit mode are captured by the editor for selection,
          so play/pause/iframe controls don't fire. Surface a one-click way to exit edit mode. */}
      {INTERACTIVE_TAGS.has(elementProps.tagName) && (
        <div className="mx-4 mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-start gap-2">
          <PlayCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-amber-300 font-medium leading-snug">
              Modo edição ativo
            </p>
            <p className="text-[10px] text-amber-200/70 leading-snug mt-0.5">
              Clicks no preview selecionam elementos. Para dar play / interagir com o vídeo, saia do modo edição.
            </p>
            <button
              onClick={onBack}
              className="mt-1.5 px-2 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-semibold cursor-pointer"
            >
              Sair do modo edição
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-3 space-y-5">
        {/* Text */}
        {elementProps.text !== null && (
          <section>
            <Label className="flex items-center gap-1.5 mb-2">
              <Type className="w-3 h-3" /> Texto
            </Label>
            <textarea
              key={"t-" + elementProps.text}
              defaultValue={elementProps.text}
              onBlur={(e) => onTextChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.target as HTMLTextAreaElement).blur(); }}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30 resize-none h-20"
            />
          </section>
        )}

        {/* Link — aparece quando elemento é <a> */}
        {elementProps.tagName === "a" && (
          <LinkSection elementProps={elementProps} onAttrChange={onAttrChange} />
        )}

        {/* Typography */}
        <section>
          <Label className="flex items-center gap-1.5 mb-2">
            <Type className="w-3 h-3" /> Tipografia
          </Label>
          <div className="space-y-2">
            {/* Font family */}
            <div>
              <span className="text-[9px] text-white/20 mb-1 block">Fonte</span>
              <select
                key={elementProps.fontFamily}
                defaultValue={normalizeFontFamily(elementProps.fontFamily)}
                onChange={(e) => {
                  const family = e.target.value;
                  onFontLoad(family);
                  const font = findFont(family);
                  onStyleChange("fontFamily", cssFontStack(family, font?.category));
                }}
                className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none cursor-pointer"
              >
                {CATEGORIES.map((cat) => (
                  <optgroup key={cat.id} label={cat.label}>
                    {GOOGLE_FONTS.filter((f) => f.category === cat.id).map((f) => (
                      <option key={f.family} value={f.family} className="bg-[#1a1a1a]">{f.family}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Weight + Size */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-white/20 mb-1 block">Peso</span>
                <select
                  key={"w-" + elementProps.fontWeight}
                  defaultValue={elementProps.fontWeight}
                  onChange={(e) => onStyleChange("fontWeight", e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none cursor-pointer"
                >
                  {FONT_WEIGHTS.map((w) => (
                    <option key={w.value} value={w.value} className="bg-[#1a1a1a]">{w.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-[9px] text-white/20 mb-1 block">Tamanho</span>
                <select
                  key={"s-" + elementProps.fontSize}
                  defaultValue={elementProps.fontSize}
                  onChange={(e) => onStyleChange("fontSize", e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none cursor-pointer"
                >
                  {FONT_SIZES.map((s) => (
                    <option key={s} value={s} className="bg-[#1a1a1a]">{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Line-height + Letter-spacing */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-white/20 mb-1 block">Altura linha</span>
                <input
                  key={"lh-" + elementProps.lineHeight}
                  type="text"
                  defaultValue={normalizeLineHeight(elementProps.lineHeight, elementProps.fontSize)}
                  onBlur={(e) => onStyleChange("lineHeight", e.target.value || "normal")}
                  onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                  placeholder="1.5 / 24px / auto"
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-purple-500/30"
                />
              </div>
              <div>
                <span className="text-[9px] text-white/20 mb-1 block">Espaçamento</span>
                <NumberInput
                  key={"ls-" + elementProps.letterSpacing}
                  value={elementProps.letterSpacing === "normal" ? "0px" : elementProps.letterSpacing}
                  onChange={(v) => onStyleChange("letterSpacing", v || "normal")}
                  step={0.5}
                  defaultUnit="px"
                />
              </div>
            </div>

            {/* Alignment */}
            <div>
              <span className="text-[9px] text-white/20 mb-1 block">Alinhamento</span>
              <div className="flex gap-0.5">
                {ALIGN_OPTIONS.map((a) => (
                  <button key={a.value} onClick={() => onStyleChange("textAlign", a.value)}
                    title={a.label}
                    className={cn("flex-1 py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-center",
                      elementProps.textAlign === a.value ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/30 hover:text-white/50")}>
                    {a.icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Transform + Decoration */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[9px] text-white/20 mb-1 block">Caixa</span>
                <div className="flex gap-0.5">
                  {TRANSFORM_OPTIONS.map((t) => (
                    <button key={t.value} onClick={() => onStyleChange("textTransform", t.value)}
                      title={t.label}
                      className={cn("flex-1 py-1.5 rounded-lg cursor-pointer transition-all text-[10px] font-semibold",
                        elementProps.textTransform === t.value ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/30 hover:text-white/50")}>
                      {t.display}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[9px] text-white/20 mb-1 block">Estilo</span>
                <div className="flex gap-0.5">
                  <button onClick={() => onStyleChange("fontStyle", elementProps.fontStyle === "italic" ? "normal" : "italic")}
                    title="Itálico"
                    className={cn("flex-1 py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-center",
                      elementProps.fontStyle === "italic" ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/30 hover:text-white/50")}>
                    <Italic className="w-3 h-3" />
                  </button>
                  <button onClick={() => onStyleChange("textDecoration", elementProps.textDecoration.includes("underline") ? "none" : "underline")}
                    title="Sublinhado"
                    className={cn("flex-1 py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-center",
                      elementProps.textDecoration.includes("underline") ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/30 hover:text-white/50")}>
                    <Underline className="w-3 h-3" />
                  </button>
                  <button onClick={() => onStyleChange("textDecoration", elementProps.textDecoration.includes("line-through") ? "none" : "line-through")}
                    title="Riscado"
                    className={cn("flex-1 py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-center",
                      elementProps.textDecoration.includes("line-through") ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/30 hover:text-white/50")}>
                    <Strikethrough className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Layout */}
        <section>
          <Label className="flex items-center gap-1.5 mb-2">
            <LayoutGrid className="w-3 h-3" /> Layout
          </Label>
          <div className="space-y-2">
            {/* Display */}
            <div>
              <span className="text-[9px] text-white/20 mb-1 block">Display</span>
              <div className="flex gap-0.5">
                {DISPLAY_OPTIONS.map((d) => (
                  <button key={d.value} onClick={() => onStyleChange("display", d.value)}
                    title={d.label}
                    className={cn("flex-1 py-1.5 rounded-lg cursor-pointer transition-all text-[10px]",
                      elementProps.display === d.value ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/30 hover:text-white/50")}>
                    {d.display}
                  </button>
                ))}
              </div>
            </div>

            {/* Flex-only controls */}
            {elementProps.display === "flex" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[9px] text-white/20 mb-1 block">Direção</span>
                    <div className="flex gap-0.5">
                      <button onClick={() => onStyleChange("flexDirection", "row")}
                        title="Horizontal"
                        className={cn("flex-1 py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-center",
                          elementProps.flexDirection === "row" || elementProps.flexDirection === "row-reverse"
                            ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/30 hover:text-white/50")}>
                        <MoveHorizontal className="w-3 h-3" />
                      </button>
                      <button onClick={() => onStyleChange("flexDirection", "column")}
                        title="Vertical"
                        className={cn("flex-1 py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-center",
                          elementProps.flexDirection === "column" || elementProps.flexDirection === "column-reverse"
                            ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/30 hover:text-white/50")}>
                        <MoveVertical className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] text-white/20 mb-1 block">Gap</span>
                    <NumberInput
                      key={"gap-" + elementProps.gap}
                      value={elementProps.gap === "normal" ? "0px" : elementProps.gap}
                      onChange={(v) => onStyleChange("gap", v || "0")}
                      min={0}
                    />
                  </div>
                </div>

                <div>
                  <span className="text-[9px] text-white/20 mb-1 block">Distribuição (eixo principal)</span>
                  <select
                    key={"jc-" + elementProps.justifyContent}
                    defaultValue={elementProps.justifyContent}
                    onChange={(e) => onStyleChange("justifyContent", e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none cursor-pointer"
                  >
                    {JUSTIFY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#1a1a1a]">{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[9px] text-white/20 mb-1 block">Alinhamento (eixo cruzado)</span>
                  <select
                    key={"ai-" + elementProps.alignItems}
                    defaultValue={elementProps.alignItems}
                    onChange={(e) => onStyleChange("alignItems", e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none cursor-pointer"
                  >
                    {ALIGN_ITEMS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-[#1a1a1a]">{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[9px] text-white/20 mb-1 block">Quebra de linha</span>
                  <div className="flex gap-0.5">
                    {[
                      { value: "nowrap", label: "Sem quebra" },
                      { value: "wrap", label: "Quebrar" },
                    ].map((o) => (
                      <button key={o.value} onClick={() => onStyleChange("flexWrap", o.value)}
                        className={cn("flex-1 py-1.5 rounded-lg cursor-pointer transition-all text-[10px]",
                          elementProps.flexWrap === o.value ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/30 hover:text-white/50")}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Size */}
            <div>
              <span className="text-[9px] text-white/20 mb-1 block flex items-center gap-1">
                <ArrowDownNarrowWide className="w-2.5 h-2.5" /> Tamanho
              </span>
              <div className="grid grid-cols-2 gap-2">
                <SizeInput label="W" value={elementProps.width} onChange={(v) => onStyleChange("width", v)} />
                <SizeInput label="H" value={elementProps.height} onChange={(v) => onStyleChange("height", v)} />
              </div>
            </div>
          </div>
        </section>

        {/* Fill (cor + imagem) */}
        <FillSection elementProps={elementProps} onStyleChange={onStyleChange} />

        {/* Spacing */}
        <section>
          <Label className="flex items-center gap-1.5 mb-2">
            <Space className="w-3 h-3" /> Espaçamento
          </Label>

          <div className="space-y-3">
            <div>
              <span className="text-[9px] text-white/20 mb-1.5 block">Margin</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(["marginTop", "marginRight", "marginBottom", "marginLeft"] as const).map((prop, i) => (
                  <NumberInput
                    key={prop + "-" + elementProps[prop]}
                    label={["T", "R", "B", "L"][i]}
                    value={elementProps[prop]}
                    onChange={(v) => onStyleChange(prop, v)}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="text-[9px] text-white/20 mb-1.5 block">Padding</span>
              <div className="grid grid-cols-2 gap-1.5">
                {(["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const).map((prop, i) => (
                  <NumberInput
                    key={prop + "-" + elementProps[prop]}
                    label={["T", "R", "B", "L"][i]}
                    value={elementProps[prop]}
                    onChange={(v) => onStyleChange(prop, v)}
                    min={0}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="text-[9px] text-white/20 mb-1 block">Border Radius</span>
              <NumberInput
                key={"br-" + elementProps.borderRadius}
                value={elementProps.borderRadius}
                onChange={(v) => onStyleChange("borderRadius", v)}
                min={0}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function LinkSection({ elementProps, onAttrChange }: { elementProps: ElementProps; onAttrChange: (name: string, value: string | null) => void }) {
  const href = elementProps.href || "";
  const newTab = elementProps.target === "_blank";

  const applyPreset = (preset: "url" | "whatsapp" | "email" | "phone" | "anchor" | "file") => {
    if (preset === "whatsapp") onAttrChange("href", "https://wa.me/55");
    if (preset === "email") onAttrChange("href", "mailto:");
    if (preset === "phone") onAttrChange("href", "tel:+55");
    if (preset === "anchor") onAttrChange("href", "#");
    if (preset === "file") onAttrChange("href", "");
    if (preset === "url") onAttrChange("href", "https://");
  };

  const presetOf = (h: string) => {
    if (h.startsWith("mailto:")) return "email";
    if (h.startsWith("tel:")) return "phone";
    if (h.startsWith("#")) return "anchor";
    if (h.startsWith("https://wa.me") || h.includes("whatsapp")) return "whatsapp";
    return "url";
  };
  const active = presetOf(href);

  return (
    <section>
      <Label className="flex items-center gap-1.5 mb-2">
        <Link2 className="w-3 h-3" /> Link
      </Label>

      {/* Preset type switcher */}
      <div className="flex gap-0.5 mb-2">
        {[
          { id: "url", icon: <Link2 className="w-3 h-3" />, label: "URL" },
          { id: "whatsapp", icon: <Phone className="w-3 h-3" />, label: "WhatsApp" },
          { id: "email", icon: <Mail className="w-3 h-3" />, label: "Email" },
          { id: "phone", icon: <Phone className="w-3 h-3" />, label: "Telefone" },
          { id: "anchor", icon: <Anchor className="w-3 h-3" />, label: "Âncora" },
        ].map((p) => (
          <button key={p.id} onClick={() => applyPreset(p.id as "url" | "whatsapp" | "email" | "phone" | "anchor")}
            title={p.label}
            className={cn("flex-1 py-1.5 rounded-lg cursor-pointer transition-all flex items-center justify-center",
              active === p.id ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/30 hover:text-white/50")}>
            {p.icon}
          </button>
        ))}
      </div>

      {/* URL input */}
      <div className="mb-2">
        <span className="text-[9px] text-white/20 mb-1 block">URL</span>
        <input
          key={"href-" + href}
          type="text"
          defaultValue={href}
          onBlur={(e) => onAttrChange("href", e.target.value || null)}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder={placeholderFor(active)}
          className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-purple-500/30 font-mono"
        />
      </div>

      {/* New tab toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={newTab}
          onChange={(e) => onAttrChange("target", e.target.checked ? "_blank" : null)}
          className="accent-purple-500"
        />
        <span className="text-[11px] text-white/60">Abrir em nova aba</span>
      </label>
    </section>
  );
}

function placeholderFor(preset: string): string {
  switch (preset) {
    case "whatsapp": return "https://wa.me/5511999999999";
    case "email": return "mailto:contato@exemplo.com";
    case "phone": return "tel:+5511999999999";
    case "anchor": return "#secao";
    default: return "https://...";
  }
}

function FillSection({ elementProps, onStyleChange }: { elementProps: ElementProps; onStyleChange: (p: string, v: string) => void }) {
  // Only treat `url(...)` as an actual image. Gradients and `none` should still
  // show the upload button so the user can replace them with a real image.
  const bg = elementProps.backgroundImage || "";
  const hasImage = bg !== "" && bg !== "none" && bg.includes("url(");
  const initialTab = hasImage ? "image" : "color";
  const [tab, setTab] = useState<"color" | "image">(initialTab);
  const fileRef = useRef<HTMLInputElement>(null);

  const filter = parseFilter(elementProps.filter);
  const setFilterPart = (key: keyof typeof filter, value: number) => {
    const next = { ...filter, [key]: value };
    onStyleChange("filter", serializeFilter(next));
  };

  const uploadImage = () => fileRef.current?.click();

  const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) { alert("Imagem muito grande (máx 5MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      onStyleChange("backgroundImage", `url("${url}")`);
      if (!elementProps.backgroundSize || elementProps.backgroundSize === "auto") {
        onStyleChange("backgroundSize", "cover");
      }
      if (!elementProps.backgroundPosition || elementProps.backgroundPosition === "0% 0%") {
        onStyleChange("backgroundPosition", "center");
      }
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = () => {
    onStyleChange("backgroundImage", "none");
    onStyleChange("filter", "none");
    setTab("color");
  };

  return (
    <section>
      <Label className="flex items-center gap-1.5 mb-2">
        <Palette className="w-3 h-3" /> Fill
      </Label>

      {/* Tabs */}
      <div className="flex gap-0.5 mb-2 p-0.5 rounded-lg bg-white/[0.03]">
        <button onClick={() => setTab("color")}
          className={cn("flex-1 py-1 rounded-md text-[10px] cursor-pointer transition-all",
            tab === "color" ? "bg-white/[0.08] text-white" : "text-white/40")}>
          Cor
        </button>
        <button onClick={() => setTab("image")}
          className={cn("flex-1 py-1 rounded-md text-[10px] cursor-pointer transition-all",
            tab === "image" ? "bg-white/[0.08] text-white" : "text-white/40")}>
          Imagem
        </button>
      </div>

      {tab === "color" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/30">Texto</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 font-mono uppercase">{compactColor(elementProps.color)}</span>
              <ColorPicker value={elementProps.color} onChange={(v) => onStyleChange("color", v)} allowAlpha={false} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/30">Fundo</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 font-mono uppercase">{compactColor(elementProps.backgroundColor)}</span>
              <ColorPicker value={elementProps.backgroundColor} onChange={(v) => onStyleChange("backgroundColor", v)} />
            </div>
          </div>
        </div>
      )}

      {tab === "image" && (
        <div className="space-y-2">
          <input ref={fileRef} type="file" accept="image/*" onChange={onImageFile} className="hidden" />
          {hasImage ? (
            <div className="relative rounded-xl overflow-hidden border border-white/[0.08]">
              <div className="w-full h-24 bg-center bg-cover"
                style={{ backgroundImage: elementProps.backgroundImage }} />
              <div className="absolute inset-x-0 bottom-0 flex gap-0.5 bg-black/70 p-1 backdrop-blur">
                <button onClick={uploadImage}
                  className="flex-1 py-1 rounded-md text-[10px] bg-white/[0.06] text-white/70 hover:bg-white/[0.1] cursor-pointer">
                  Trocar
                </button>
                <button onClick={removeImage}
                  className="flex-1 py-1 rounded-md text-[10px] bg-red-500/15 text-red-400 hover:bg-red-500/25 cursor-pointer">
                  Remover
                </button>
              </div>
            </div>
          ) : (
            <button onClick={uploadImage}
              className="w-full py-4 rounded-xl bg-white/[0.03] border border-dashed border-white/[0.1] text-[11px] text-white/40 hover:bg-white/[0.06] hover:text-white/60 cursor-pointer transition-all">
              Upload de imagem
            </button>
          )}

          {hasImage && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[9px] text-white/20 mb-1 block">Encaixe</span>
                  <select
                    key={"bs-" + elementProps.backgroundSize}
                    defaultValue={bgSizeKey(elementProps.backgroundSize)}
                    onChange={(e) => onStyleChange("backgroundSize", e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none cursor-pointer"
                  >
                    <option value="cover" className="bg-[#1a1a1a]">Preencher (cover)</option>
                    <option value="contain" className="bg-[#1a1a1a]">Conter (contain)</option>
                    <option value="auto" className="bg-[#1a1a1a]">Original</option>
                    <option value="100% 100%" className="bg-[#1a1a1a]">Esticar</option>
                  </select>
                </div>
                <div>
                  <span className="text-[9px] text-white/20 mb-1 block">Posição</span>
                  <select
                    key={"bp-" + elementProps.backgroundPosition}
                    defaultValue={bgPositionKey(elementProps.backgroundPosition)}
                    onChange={(e) => onStyleChange("backgroundPosition", e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none cursor-pointer"
                  >
                    <option value="center" className="bg-[#1a1a1a]">Centro</option>
                    <option value="top" className="bg-[#1a1a1a]">Topo</option>
                    <option value="bottom" className="bg-[#1a1a1a]">Base</option>
                    <option value="left" className="bg-[#1a1a1a]">Esquerda</option>
                    <option value="right" className="bg-[#1a1a1a]">Direita</option>
                    <option value="top left" className="bg-[#1a1a1a]">Topo esq.</option>
                    <option value="top right" className="bg-[#1a1a1a]">Topo dir.</option>
                    <option value="bottom left" className="bg-[#1a1a1a]">Base esq.</option>
                    <option value="bottom right" className="bg-[#1a1a1a]">Base dir.</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <FilterSlider label="Brilho" value={filter.brightness} min={0} max={200} unit="%" onChange={(v) => setFilterPart("brightness", v)} />
                <FilterSlider label="Contraste" value={filter.contrast} min={0} max={200} unit="%" onChange={(v) => setFilterPart("contrast", v)} />
                <FilterSlider label="Saturação" value={filter.saturate} min={0} max={200} unit="%" onChange={(v) => setFilterPart("saturate", v)} />
                <FilterSlider label="Desfoque" value={filter.blur} min={0} max={40} unit="px" onChange={(v) => setFilterPart("blur", v)} />
                <FilterSlider label="Matiz" value={filter.hueRotate} min={0} max={360} unit="°" onChange={(v) => setFilterPart("hueRotate", v)} />
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function FilterSlider({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-white/40 w-14">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-purple-500 cursor-pointer"
      />
      <span className="text-[10px] text-white/40 font-mono w-10 text-right">{value}{unit}</span>
    </div>
  );
}

interface FilterParts {
  brightness: number;  // %
  contrast: number;    // %
  saturate: number;    // %
  blur: number;        // px
  hueRotate: number;   // deg
}

function parseFilter(css: string): FilterParts {
  const defaults: FilterParts = { brightness: 100, contrast: 100, saturate: 100, blur: 0, hueRotate: 0 };
  if (!css || css === "none") return defaults;
  const read = (fn: string, unit: string): number | null => {
    const re = new RegExp(fn + "\\(\\s*([0-9.]+)" + unit + "?\\s*\\)");
    const m = css.match(re);
    return m ? parseFloat(m[1]) : null;
  };
  return {
    brightness: read("brightness", "%") ?? 100,
    contrast: read("contrast", "%") ?? 100,
    saturate: read("saturate", "%") ?? 100,
    blur: read("blur", "px") ?? 0,
    hueRotate: read("hue-rotate", "deg") ?? 0,
  };
}

function serializeFilter(f: FilterParts): string {
  const parts: string[] = [];
  if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
  if (f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
  if (f.saturate !== 100) parts.push(`saturate(${f.saturate}%)`);
  if (f.blur !== 0) parts.push(`blur(${f.blur}px)`);
  if (f.hueRotate !== 0) parts.push(`hue-rotate(${f.hueRotate}deg)`);
  return parts.length ? parts.join(" ") : "none";
}

function bgSizeKey(raw: string): string {
  if (!raw) return "auto";
  if (raw.includes("cover")) return "cover";
  if (raw.includes("contain")) return "contain";
  if (raw === "100% 100%") return "100% 100%";
  return "auto";
}

function bgPositionKey(raw: string): string {
  if (!raw) return "center";
  const v = raw.toLowerCase();
  if (v.includes("50%") && v.split(" ").every((p) => p === "50%")) return "center";
  if (v === "center center" || v === "center") return "center";
  // Fallback to first matching keyword
  const keys = ["top left", "top right", "bottom left", "bottom right", "top", "bottom", "left", "right"];
  return keys.find((k) => v === k) ?? "center";
}

function SizeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const modes = [
    { id: "hug", label: "Hug", css: "auto" },
    { id: "fill", label: "Fill", css: "100%" },
  ];
  const activeMode = value === "auto" || value === "fit-content" ? "hug" : value === "100%" ? "fill" : "fixed";

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-white/30 w-3 text-center">{label}</span>
      <input
        key={label + "-" + value}
        type="text"
        defaultValue={value === "auto" ? "" : value}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (!v) { onChange("auto"); return; }
          onChange(/^\d+$/.test(v) ? v + "px" : v);
        }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        placeholder={activeMode === "hug" ? "Hug" : "400"}
        className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-purple-500/30"
      />
      <div className="flex gap-0.5">
        {modes.map((m) => (
          <button key={m.id} onClick={() => onChange(m.css)}
            title={m.label}
            className={cn("px-1.5 py-1 rounded-md cursor-pointer transition-all text-[9px] font-semibold",
              activeMode === m.id ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.03] text-white/30 hover:text-white/50")}>
            {m.label[0]}
          </button>
        ))}
      </div>
    </div>
  );
}

function compactColor(raw: string): string {
  if (!raw) return "—";
  const m = raw.match(/\d+/g);
  if (!m || m.length < 3) return raw.toUpperCase().replace(/^#/, "");
  const [r, g, b] = m.map(Number);
  return [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return "#000000";
  const [r, g, b] = match.map(Number);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
