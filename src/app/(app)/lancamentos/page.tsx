"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { HomeView } from "../../components/HomeView";
import { KitDashboard } from "../../components/KitDashboard";
import { LaunchHub } from "../../components/LaunchHub";
import { useAppContext } from "../_context";

function LancamentosContent() {
  const {
    navigate, setCommandPaletteOpen,
    activeLaunchKit, openLaunchByProjectId, resumeLaunchWizard,
  } = useAppContext();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    if (!projectId) return;
    // Deliberately always re-fetches, even when `activeLaunchKit` already
    // matches `projectId` (e.g. navigating A→B→A within the same session).
    // A cache-shortcut here would skip dispatching a new request, leaving
    // an older in-flight request for a *different* project (B) as the only
    // one in flight — its late response would then be free to overwrite
    // this project's state, and this page's `status` would never leave
    // "loading" (no fetch means no `.then`/`.catch` to move it to "idle").
    // `openLaunchByProjectId`'s request-id guard (see _context.tsx) makes
    // this safe: only the most recently dispatched call is allowed to touch
    // shared state, so a superseded response is simply ignored (see
    // launches review item 2 / A→B→A race).
    let cancelled = false;
    setStatus("loading");
    openLaunchByProjectId(projectId)
      .then((launch) => {
        if (cancelled) return;
        if (!launch) { setStatus("error"); return; }
        if (launch.status === "draft") {
          // Draft without a chosen strategy yet — send the user back into
          // the wizard instead of rendering the Hub (which returns null
          // for a kit with no strategyId — see review item 8). `archived`
          // is handled by its own read-only view below, never the wizard
          // (see review item H).
          resumeLaunchWizard(projectId);
        }
        setStatus("idle");
      })
      .catch(() => {
        // A thrown network/parse error left `status` stuck on "loading"
        // forever before this catch existed (see review item 8).
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  let content: React.ReactNode;
  if (!projectId) {
    content = <KitDashboard />;
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
  } else if (activeLaunchKit.status === "archived") {
    // Deliberately not the wizard (would un-archive on close) nor the Hub
    // (implies an active, editable launch) — see review item H.
    content = (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-center px-6">
        <h2 className="text-[16px] font-semibold text-white mb-2">
          {activeLaunchKit.briefing.productName || "Lançamento"} está arquivado
        </h2>
        <p className="text-[12px] text-white/40 max-w-sm">
          Lançamentos arquivados ficam somente leitura. Para retomar a edição, contate o suporte.
        </p>
      </div>
    );
  } else {
    content = <LaunchHub />;
  }

  return (
    <HomeView
      onNavigate={navigate}
      onOpenSearch={() => setCommandPaletteOpen(true)}
      activeNav="lancamentos"
      contentOverride={content}
    />
  );
}

export default function Page() {
  return <LancamentosContent />;
}
