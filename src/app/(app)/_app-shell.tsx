"use client";

import { useState } from "react";
import { AppProvider, useAppContext } from "./_context";
import { CommandPalette } from "../components/CommandPalette";
import { LaunchWizard } from "../components/LaunchWizard";
import { OnboardingWizard } from "../components/Onboarding";

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

function OnboardingGate() {
  const { launchKits, launchKitsLoading, launchKitsError } = useAppContext();
  const [dismissed, setDismissed] = useState(false);

  // Derived from the server, never from a browser flag: a user only "has
  // done onboarding" once they have at least one active (briefing complete
  // + strategy chosen) launch. A network failure while loading must not be
  // read as "no launch" — wait for the load to actually finish, and never
  // force the gate open just because the load errored.
  const hasActiveLaunch = launchKits.some((k) => k.status === "active");
  const open = !launchKitsLoading && !launchKitsError && !hasActiveLaunch && !dismissed;

  return (
    <OnboardingWizard
      open={open}
      onClose={() => setDismissed(true)}
    />
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <GlobalPalette />
      <LaunchWizard />
      <OnboardingGate />
      <div
        className="h-screen overflow-hidden"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >{children}</div>
    </AppProvider>
  );
}
