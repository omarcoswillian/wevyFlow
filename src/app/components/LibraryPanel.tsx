"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Package, Image as ImageIcon, Trash2, Search } from "lucide-react";
import { SavedComponent } from "@/app/lib/editor/useComponents";

interface LibraryPanelProps {
  components: SavedComponent[];
  pageHtml: string;
  onInsert: (html: string) => void;
  onDragHtml: (html: string | null) => void;
  onRemoveComponent: (id: string) => void;
  onRenameComponent: (id: string, name: string) => void;
}

export function LibraryPanel({ components, pageHtml, onInsert, onDragHtml, onRemoveComponent, onRenameComponent }: LibraryPanelProps) {
  const [tab, setTab] = useState<"components" | "images">("components");
  const [search, setSearch] = useState("");

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Sub-tabs */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/[0.03]">
          <button onClick={() => setTab("components")}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer",
              tab === "components" ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/60")}>
            <Package className="w-3 h-3" /> Componentes
          </button>
          <button onClick={() => setTab("images")}
            className={cn("flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer",
              tab === "images" ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/60")}>
            <ImageIcon className="w-3 h-3" /> Imagens
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pt-2 pb-1">
        <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2 py-1.5">
          <Search className="w-3 h-3 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "components" ? "Buscar componente..." : "Buscar imagem..."}
            className="flex-1 bg-transparent text-[11px] text-white placeholder:text-white/25 focus:outline-none"
          />
        </div>
      </div>

      {tab === "components" ? (
        <ComponentsTab
          components={components}
          search={search}
          onInsert={onInsert}
          onDragHtml={onDragHtml}
          onRemove={onRemoveComponent}
          onRename={onRenameComponent}
        />
      ) : (
        <ImagesTab pageHtml={pageHtml} search={search} onInsert={onInsert} onDragHtml={onDragHtml} />
      )}
    </div>
  );
}

function ComponentsTab({ components, search, onInsert, onDragHtml, onRemove, onRename }: {
  components: SavedComponent[];
  search: string;
  onInsert: (html: string) => void;
  onDragHtml: (html: string | null) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return components;
    return components.filter((c) => c.name.toLowerCase().includes(q) || c.tag.includes(q));
  }, [components, search]);

  if (components.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-3">
          <Package className="w-5 h-5 text-white/40" />
        </div>
        <p className="text-[13px] font-medium text-white/60 mb-1">Nenhum componente ainda</p>
        <p className="text-[11px] text-white/30 leading-relaxed">
          Selecione um elemento no preview e clique em <span className="text-purple-400">“Salvar como componente”</span> no inspector.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-1.5">
      {filtered.map((c) => (
        <ComponentCard key={c.id} component={c} onInsert={onInsert} onDragHtml={onDragHtml} onRemove={onRemove} onRename={onRename} />
      ))}
      {filtered.length === 0 && (
        <p className="text-[11px] text-white/30 text-center py-4">Nada encontrado.</p>
      )}
    </div>
  );
}

function ComponentCard({ component, onInsert, onDragHtml, onRemove, onRename }: {
  component: SavedComponent;
  onInsert: (html: string) => void;
  onDragHtml: (html: string | null) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(component.name);

  const commit = () => {
    const v = name.trim();
    if (v && v !== component.name) onRename(component.id, v);
    setEditing(false);
  };

  return (
    <div
      draggable
      onDragStart={(e) => {
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "copy";
          e.dataTransfer.setData("text/html", component.html);
        }
        onDragHtml(component.html);
      }}
      onDragEnd={() => onDragHtml(null)}
      onClick={() => onInsert(component.html)}
      className="group flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-purple-500/30 transition-all cursor-grab active:cursor-grabbing"
    >
      <Package className="w-3.5 h-3.5 text-purple-400 shrink-0" />
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setName(component.name); setEditing(false); }
          }}
          className="flex-1 min-w-0 bg-white/[0.06] border border-purple-500/30 rounded px-1 text-[11px] text-white focus:outline-none"
        />
      ) : (
        <span
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="flex-1 truncate text-[11px] text-white/80"
        >
          {component.name}
        </span>
      )}
      <span className="text-[9px] text-white/25 font-mono shrink-0">{component.tag}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm(`Excluir componente "${component.name}"?`)) onRemove(component.id);
        }}
        title="Excluir componente"
        className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400/60 hover:text-red-400 transition-opacity"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

function ImagesTab({ pageHtml, search, onInsert, onDragHtml }: {
  pageHtml: string;
  search: string;
  onInsert: (html: string) => void;
  onDragHtml: (html: string | null) => void;
}) {
  const images = useMemo(() => extractImages(pageHtml), [pageHtml]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return images;
    return images.filter((img) => (img.alt || "").toLowerCase().includes(q) || img.src.toLowerCase().includes(q));
  }, [images, search]);

  if (images.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-3">
          <ImageIcon className="w-5 h-5 text-white/40" />
        </div>
        <p className="text-[13px] font-medium text-white/60 mb-1">Sem imagens ainda</p>
        <p className="text-[11px] text-white/30 leading-relaxed">
          Imagens inseridas via upload ou URL aparecerão aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <div className="grid grid-cols-3 gap-1.5">
        {filtered.map((img) => (
          <div
            key={img.src}
            draggable
            onDragStart={(e) => {
              const html = `<img src="${escapeAttr(img.src)}" alt="${escapeAttr(img.alt || "")}" class="reveal" style="max-width:100%;height:auto;border-radius:12px">`;
              if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.setData("text/html", html);
              }
              onDragHtml(html);
            }}
            onDragEnd={() => onDragHtml(null)}
            onClick={() => onInsert(`<img src="${escapeAttr(img.src)}" alt="${escapeAttr(img.alt || "")}" class="reveal" style="max-width:100%;height:auto;border-radius:12px">`)}
            title={img.alt || img.src}
            className="relative aspect-square rounded-lg overflow-hidden bg-white/[0.03] border border-white/[0.06] hover:border-purple-500/40 cursor-grab active:cursor-grabbing transition-all"
          >
            <img src={img.src} alt={img.alt || ""} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="text-[11px] text-white/30 text-center py-4">Nada encontrado.</p>
      )}
    </div>
  );
}

interface PageImage { src: string; alt?: string }

function extractImages(html: string): PageImage[] {
  if (!html) return [];
  const seen = new Set<string>();
  const out: PageImage[] = [];

  // <img src="..." alt="...">
  const imgRe = /<img[^>]*\ssrc=["']([^"']+)["'][^>]*?(?:\salt=["']([^"']*)["'])?[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    const src = m[1];
    if (!seen.has(src)) { seen.add(src); out.push({ src, alt: m[2] }); }
  }

  // background-image: url(...)
  const bgRe = /background(?:-image)?\s*:\s*[^;"']*url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  while ((m = bgRe.exec(html)) !== null) {
    const src = m[1];
    if (src.startsWith("data:image/svg+xml")) continue; // skip placeholder SVGs
    if (!seen.has(src)) { seen.add(src); out.push({ src }); }
  }

  return out;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
