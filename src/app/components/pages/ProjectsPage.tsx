"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { Project, timeAgo } from "../../lib/projects";
import { Search, Plus, Star, MoreHorizontal, Trash2, FolderOpen, FileText, Share2, Camera, Loader2 } from "lucide-react";

interface ProjectsPageProps {
  projects: Project[];
  filter: "all" | "starred" | "mine" | "shared";
  onOpenProject: (project: Project) => void;
  onCreateProject: () => void;
  onToggleStar: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onUpdateCover: (projectId: string, file: File) => Promise<void>;
}

const TITLES: Record<string, string> = {
  all: "Todos os projetos",
  starred: "Favoritos",
  mine: "Criados por mim",
  shared: "Compartilhados",
};

const EMPTY_STATES: Record<string, { iconType: "star" | "share"; title: string; desc: string }> = {
  starred: {
    iconType: "star",
    title: "Favorite projetos para acessá-los rapidamente",
    desc: "Clique na estrela de qualquer projeto para adicioná-lo aqui.",
  },
  shared: {
    iconType: "share",
    title: "Projetos compartilhados com você aparecerão aqui",
    desc: "Quando alguém compartilhar um projeto, ele aparece nesta seção.",
  },
};

function ProjectCard({
  project,
  onOpen,
  onToggleStar,
  onDelete,
  onUpdateCover,
}: {
  project: Project;
  onOpen: () => void;
  onToggleStar: () => void;
  onDelete: () => void;
  onUpdateCover: (file: File) => Promise<void>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setUploadError(null);
    try {
      await onUpdateCover(file);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Erro ao enviar foto");
      setTimeout(() => setUploadError(null), 4000);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative group rounded-2xl overflow-hidden border border-white/[0.06] bg-[#111113] hover:border-white/[0.12] transition-all">
      {/* ── Cover image area ── */}
      <div
        className="relative h-44 overflow-hidden cursor-pointer bg-gradient-to-br from-[#1a1a2e] to-[#16213e]"
        onClick={onOpen}
      >
        {project.coverImage ? (
          <img
            src={project.coverImage}
            alt={project.client || project.name}
            className="w-full h-full object-cover object-top"
          />
        ) : project.thumbnail ? (
          <div
            className="w-full h-full bg-white overflow-hidden opacity-70"
            dangerouslySetInnerHTML={{
              __html: `<div style="transform:scale(0.3);transform-origin:top left;width:333%;pointer-events:none">${project.thumbnail}</div>`,
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileText className="w-10 h-10 text-white/8" />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />

        {/* Upload cover button — appears on hover */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click(); }}
          disabled={uploading}
          className={cn(
            "absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium backdrop-blur-md transition-all cursor-pointer",
            "bg-black/60 border border-white/10 text-white/70 hover:text-white hover:bg-black/80",
            "opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0",
            uploading && "opacity-100 translate-y-0"
          )}
        >
          {uploading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Camera className="w-3 h-3" />
          )}
          {uploading ? "Enviando…" : project.coverImage ? "Mudar foto" : "Adicionar foto"}
        </button>

        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleCoverChange}
        />

        {/* Upload error toast */}
        {uploadError && (
          <div className="absolute inset-x-2 bottom-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/90 backdrop-blur-sm text-white text-[11px] font-medium">
            <span className="flex-1 truncate">{uploadError}</span>
          </div>
        )}
      </div>

      {/* ── Info ── */}
      <button
        onClick={onOpen}
        className="w-full text-left px-4 py-3 cursor-pointer"
      >
        <h3 className="text-sm font-semibold text-white/85 truncate">{project.name}</h3>
        {project.client && (
          <p className="text-[11px] text-white/35 truncate mt-0.5">{project.client}</p>
        )}
        <p className="text-[10px] text-white/20 mt-1.5">
          {project.pages.length} página{project.pages.length !== 1 ? "s" : ""} · {timeAgo(project.updatedAt)}
        </p>
      </button>

      {/* ── Actions (top-right) ── */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
          className={cn(
            "p-1.5 rounded-lg backdrop-blur-sm transition-all cursor-pointer",
            project.starred ? "bg-yellow-500/20 text-yellow-400" : "bg-black/50 text-white/50 hover:text-yellow-400"
          )}
        >
          <Star className={cn("w-3.5 h-3.5", project.starred && "fill-current")} />
        </button>

        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="p-1.5 rounded-lg bg-black/50 text-white/50 hover:text-white backdrop-blur-sm transition-all cursor-pointer"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 w-40 bg-[#1a1a1e] border border-white/[0.08] rounded-xl shadow-2xl z-50 py-1">
              <button
                onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click(); setMenuOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-white/60 hover:bg-white/[0.05] cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" /> {project.coverImage ? "Mudar foto" : "Adicionar foto"}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); setMenuOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir projeto
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProjectsPage({
  projects,
  filter,
  onOpenProject,
  onCreateProject,
  onToggleStar,
  onDeleteProject,
  onUpdateCover,
}: ProjectsPageProps) {
  const [search, setSearch] = useState("");

  let filtered = projects;
  if (filter === "starred") filtered = projects.filter((p) => p.starred);
  if (filter === "mine") filtered = projects.filter((p) => p.createdBy === "me");
  if (filter === "shared") filtered = projects.filter((p) => p.createdBy === "shared");
  if (search)
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.client.toLowerCase().includes(search.toLowerCase())
    );

  const grouped: Record<string, Project[]> = {};
  filtered.forEach((p) => {
    const key = p.client || "Sem cliente";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  });

  const isEmpty = filtered.length === 0 && !search;
  const emptyState = EMPTY_STATES[filter];

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-6">{TITLES[filter]}</h1>

      {/* Search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-white/25" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar projetos ou clientes..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none"
          />
        </div>
      </div>

      {/* Empty states */}
      {isEmpty && emptyState && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-6">
            {emptyState.iconType === "star" ? (
              <Star className="w-7 h-7 text-white/20" />
            ) : (
              <Share2 className="w-7 h-7 text-white/20" />
            )}
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">{emptyState.title}</h2>
          <p className="text-sm text-white/40 max-w-md">{emptyState.desc}</p>
        </div>
      )}

      {isEmpty && !emptyState && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderOpen className="w-12 h-12 text-white/10 mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Nenhum projeto ainda</h2>
          <p className="text-sm text-white/40 mb-6">Crie seu primeiro projeto para começar</p>
          <button
            onClick={onCreateProject}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:shadow-lg hover:shadow-purple-500/20 transition-all cursor-pointer"
          >
            Criar projeto
          </button>
        </div>
      )}

      {/* Grid grouped by client */}
      {Object.entries(grouped).map(([client, clientProjects]) => (
        <div key={client} className="mb-10">
          <h3 className="text-xs font-medium text-white/30 uppercase tracking-widest mb-4">{client}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Create new — first group only */}
            {filter === "all" && client === Object.keys(grouped)[0] && (
              <button
                onClick={onCreateProject}
                className="h-[236px] rounded-2xl border-2 border-dashed border-white/[0.07] flex flex-col items-center justify-center text-white/20 hover:border-purple-500/30 hover:text-purple-400 transition-all cursor-pointer group"
              >
                <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">Criar novo projeto</span>
              </button>
            )}

            {clientProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => onOpenProject(project)}
                onToggleStar={() => onToggleStar(project.id)}
                onDelete={() => onDeleteProject(project.id)}
                onUpdateCover={(file) => onUpdateCover(project.id, file)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
