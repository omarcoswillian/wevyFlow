"use client";

import { useEffect, useState } from "react";
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem("wf_onboarding_done");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!done) setOpen(true);
    } catch {
      // storage unavailable
    }
  }, []);

  return (
    <OnboardingWizard
      open={open}
      onClose={() => {
        try { localStorage.setItem("wf_onboarding_done", "1"); } catch {}
        setOpen(false);
      }}
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
