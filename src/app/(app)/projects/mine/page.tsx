"use client";

import { HomeView } from "../../../components/HomeView";
import { ProjectsPage } from "../../../components/pages/ProjectsPage";
import { useAppContext } from "../../_context";

export default function Page() {
  const {
    handleGenerate, isLoading, navigate, setCommandPaletteOpen,
    projects, handleOpenProject, handleCreateProject, toggleStar, deleteProject, updateCoverImage,
  } = useAppContext();

  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="projects-mine"
      contentOverride={
        <ProjectsPage
          projects={projects}
          filter="mine"
          onOpenProject={handleOpenProject}
          onCreateProject={handleCreateProject}
          onToggleStar={toggleStar}
          onDeleteProject={deleteProject}
          onUpdateCover={updateCoverImage}
        />
      }
    />
  );
}
