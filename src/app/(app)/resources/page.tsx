"use client";

import { HomeView } from "../../components/HomeView";
import { ResourcesPage } from "../../components/pages/ResourcesPage";
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
      activeNav="resources"
      contentOverride={<ResourcesPage onSelectTemplate={handleTemplateFromResources} />}
    />
  );
}
