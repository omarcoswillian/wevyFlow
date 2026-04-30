"use client";

import { HomeView } from "../components/HomeView";
import { useAppContext } from "./_context";

export default function Page() {
  const { handleGenerate, isLoading, navigate, setCommandPaletteOpen, limitReached, clearLimitReached } = useAppContext();
  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      upgradeOpen={limitReached}
      onUpgradeClose={clearLimitReached}
    />
  );
}
