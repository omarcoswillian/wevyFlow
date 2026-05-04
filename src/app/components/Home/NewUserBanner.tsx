"use client";

import { useState, useEffect } from "react";
import { X, ArrowRight } from "lucide-react";

interface NewUserBannerProps {
  onStart: () => void;
}

export function NewUserBanner({ onStart }: NewUserBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem("wf_onboarding_done");
      const dismissed = localStorage.getItem("wf_banner_dismissed");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!done && !dismissed) setVisible(true);
    } catch {
      // storage unavailable
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem("wf_banner_dismissed", "1"); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="w-full max-w-[580px] mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-purple-200 leading-tight">
          Comece criando seu primeiro kit de lancamento
        </p>
        <p className="text-[10px] text-white/35 mt-0.5">
          Leva 2 minutos. A IA gera tudo pelo seu briefing.
        </p>
      </div>
      <button
        onClick={onStart}
        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
      >
        Comecar <ArrowRight className="w-3 h-3" />
      </button>
      <button
        onClick={dismiss}
        className="shrink-0 p-1 rounded-md text-white/25 hover:text-white/50 transition-colors cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
