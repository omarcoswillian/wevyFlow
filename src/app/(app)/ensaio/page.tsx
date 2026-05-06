"use client";

import { Suspense } from "react";
import { HomeView } from "../../components/HomeView";
import { EnsaioView } from "../../components/EnsaioView";
import { useAppContext } from "../_context";

function EnsaioPage() {
  const { handleGenerate, isLoading, navigate, setCommandPaletteOpen } = useAppContext();

  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="ensaio"
      contentOverride={<EnsaioView />}
    />
  );
}

export default function Page() {
  return (
    <Suspense>
      <EnsaioPage />
    </Suspense>
  );
}
