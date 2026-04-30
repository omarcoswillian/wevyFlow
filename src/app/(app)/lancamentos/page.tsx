"use client";

import { HomeView } from "../../components/HomeView";
import { KitDashboard } from "../../components/KitDashboard";
import { LaunchHub } from "../../components/LaunchHub";
import { useAppContext } from "../_context";

export default function Page() {
  const { handleGenerate, isLoading, navigate, setCommandPaletteOpen, activeLaunchKit } = useAppContext();

  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="lancamentos"
      contentOverride={activeLaunchKit ? <LaunchHub /> : <KitDashboard />}
    />
  );
}
