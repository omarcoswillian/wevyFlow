"use client";

import { HomeView } from "../../components/HomeView";
import { LaunchBundlePage } from "../../components/pages/LaunchBundlePage";
import { useAppContext } from "../_context";

export default function Page() {
  const {
    handleGenerate,
    isLoading,
    navigate,
    setCommandPaletteOpen,
    handleTemplateFromResources,
  } = useAppContext();

  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="lancamento-pronto"
      contentOverride={<LaunchBundlePage onSelectTemplate={handleTemplateFromResources} />}
    />
  );
}
