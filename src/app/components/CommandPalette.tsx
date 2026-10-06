"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  Home,
  Rocket,
  PenTool,
  Paintbrush,
  GalleryHorizontalEnd,
  Camera,
  Mail,
  Megaphone,
  ArrowRight,
  CornerDownLeft,
  X,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNavigate: (view: any) => void;
}

interface CommandItem {
  id: string;
  type: "navigate" | "template" | "action";
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onNavigate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build command items
  const navigationItems: CommandItem[] = useMemo(() => [
    { id: "nav-home", type: "navigate", label: "Home", icon: <Home className="w-4 h-4" />, action: () => { onNavigate("home"); onClose(); } },
    { id: "nav-launches", type: "navigate", label: "Lançamentos", icon: <Rocket className="w-4 h-4" />, action: () => { onNavigate("lancamentos"); onClose(); } },
    { id: "nav-copy", type: "navigate", label: "Copy", icon: <PenTool className="w-4 h-4" />, action: () => { onNavigate("copy"); onClose(); } },
    { id: "nav-criativos", type: "navigate", label: "Criativos", icon: <Paintbrush className="w-4 h-4" />, action: () => { onNavigate("criativos"); onClose(); } },
    { id: "nav-carrossel", type: "navigate", label: "Carrossel", icon: <GalleryHorizontalEnd className="w-4 h-4" />, action: () => { onNavigate("carrossel"); onClose(); } },
    { id: "nav-ensaio", type: "navigate", label: "Ensaio Fotográfico", icon: <Camera className="w-4 h-4" />, action: () => { onNavigate("ensaio"); onClose(); } },
    { id: "nav-emails", type: "navigate", label: "Emails", icon: <Mail className="w-4 h-4" />, action: () => { onNavigate("emails"); onClose(); } },
    { id: "nav-anuncios", type: "navigate", label: "Anúncios", icon: <Megaphone className="w-4 h-4" />, action: () => { onNavigate("anuncios"); onClose(); } },
  ], [onNavigate, onClose]);

  const templateItems = useMemo<CommandItem[]>(() => [], []);

  // Filter items based on query
  const filtered = useMemo(() => {
    if (!query.trim()) {
      return { navigation: navigationItems, templates: [] };
    }
    const q = query.toLowerCase();
    return {
      navigation: navigationItems.filter((i) =>
        i.label.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)
      ),
      templates: templateItems.filter((i) =>
        i.label.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)
      ),
    };
  }, [query, navigationItems, templateItems]);

  // Flat list for keyboard navigation
  const allItems = useMemo(() => [
    ...filtered.navigation,
    ...filtered.templates,
  ], [filtered]);

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= allItems.length) setSelectedIndex(Math.max(0, allItems.length - 1));
  }, [allItems.length, selectedIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        allItems[selectedIndex]?.action();
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  }, [allItems, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  let runningIndex = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Palette */}
      <div className="fixed inset-0 z-[301] flex items-start justify-center pt-[12vh] px-4 pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto flex rounded-2xl bg-[#18181c]/95 backdrop-blur-2xl border border-white/[0.08] shadow-2xl shadow-black/60 overflow-hidden animate-slide-up",
            "w-full max-w-[520px]"
          )}
          style={{ maxHeight: "min(520px, 70vh)" }}
        >
          {/* Left: Search + List */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
              <Search className="w-4 h-4 text-white/30 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="flex-1 bg-transparent text-[14px] text-white placeholder:text-white/30 focus:outline-none"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); setSelectedIndex(0); }}
                  className="p-1 rounded-md text-white/25 hover:text-white/50 hover:bg-white/[0.05] transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Results list */}
            <div ref={listRef} className="flex-1 overflow-y-auto py-2 px-2">
              {allItems.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <p className="text-[13px] text-white/25">Nenhum resultado para &quot;{query}&quot;</p>
                </div>
              )}

              {/* Navigate to */}
              {filtered.navigation.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1.5 text-[10px] font-medium text-white/25 uppercase tracking-widest">
                    Navegar para
                  </p>
                  {filtered.navigation.map((item) => {
                    const idx = runningIndex++;
                    return (
                      <CommandRow
                        key={item.id}
                        item={item}
                        selected={idx === selectedIndex}
                        dataIndex={idx}
                        onSelect={() => item.action()}
                        onHover={() => {
                          setSelectedIndex(idx);
                        }}
                      />
                    );
                  })}
                </div>
              )}

              {/* Templates (only when searching) */}
              {filtered.templates.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1.5 text-[10px] font-medium text-white/25 uppercase tracking-widest">
                    Templates
                  </p>
                  {filtered.templates.map((item) => {
                    const idx = runningIndex++;
                    return (
                      <CommandRow
                        key={item.id}
                        item={item}
                        selected={idx === selectedIndex}
                        dataIndex={idx}
                        onSelect={() => item.action()}
                        onHover={() => {
                          setSelectedIndex(idx);
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center gap-4 px-4 py-2 border-t border-white/[0.06]">
              <span className="flex items-center gap-1.5 text-[10px] text-white/20">
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30 text-[9px] font-mono">
                  <ArrowRight className="w-2.5 h-2.5 inline -rotate-90" />
                </kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30 text-[9px] font-mono">
                  <ArrowRight className="w-2.5 h-2.5 inline rotate-90" />
                </kbd>
                navegar
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-white/20">
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30 text-[9px] font-mono">
                  <CornerDownLeft className="w-2.5 h-2.5 inline" />
                </kbd>
                abrir
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-white/20">
                <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/30 text-[9px] font-mono">esc</kbd>
                fechar
              </span>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

function CommandRow({
  item,
  selected,
  dataIndex,
  onSelect,
  onHover,
}: {
  item: CommandItem;
  selected: boolean;
  dataIndex: number;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      data-index={dataIndex}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors cursor-pointer",
        selected ? "bg-purple-500/15 text-white" : "text-white/60 hover:bg-white/[0.04]"
      )}
    >
      <span className={cn("shrink-0", selected ? "text-purple-400" : "text-white/25")}>
        {item.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium truncate">{item.label}</p>
        {item.description && (
          <p className="text-[10px] text-white/25 truncate">{item.description}</p>
        )}
      </div>
      {item.type === "navigate" && (
        <ArrowRight className="w-3 h-3 text-white/15 shrink-0" />
      )}
    </button>
  );
}
