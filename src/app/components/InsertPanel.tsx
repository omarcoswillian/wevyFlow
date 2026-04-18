"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Type, Image as ImageIcon, MousePointer2, Square, Video, Code2, Heading1, Heading2, Heading3, Pilcrow, List, PlayCircle, Film,
} from "lucide-react";

interface InsertPanelProps {
  onInsert: (html: string) => void;
  onDragHtml: (html: string | null) => void;
}

type SubFormId = null | "image-url" | "youtube" | "vturb" | "html";

export function InsertPanel({ onInsert, onDragHtml }: InsertPanelProps) {
  const [subForm, setSubForm] = useState<SubFormId>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const textHtml = {
    h1: `<h1 class="reveal">Novo título</h1>`,
    h2: `<h2 class="reveal">Subtítulo</h2>`,
    h3: `<h3 class="reveal">Seção</h3>`,
    p: `<p class="reveal">Seu texto aqui...</p>`,
    list: `<ul class="reveal" style="padding-left:20px"><li>Primeiro item</li><li>Outro item</li></ul>`,
  };

  const interactionHtml = {
    cta: `<a href="#" class="btn-cta reveal">Clique aqui</a>`,
    sec: `<a href="#" class="btn-sec reveal">Saiba mais</a>`,
  };

  const structureHtml = {
    container: `<div class="reveal" style="padding:32px;min-height:120px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)"></div>`,
    section: `<section class="section reveal"><div class="container"></div></section>`,
    divider: `<hr style="border:0;height:1px;background:rgba(255,255,255,0.08);margin:32px 0">`,
    card: `<div class="card reveal"><h3>Título do card</h3><p>Descrição do card.</p></div>`,
  };

  const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5_000_000) { alert("Imagem muito grande (máx 5MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      onInsert(`<img src="${url}" alt="" class="reveal" style="max-width:100%;height:auto;border-radius:12px">`);
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
      {/* Texto */}
      <section>
        <Label className="flex items-center gap-1.5 mb-2">
          <Type className="w-3 h-3" /> Texto
        </Label>
        <div className="grid grid-cols-2 gap-1.5">
          <InsertCard icon={<Heading1 className="w-4 h-4" />} label="Título H1" html={textHtml.h1} onInsert={onInsert} onDragHtml={onDragHtml} />
          <InsertCard icon={<Heading2 className="w-4 h-4" />} label="Subtítulo H2" html={textHtml.h2} onInsert={onInsert} onDragHtml={onDragHtml} />
          <InsertCard icon={<Heading3 className="w-4 h-4" />} label="H3" html={textHtml.h3} onInsert={onInsert} onDragHtml={onDragHtml} />
          <InsertCard icon={<Pilcrow className="w-4 h-4" />} label="Parágrafo" html={textHtml.p} onInsert={onInsert} onDragHtml={onDragHtml} />
          <InsertCard icon={<List className="w-4 h-4" />} label="Lista" html={textHtml.list} onInsert={onInsert} onDragHtml={onDragHtml} />
        </div>
      </section>

      {/* Mídia */}
      <section>
        <Label className="flex items-center gap-1.5 mb-2">
          <ImageIcon className="w-3 h-3" /> Mídia
        </Label>
        <div className="grid grid-cols-2 gap-1.5">
          <input ref={fileRef} type="file" accept="image/*" onChange={onImageFile} className="hidden" />
          <InsertCard
            icon={<ImageIcon className="w-4 h-4" />}
            label="Imagem"
            html={`<div class="reveal" style="width:100%;aspect-ratio:16/9;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:12px;font-family:system-ui">Imagem — use Fill para trocar</div>`}
            onInsert={onInsert}
            onDragHtml={onDragHtml}
            onClick={() => fileRef.current?.click()}
          />
          <InsertCard icon={<ImageIcon className="w-4 h-4" />} label="Imagem (URL)" onClick={() => setSubForm("image-url")} />
          <InsertCard icon={<Film className="w-4 h-4" />} label="YouTube" onClick={() => setSubForm("youtube")} />
          <InsertCard icon={<PlayCircle className="w-4 h-4" />} label="VTurb" onClick={() => setSubForm("vturb")} />
        </div>

        {subForm === "image-url" && (
          <MiniForm
            placeholder="https://..."
            label="URL da imagem"
            onCancel={() => setSubForm(null)}
            onSubmit={(url) => {
              onInsert(`<img src="${escapeAttr(url)}" alt="" class="reveal" style="max-width:100%;height:auto;border-radius:12px">`);
              setSubForm(null);
            }}
          />
        )}

        {subForm === "youtube" && (
          <MiniForm
            placeholder="ID ou URL do YouTube"
            label="Vídeo YouTube"
            onCancel={() => setSubForm(null)}
            onSubmit={(raw) => {
              const id = extractYoutubeId(raw);
              if (!id) { alert("Não consegui identificar o ID do vídeo"); return; }
              onInsert(`<div class="reveal" data-wf-video="youtube:${id}" style="position:relative;width:100%;padding-top:56.25%;border-radius:12px;overflow:hidden"><iframe src="https://www.youtube.com/embed/${id}" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen></iframe></div>`);
              setSubForm(null);
            }}
          />
        )}

        {subForm === "vturb" && (
          <VTurbForm onCancel={() => setSubForm(null)} onSubmit={(html) => { onInsert(html); setSubForm(null); }} />
        )}
      </section>

      {/* Interação */}
      <section>
        <Label className="flex items-center gap-1.5 mb-2">
          <MousePointer2 className="w-3 h-3" /> Interação
        </Label>
        <div className="grid grid-cols-2 gap-1.5">
          <InsertCard icon={<MousePointer2 className="w-4 h-4" />} label="Botão CTA" html={interactionHtml.cta} onInsert={onInsert} onDragHtml={onDragHtml} />
          <InsertCard icon={<MousePointer2 className="w-4 h-4" />} label="Botão secundário" html={interactionHtml.sec} onInsert={onInsert} onDragHtml={onDragHtml} />
        </div>
      </section>

      {/* Estrutura */}
      <section>
        <Label className="flex items-center gap-1.5 mb-2">
          <Square className="w-3 h-3" /> Estrutura
        </Label>
        <div className="grid grid-cols-2 gap-1.5">
          <InsertCard icon={<Square className="w-4 h-4" />} label="Container" html={structureHtml.container} onInsert={onInsert} onDragHtml={onDragHtml} />
          <InsertCard icon={<Square className="w-4 h-4" />} label="Seção" html={structureHtml.section} onInsert={onInsert} onDragHtml={onDragHtml} />
          <InsertCard icon={<Square className="w-4 h-4" />} label="Divisor" html={structureHtml.divider} onInsert={onInsert} onDragHtml={onDragHtml} />
          <InsertCard icon={<Square className="w-4 h-4" />} label="Card" html={structureHtml.card} onInsert={onInsert} onDragHtml={onDragHtml} />
        </div>
      </section>

      {/* Avançado */}
      <section>
        <Label className="flex items-center gap-1.5 mb-2">
          <Code2 className="w-3 h-3" /> Avançado
        </Label>
        <div className="grid grid-cols-1 gap-1.5">
          <InsertCard icon={<Code2 className="w-4 h-4" />} label="HTML / Script customizado" onClick={() => setSubForm("html")} full />
        </div>

        {subForm === "html" && (
          <HtmlForm onCancel={() => setSubForm(null)} onSubmit={(html) => { onInsert(html); setSubForm(null); }} />
        )}
      </section>
    </div>
  );
}

