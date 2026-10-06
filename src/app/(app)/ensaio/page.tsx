"use client";

import { Suspense } from "react";
import { HomeView } from "../../components/HomeView";
import { EnsaioView } from "../../components/EnsaioView";
import { useAppContext } from "../_context";

function EnsaioPage() {
  const { navigate, setCommandPaletteOpen } = useAppContext();

  return (
    <HomeView
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
