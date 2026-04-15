"use client";

import { Project, ProjectPage, timeAgo } from "../../lib/projects";
import { ChevronLeft, Plus, FileText, Trash2, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProjectDetailPageProps {
  project: Project;
  onBack: () => void;
  onOpenPage: (page: ProjectPage) => void;
  onCreatePage: () => void;
  onDeletePage: (pageId: string) => void;
}

export function ProjectDetailPage({ project, onBack, onOpenPage, onCreatePage, onDeletePage }: ProjectDetailPageProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  return (
    <div className="p-8 max-w-[1100px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-xl text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all cursor-pointer">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-white">{project.name}</h1>
          <p className="text-xs text-white/30">{project.client} · {project.pages.length} página{project.pages.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Pages grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Create new page */}
        <button onClick={onCreatePage}
          className="h-44 rounded-2xl border-2 border-dashed border-white/[0.08] flex flex-col items-center justify-center text-white/20 hover:border-purple-500/30 hover:text-purple-400 transition-all cursor-pointer group">
          <Plus className="w-7 h-7 mb-2 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-medium">Nova página</span>
        </button>

        {project.pages.map((page) => (
          <div key={page.id} className="relative group">
            <button onClick={() => onOpenPage(page)}
              className="w-full text-left rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04] transition-all cursor-pointer">
              <div className="h-32 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] p-2 overflow-hidden">
                {page.code ? (
                  <div className="w-full h-full bg-white rounded-lg overflow-hidden opacity-80"
                    dangerouslySetInnerHTML={{ __html: `<div style="transform:scale(0.25);transform-origin:top left;width:400%;pointer-events:none">${page.code.slice(0, 500)}</div>` }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FileText className="w-6 h-6 text-white/10" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-white/80 truncate">{page.name}</h3>
                <p className="text-[10px] text-white/25 mt-0.5">{page.platform.toUpperCase()} · {timeAgo(page.updatedAt)}</p>
              </div>
            </button>

            {/* Delete */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === page.id ? null : page.id); }}
                className="p-1.5 rounded-lg bg-black/40 text-white/50 hover:text-white backdrop-blur-sm cursor-pointer">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {menuOpen === page.id && (
                <div className="absolute top-full right-0 mt-1 w-32 bg-[#1a1a1e] border border-white/[0.08] rounded-xl shadow-2xl z-50 py-1">
                  <button onClick={(e) => { e.stopPropagation(); onDeletePage(page.id); setMenuOpen(null); }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-red-400 hover:bg-red-500/10 cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
