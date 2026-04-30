"use client";

import { AppProvider, useAppContext } from "./_context";
import { CommandPalette } from "../components/CommandPalette";
import { LaunchWizard } from "../components/LaunchWizard";

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

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <GlobalPalette />
      <LaunchWizard />
      <div className="h-screen overflow-hidden">{children}</div>
    </AppProvider>
  );
}
