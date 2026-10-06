"use client";

import { useSearchParams } from "next/navigation";
import { HomeView } from "../../components/HomeView";
import { EmailsDashboard } from "../../components/EmailsDashboard";
import { useAppContext } from "../_context";
import type { EmailSequenceType } from "../../lib/types-kit";

export default function Page() {
  const { navigate, setCommandPaletteOpen } = useAppContext();
  const searchParams = useSearchParams();
  const categoria = (searchParams.get("categoria") ?? "cpl") as EmailSequenceType;

  return (
    <HomeView
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="emails"
      // Sem `key={categoria}` de propósito, ao contrário de /anuncios — aqui
      // trocar de categoria (Pré-Lançamento/Vendas/Revendas) não deve
      // resetar qual kit de lançamento está selecionado, só trocar a aba
      // dentro do mesmo painel.
      contentOverride={<EmailsDashboard categoria={categoria} />}
    />
  );
}
