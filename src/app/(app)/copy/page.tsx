"use client";

import { HomeView } from "../../components/HomeView";
import { CopyView } from "../../components/CopyView";
import { useAppContext } from "../_context";

export default function Page() {
  const { navigate, setCommandPaletteOpen } = useAppContext();

  return (
    <HomeView
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="copy"
      contentOverride={<CopyView />}
    />
  );
}
