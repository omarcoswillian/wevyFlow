"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Project, timeAgo } from "../../lib/projects";
import { Search, Plus, Star, MoreHorizontal, Trash2, FolderOpen, FileText, Share2 } from "lucide-react";

interface ProjectsPageProps {
  projects: Project[];
  filter: "all" | "starred" | "mine" | "shared";
  onOpenProject: (project: Project) => void;
  onCreateProject: () => void;
  onToggleStar: (id: string) => void;
  onDeleteProject: (id: string) => void;
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

export function ProjectsPage({ projects, filter, onOpenProject, onCreateProject, onToggleStar, onDeleteProject }: ProjectsPageProps) {
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  let filtered = projects;
  if (filter === "starred") filtered = projects.filter((p) => p.starred);
  if (filter === "mine") filtered = projects.filter((p) => p.createdBy === "me");
  if (filter === "shared") filtered = projects.filter((p) => p.createdBy === "shared");
  if (search) filtered = filtered.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.client.toLowerCase().includes(search.toLowerCase()));

  // Group by client
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

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-white/25" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar projetos..." className="flex-1 bg-transparent text-sm text-white placeholder:text-white/25 focus:outline-none" />
        </div>
      </div>

      {/* Empty state */}
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
          <button onClick={onCreateProject}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium hover:shadow-lg hover:shadow-purple-500/20 transition-all cursor-pointer">
            Criar projeto
          </button>
        </div>
      )}

      {/* Projects grid grouped by client */}
      {Object.entries(grouped).map(([client, clientProjects]) => (
        <div key={client} className="mb-8">
          <h3 className="text-xs font-medium text-white/30 uppercase tracking-widest mb-3">{client}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Create new card - only in "all" */}
            {filter === "all" && client === Object.keys(grouped)[0] && (
              <button onClick={onCreateProject}
                className="h-52 rounded-2xl border-2 border-dashed border-white/[0.08] flex flex-col items-center justify-center text-white/20 hover:border-purple-500/30 hover:text-purple-400 transition-all cursor-pointer group">
                <Plus className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">Criar novo projeto</span>
              </button>
            )}

            {clientProjects.map((project) => (
              <div key={project.id} className="relative group">
                <button onClick={() => onOpenProject(project)}
                  className="w-full text-left rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all cursor-pointer">
                  {/* Thumbnail */}
                  <div className="h-36 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-3 overflow-hidden">
                    {project.thumbnail ? (
                      <div className="w-full h-full bg-white rounded-lg overflow-hidden opacity-80 scale-[0.95]"
                        dangerouslySetInnerHTML={{ __html: `<div style="transform:scale(0.3);transform-origin:top left;width:333%;pointer-events:none">${project.thumbnail}</div>` }} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="w-8 h-8 text-white/10" />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-white/80 truncate">{project.name}</h3>
                    <p className="text-[11px] text-white/30 mt-0.5">
                      {project.pages.length} página{project.pages.length !== 1 ? "s" : ""} · Editado {timeAgo(project.updatedAt)}
                    </p>
                  </div>
                </button>

                {/* Actions */}
                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); onToggleStar(project.id); }}
                    className={cn("p-1.5 rounded-lg backdrop-blur-sm transition-all cursor-pointer",
                      project.starred ? "bg-yellow-500/20 text-yellow-400" : "bg-black/40 text-white/50 hover:text-yellow-400")}>
                    <Star className={cn("w-3.5 h-3.5", project.starred && "fill-current")} />
                  </button>
                  <div className="relative">
                    <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === project.id ? null : project.id); }}
                      className="p-1.5 rounded-lg bg-black/40 text-white/50 hover:text-white backdrop-blur-sm transition-all cursor-pointer">
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                    {menuOpen === project.id && (
                      <div className="absolute top-full right-0 mt-1 w-36 bg-[#1a1a1e] border border-white/[0.08] rounded-xl shadow-2xl z-50 py-1">
                        <button onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); setMenuOpen(null); }}
                          className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" /> Excluir projeto
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
