"use client";

import { useSearchParams } from "next/navigation";
import { HomeView } from "../../components/HomeView";
import { AnunciosDashboard, type AdsVisao } from "../../components/AnunciosDashboard";
import { useAppContext } from "../_context";

export default function Page() {
  const { navigate, setCommandPaletteOpen } = useAppContext();
  const searchParams = useSearchParams();
  const visao = (searchParams.get("visao") ?? "todos") as AdsVisao;

  return (
    <HomeView
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="anuncios"
      contentOverride={<AnunciosDashboard key={visao} visao={visao} />}
    />
  );
}
