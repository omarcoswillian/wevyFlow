"use client";

import { AppProvider, useAppContext } from "./_context";
import { CommandPalette } from "../components/CommandPalette";

function GlobalPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    projects,
    navigate,
    handleOpenProject,
    handleCreateProject,
    handleTemplateFromResources,
  } = useAppContext();

  return (
    <CommandPalette
      open={commandPaletteOpen}
      onClose={() => setCommandPaletteOpen(false)}
      projects={projects}
      onNavigate={navigate}
      onOpenProject={handleOpenProject}
      onCreateProject={handleCreateProject}
      onSelectTemplate={handleTemplateFromResources}
    />
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <GlobalPalette />
      <div className="h-screen overflow-hidden">{children}</div>
    </AppProvider>
  );
}
