"use client";

import { useSearchParams } from "next/navigation";
import { HomeView } from "../../components/HomeView";
import PaginasView from "../../components/PaginasView";
import { PageMonitorView } from "../../components/paginas/PageMonitorView";
import { useAppContext } from "../_context";

export default function PaginasPage() {
  const { handleGenerate, isLoading, navigate, setCommandPaletteOpen } = useAppContext();
  const searchParams = useSearchParams();
  const visao = searchParams.get("visao") ?? "minhas";

  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="paginas"
      contentOverride={visao === "monitoramento" ? <PageMonitorView /> : <PaginasView />}
    />
  );
}
