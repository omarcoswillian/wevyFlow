"use client";

import { HomeView } from "../../components/HomeView";
import { EmailsDashboard } from "../../components/EmailsDashboard";
import { useAppContext } from "../_context";

export default function Page() {
  const { handleGenerate, isLoading, navigate, setCommandPaletteOpen } = useAppContext();

  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="emails"
      contentOverride={<EmailsDashboard />}
    />
  );
}
