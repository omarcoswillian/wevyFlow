"use client";

import { HomeView } from "../../components/HomeView";
import { CopyView } from "../../components/CopyView";
import { useAppContext } from "../_context";

export default function Page() {
  const { handleGenerate, isLoading, navigate, setCommandPaletteOpen } = useAppContext();

  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="copy"
      contentOverride={<CopyView />}
    />
  );
}
