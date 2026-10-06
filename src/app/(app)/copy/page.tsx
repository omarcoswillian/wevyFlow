"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { HomeView } from "../../components/HomeView";
import { CopyView } from "../../components/CopyView";
import { useAppContext } from "../_context";
import type { CopyType } from "../../lib/copy/useCopyDocuments";

const TIPOS: CopyType[] = ["ads", "carrossel", "thumb"];

export default function Page() {
  const { navigate, setCommandPaletteOpen } = useAppContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const param = searchParams.get("tipo");
  const tipo: CopyType = TIPOS.find((t) => t === param) ?? "ads";

  return (
    <HomeView
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="copy"
      contentOverride={<CopyView tipo={tipo} onTipoChange={(t) => router.replace(`/copy?tipo=${t}`)} />}
    />
  );
}
