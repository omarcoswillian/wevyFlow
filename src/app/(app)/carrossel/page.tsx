"use client";

import { HomeView } from "../../components/HomeView";
import { CarrosselView } from "../../components/CarrosselView";
import { useAppContext } from "../_context";

export default function Page() {
  const { navigate, setCommandPaletteOpen } = useAppContext();

  return (
    <HomeView
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="carrossel"
      contentOverride={<CarrosselView />}
    />
  );
}
