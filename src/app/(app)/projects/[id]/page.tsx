"use client";

import { use } from "react";
import { HomeView } from "../../../components/HomeView";
import { ProjectDetailPage } from "../../../components/pages/ProjectDetailPage";
import { useAppContext } from "../../_context";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const {
    handleGenerate, isLoading, navigate, setCommandPaletteOpen,
    projects, handleOpenPage, handleCreatePage, deletePageFromProject,
  } = useAppContext();

  const project = projects.find((p) => p.id === id);

  const content = project ? (
    <ProjectDetailPage
      project={project}
      onBack={() => navigate("projects-all")}
      onOpenPage={handleOpenPage}
      onCreatePage={handleCreatePage}
      onDeletePage={(pageId) => deletePageFromProject(project.id, pageId)}
    />
  ) : (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 text-white/60">
      <h2 className="text-xl font-semibold mb-2">Projeto não encontrado</h2>
      <p className="text-sm text-white/40 mb-4">Esse projeto pode ter sido removido ou a URL está incorreta.</p>
      <button
        onClick={() => navigate("projects-all")}
        className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/80 text-sm cursor-pointer"
      >
        Voltar para projetos
      </button>
    </div>
  );

  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="projects-all"
      contentOverride={content}
    />
  );
}
