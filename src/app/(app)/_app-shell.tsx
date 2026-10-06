"use client";

import { AppProvider, useAppContext } from "./_context";
import { CommandPalette } from "../components/CommandPalette";
import { LaunchWizard } from "../components/LaunchWizard";

function GlobalPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    navigate,
  } = useAppContext();

  return (
    <CommandPalette
      open={commandPaletteOpen}
      onClose={() => setCommandPaletteOpen(false)}
      onNavigate={navigate}
    />
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <GlobalPalette />
      <LaunchWizard />
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
