"use client";

import { HomeView } from "../../components/HomeView";
import PaginasView from "../../components/PaginasView";
import { useAppContext } from "../_context";

export default function PaginasPage() {
  const { handleGenerate, isLoading, navigate, setCommandPaletteOpen } = useAppContext();

  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="paginas"
      contentOverride={<PaginasView />}
    />
  );
}
