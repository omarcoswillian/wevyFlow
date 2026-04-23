"use client";

import { HomeView } from "../../../components/HomeView";
import { ProjectsPage } from "../../../components/pages/ProjectsPage";
import { useAppContext } from "../../_context";

export default function Page() {
  const {
    handleGenerate, isLoading, navigate, setCommandPaletteOpen,
    projects, handleOpenProject, handleCreateProject, toggleStar, deleteProject,
  } = useAppContext();

  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="projects-starred"
      contentOverride={
        <ProjectsPage
          projects={projects}
          filter="starred"
          onOpenProject={handleOpenProject}
          onCreateProject={handleCreateProject}
          onToggleStar={toggleStar}
          onDeleteProject={deleteProject}
        />
      }
    />
  );
}
