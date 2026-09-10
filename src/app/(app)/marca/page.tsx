"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { HomeView } from "../../components/HomeView";
import { BrandIdentityPage } from "../../components/BrandIdentityPage";
import { useAppContext } from "../_context";

function MarcaContent() {
  const {
    handleGenerate, isLoading, navigate, setCommandPaletteOpen,
    activeLaunchKit, openLaunchByProjectId, launchKits,
  } = useAppContext();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!projectId) return;
    // Same request-race guard as lancamentos/page.tsx (openLaunchByProjectId
    // ignores a superseded response internally) — see that file's comment.
    let cancelled = false;
    setStatus("loading");
    openLaunchByProjectId(projectId)
      .then((launch) => {
        if (cancelled) return;
        setStatus(launch ? "idle" : "error");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  let content: React.ReactNode;
  if (!projectId) {
    // KV belongs to a specific launch — the sidebar's "KV" link has no
    // launch context to attach, so land here and let the user pick one
    // (achado de revisão do Codex: gerar KV sem lançamento vinculado
    // permitia contaminar um lançamento com a identidade de outro).
    content = (
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center px-6 py-10 min-h-full">
          <div className="w-full max-w-[640px]">
            <p className="text-[9px] uppercase tracking-widest text-white/20 font-semibold mb-1">Sistema de Identidade Visual</p>
            <h1 className="text-[1.6rem] font-semibold text-white tracking-tight mb-1">Escolha um lançamento</h1>
            <p className="text-[13px] text-white/30 mb-6 leading-relaxed">
              A KV pertence a um lançamento específico — escolha qual lançamento vai ganhar uma identidade visual nova.
            </p>
            {launchKits.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-8 text-center">
                <p className="text-[13px] text-white/40">Você ainda não tem nenhum lançamento.</p>
                <button
                  onClick={() => navigate("lancamentos")}
                  className="mt-3 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-medium cursor-pointer transition-colors"
                >
                  Criar lançamento
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {launchKits.map((kit) => (
                  <button
                    key={kit.projectId}
                    onClick={() => navigate("marca", kit.projectId)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-purple-500/20 transition-colors cursor-pointer text-left"
                  >
                    <span className="text-[13px] text-white/70 font-medium">{kit.brandInfo.productName || "Lançamento sem nome"}</span>
                    {kit.selectedKvAssetId && (
                      <span className="text-[9px] uppercase tracking-widest text-emerald-400 font-semibold">KV escolhido</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } else if (status === "loading") {
    content = (
      <div className="flex-1 flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
      </div>
    );
  } else if (status === "error" || activeLaunchKit?.projectId !== projectId) {
    content = (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-center px-6">
        <h2 className="text-[16px] font-semibold text-white mb-2">Lançamento não encontrado</h2>
        <p className="text-[12px] text-white/40 max-w-sm">
          Esse lançamento pode ter sido removido, pertence a outra conta, ou o link está incorreto.
        </p>
      </div>
    );
  } else {
    content = <BrandIdentityPage projectId={projectId} />;
  }

  return (
    <HomeView
      onGenerate={handleGenerate}
      isLoading={isLoading}
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="marca"
      contentOverride={content}
    />
  );
}

export default function Page() {
  return <MarcaContent />;
}