interface InsertCardProps {
  icon: React.ReactNode;
  label: string;
  full?: boolean;
  // Draggable card (static HTML)
  html?: string;
  onInsert?: (html: string) => void;
  onDragHtml?: (html: string | null) => void;
  // Non-draggable card (opens sub-form)
  onClick?: () => void;
}

function InsertCard({ icon, label, full, html, onInsert, onDragHtml, onClick }: InsertCardProps) {
  const draggable = !!html;
  const handleClick = () => {
    // When both are provided, onClick wins for click (e.g., image upload)
    // and html is used for drag. Otherwise fall back sensibly.
    if (onClick) onClick();
    else if (html && onInsert) onInsert(html);
  };
  return (
    <button
      draggable={draggable}
      onClick={handleClick}
      onDragStart={draggable ? (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "copy";
          e.dataTransfer.setData("text/html", html!);
        }
        onDragHtml?.(html!);
      } : undefined}
      onDragEnd={draggable ? () => onDragHtml?.(null) : undefined}
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-purple-500/30 transition-all text-left",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        full && "col-span-2"
      )}
    >
      <span className="text-white/50">{icon}</span>
      <span className="text-[11px] font-medium text-white/70">{label}</span>
    </button>
  );
}

function MiniForm({ label, placeholder, onCancel, onSubmit }: { label: string; placeholder: string; onCancel: () => void; onSubmit: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
      <span className="text-[10px] text-white/40">{label}</span>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onSubmit(value.trim()); if (e.key === "Escape") onCancel(); }}
        placeholder={placeholder}
        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-purple-500/30"
      />
      <div className="flex gap-1.5">
        <button onClick={onCancel} className="flex-1 py-1.5 rounded-lg text-[10px] text-white/50 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer">Cancelar</button>
        <button
          onClick={() => value.trim() && onSubmit(value.trim())}
          disabled={!value.trim()}
          className={cn("flex-1 py-1.5 rounded-lg text-[10px] cursor-pointer transition-all",
            value.trim() ? "bg-purple-500 text-white hover:bg-purple-400" : "bg-white/[0.03] text-white/20")}>
          Inserir
        </button>
      </div>
    </div>
  );
}

function VTurbForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (html: string) => void }) {
  const [raw, setRaw] = useState("");

  const build = () => {
    const clean = raw.trim();
    if (!clean) return;
    // Accept: full snippet, just ID, or a URL
    if (clean.startsWith("<")) {
      onSubmit(clean);
      return;
    }
    const idMatch = clean.match(/[a-f0-9]{24,}/i);
    const id = idMatch ? idMatch[0] : clean;
    onSubmit(
      `<div class="reveal" data-wf-video="vturb:${id}" id="vid_${id}" style="position:relative;width:100%;padding-top:56.25%">` +
      `<img id="thumb_${id}" src="https://images.converteai.net/${id}/players/${id}/thumbnail.jpg" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block" alt="thumbnail">` +
      `</div>` +
      `<script type="text/javascript">var s=document.createElement("script");s.src="https://scripts.converteai.net/${id}/players/${id}/player.js";s.async=true;document.head.appendChild(s);</script>`
    );
  };

  return (
    <div className="mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
      <span className="text-[10px] text-white/40">VTurb player (cole o ID, URL ou o snippet completo)</span>
      <textarea
        autoFocus
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        placeholder="ID do player (ex: 6720bfe...) ou snippet completo"
        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-purple-500/30 h-24 resize-none font-mono"
      />
      <div className="flex gap-1.5">
        <button onClick={onCancel} className="flex-1 py-1.5 rounded-lg text-[10px] text-white/50 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer">Cancelar</button>
        <button
          onClick={build}
          disabled={!raw.trim()}
          className={cn("flex-1 py-1.5 rounded-lg text-[10px] cursor-pointer transition-all",
            raw.trim() ? "bg-purple-500 text-white hover:bg-purple-400" : "bg-white/[0.03] text-white/20")}>
          Inserir VTurb
        </button>
      </div>
    </div>
  );
}

function HtmlForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (html: string) => void }) {
  const [html, setHtml] = useState("");
  return (
    <div className="mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
      <span className="text-[10px] text-white/40">HTML customizado (aceita &lt;script&gt;, &lt;iframe&gt;, pixels, chat, etc.)</span>
      <textarea
        autoFocus
        value={html}
        onChange={(e) => setHtml(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
        placeholder='<script src="..."></script>'
        className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-purple-500/30 h-32 resize-none font-mono"
      />
      <div className="flex gap-1.5">
        <button onClick={onCancel} className="flex-1 py-1.5 rounded-lg text-[10px] text-white/50 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer">Cancelar</button>
        <button
          onClick={() => html.trim() && onSubmit(html.trim())}
          disabled={!html.trim()}
          className={cn("flex-1 py-1.5 rounded-lg text-[10px] cursor-pointer transition-all",
            html.trim() ? "bg-purple-500 text-white hover:bg-purple-400" : "bg-white/[0.03] text-white/20")}>
          Inserir HTML
        </button>
      </div>
    </div>
  );
}

function extractYoutubeId(raw: string): string | null {
  const s = raw.trim();
  // Full URL with v= or youtu.be/ or /embed/
  const patterns = [
    /(?:youtube\.com\/watch\?[^ ]*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1];
  }
  return null;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
