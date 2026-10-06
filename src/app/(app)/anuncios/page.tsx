"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Megaphone, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";
import { HomeView } from "../../components/HomeView";
import { AnunciosDashboard, type AdsVisao } from "../../components/AnunciosDashboard";
import { YouTubeDashboard } from "../../components/YouTubeDashboard";
import { useAppContext } from "../_context";

type Plataforma = "facebook" | "youtube";

export default function Page() {
  const { navigate, setCommandPaletteOpen } = useAppContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const visao = (searchParams.get("visao") ?? "todos") as AdsVisao;
  const plataforma: Plataforma = searchParams.get("plataforma") === "youtube" ? "youtube" : "facebook";

  const goPlataforma = (p: Plataforma) => router.replace(`/anuncios?plataforma=${p}&visao=${visao}`);

  const content = (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center gap-1 px-8 pt-4 border-b border-white/[0.05] bg-[#0a0a0e]">
        {([["facebook", "Facebook", Megaphone], ["youtube", "YouTube", MonitorPlay]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => goPlataforma(id)}
            className={cn(
              "relative flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium transition-colors cursor-pointer",
              plataforma === id ? "text-white" : "text-white/40 hover:text-white/70",
            )}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
            {plataforma === id && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-purple-400" />}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {plataforma === "youtube"
          ? <YouTubeDashboard key={`yt-${visao}`} visao={visao} />
          : <AnunciosDashboard key={visao} visao={visao} />}
      </div>
    </div>
  );

  return (
    <HomeView
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="anuncios"
      contentOverride={content}
    />
  );
}
