"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  Home,
  BookOpen,
  FolderOpen,
  Plus,
  Star,
  FileText,
  ArrowRight,
  CornerDownLeft,
  X,
} from "lucide-react";
import { Project, timeAgo } from "../lib/projects";
import { TEMPLATES } from "../lib/templates";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  projects: Project[];
  onNavigate: (view: any) => void;
  onOpenProject: (project: Project) => void;
  onCreateProject: () => void;
  onSelectTemplate: (prompt: string) => void;
}

interface CommandItem {
  id: string;
  type: "project" | "navigate" | "template" | "action";
  label: string;
  description?: string;
  icon: React.ReactNode;
  project?: Project;
  action: () => void;
}

export function CommandPalette({
  open,
  onClose,
  projects,
  onNavigate,
  onOpenProject,
  onCreateProject,
  onSelectTemplate,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hoveredProject, setHoveredProject] = useState<Project | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setHoveredProject(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build command items
  const navigationItems: CommandItem[] = useMemo(() => [
    { id: "nav-home", type: "navigate", label: "Home", icon: <Home className="w-4 h-4" />, action: () => { onNavigate("home"); onClose(); } },
    { id: "nav-resources", type: "navigate", label: "Resources", description: "Templates prontos", icon: <BookOpen className="w-4 h-4" />, action: () => { onNavigate("resources"); onClose(); } },
    { id: "nav-projects", type: "navigate", label: "Todos os projetos", icon: <FolderOpen className="w-4 h-4" />, action: () => { onNavigate("projects-all"); onClose(); } },
    { id: "nav-starred", type: "navigate", label: "Favoritos", icon: <Star className="w-4 h-4" />, action: () => { onNavigate("projects-starred"); onClose(); } },
    { id: "action-new", type: "action", label: "Criar novo projeto", icon: <Plus className="w-4 h-4" />, action: () => { onCreateProject(); onClose(); } },
  ], [onNavigate, onClose, onCreateProject]);

  const projectItems: CommandItem[] = useMemo(() =>
    projects.slice(0, 8).map((p) => ({
      id: `proj-${p.id}`,
      type: "project" as const,
      label: p.name,
      description: `${p.client} · ${p.pages.length} pagina${p.pages.length !== 1 ? "s" : ""} · ${timeAgo(p.updatedAt)}`,
      icon: <FileText className="w-4 h-4" />,
      project: p,
      action: () => { onOpenProject(p); onClose(); },
    })),
  [projects, onOpenProject, onClose]);

  const templateItems: CommandItem[] = useMemo(() =>
    TEMPLATES.slice(0, 12).map((t) => ({
      id: `tpl-${t.id}`,
      type: "template" as const,
      label: t.label,
      description: t.description.slice(0, 80),
      icon: <FileText className="w-4 h-4" />,
      action: () => { onSelectTemplate(t.prompt); onClose(); },
    })),
  [onSelectTemplate, onClose]);

  // Filter items based on query
  const filtered = useMemo(() => {
    if (!query.trim()) {
      return { projects: projectItems, navigation: navigationItems, templates: [] };
    }
    const q = query.toLowerCase();
    return {
      projects: projectItems.filter((i) =>
        i.label.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)
      ),
      navigation: navigationItems.filter((i) =>
        i.label.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)
      ),
      templates: templateItems.filter((i) =>
        i.label.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)
      ),
    };
  }, [query, projectItems, navigationItems, templateItems]);

  // Flat list for keyboard navigation
  const allItems = useMemo(() => [
    ...filtered.projects,
    ...filtered.navigation,
    ...filtered.templates,
  ], [filtered]);

  // Clamp selected index
  useEffect(() => {
    if (selectedIndex >= allItems.length) setSelectedIndex(Math.max(0, allItems.length - 1));
  }, [allItems.length, selectedIndex]);

  // Update hovered project based on selection
  useEffect(() => {
    const item = allItems[selectedIndex];
    if (item?.project) {
      setHoveredProject(item.project);
    }
  }, [selectedIndex, allItems]);

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

  const showPreview = hoveredProject && hoveredProject.pages.length > 0;
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
            showPreview ? "w-full max-w-[860px]" : "w-full max-w-[520px]"
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

              {/* Recent projects */}
              {filtered.projects.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1.5 text-[10px] font-medium text-white/25 uppercase tracking-widest">
                    {query ? "Projetos" : "Projetos recentes"}
                  </p>
                  {filtered.projects.map((item) => {
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
                          if (item.project) setHoveredProject(item.project);
                        }}
                      />
                    );
                  })}
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
                          setHoveredProject(null);
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
                          setHoveredProject(null);
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

          {/* Right: Project preview */}
          {showPreview && hoveredProject && (
            <div className="w-[320px] shrink-0 border-l border-white/[0.06] bg-[#111114] flex flex-col overflow-hidden">
              {/* Preview iframe */}
              <div className="flex-1 relative overflow-hidden bg-white rounded-lg m-3 mb-2">
                <iframe
                  srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;transform-origin:top left;transform:scale(0.28);width:357%;}</style></head><body>${hoveredProject.pages[0]?.code || ""}</body></html>`}
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin"
                  title="Preview"
                  style={{ pointerEvents: "none" }}
                />
              </div>

              {/* Project info */}
              <div className="px-4 pb-3 space-y-2">
                <h3 className="text-[13px] font-semibold text-white/80 truncate">{hoveredProject.name}</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  <div>
                    <p className="text-[9px] text-white/25 uppercase tracking-wider">Cliente</p>
                    <p className="text-[11px] text-white/50">{hoveredProject.client}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/25 uppercase tracking-wider">Status</p>
                    <p className="text-[11px] text-white/50">{hoveredProject.createdBy === "me" ? "Privado" : "Compartilhado"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/25 uppercase tracking-wider">Criado</p>
                    <p className="text-[11px] text-white/50">{new Date(hoveredProject.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/25 uppercase tracking-wider">Editado</p>
                    <p className="text-[11px] text-white/50">{timeAgo(hoveredProject.updatedAt)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] text-white/25 uppercase tracking-wider">Paginas</p>
                    <p className="text-[11px] text-white/50">{hoveredProject.pages.length} pagina{hoveredProject.pages.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>

                <button
                  onClick={() => { onOpenProject(hoveredProject); onClose(); }}
                  className="flex items-center justify-end gap-1.5 w-full pt-1 text-[11px] text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                >
                  Abrir projeto
                  <CornerDownLeft className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
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
