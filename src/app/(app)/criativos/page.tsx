"use client";

import { useSearchParams } from "next/navigation";
import { HomeView } from "../../components/HomeView";
import { CriativosView } from "../../components/CriativosView";
import { useAppContext } from "../_context";

export default function Page() {
  const { handleGenerate, isLoading, navigate, setCommandPaletteOpen } = useAppContext();
  const searchParams = useSearchParams();
  const serviceType = searchParams.get("tipo") ?? "criativos";

  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="criativos"
      contentOverride={<CriativosView key={serviceType} />}
    />
  );
}
