"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Loader2, Unlink, Info, AlertCircle, MonitorPlay } from "lucide-react";

export interface YouTubeStatus {
  configured: boolean;
  connected: boolean;
  channelTitle?: string | null;
  channelPicture?: string | null;
  lastSyncedAt?: string | null;
  ctrAvailable?: boolean | null;
}

const YT_ERROR_LABELS: Record<string, string> = {
  not_configured: "A integração com o YouTube ainda não foi configurada neste ambiente.",
  denied: "Conexão cancelada: você não autorizou o acesso.",
  invalid_state: "A sessão de conexão expirou. Tente de novo.",
  no_refresh_token: "O Google não liberou o acesso contínuo. Remova o acesso do WevyFlow em myaccount.google.com/permissions e conecte de novo.",
  missing_scopes: "Faltou autorizar o acesso ao canal e às estatísticas. Conecte de novo e marque todas as permissões.",
  token_exchange: "Não foi possível concluir a conexão com o Google. Tente de novo.",
};

export function YouTubeConnectionCard({ status, onChange }: { status: YouTubeStatus | null; onChange: () => void }) {
  const searchParams = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Mensagens vindas do retorno do OAuth (?yt_connected / ?yt_error).
  useEffect(() => {
    const err = searchParams.get("yt_error");
    if (err) setNotice({ type: "error", text: YT_ERROR_LABELS[err] ?? "Não foi possível conectar o YouTube. Tente de novo." });
    else if (searchParams.get("yt_connected")) setNotice({ type: "success", text: "Canal conectado." });
  }, [searchParams]);

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/youtube/disconnect", { method: "POST" });
      if (!res.ok) throw new Error();
      setNotice({ type: "success", text: "Canal desconectado e dados removidos." });
      onChange();
    } catch {
      setNotice({ type: "error", text: "Não foi possível desconectar agora." });
    } finally {
      setDisconnecting(false);
    }
  };

  if (!status) return null;

  return (
    <div className="space-y-2">
      {notice && (
        <div className={`flex items-start gap-2 px-4 py-2.5 rounded-xl border text-[11px] ${notice.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
          {notice.type === "success" ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          {notice.text}
        </div>
      )}

      {!status.configured ? (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <Info className="w-4 h-4 text-white/30 shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/45 leading-relaxed">
            A conexão com o YouTube ainda não está configurada neste ambiente (faltam as credenciais do Google).
          </p>
        </div>
      ) : !status.connected ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex-wrap">
          <div className="flex items-center gap-2.5">
            <MonitorPlay className="w-4 h-4 text-white/40" />
            <p className="text-[12px] text-white/60">Conecte seu canal para ver o desempenho dos vídeos e das thumbnails. Só leitura: a WevyFlow não publica nada no seu canal.</p>
          </div>
          <a href="/api/integrations/youtube/connect" className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-semibold transition-colors">
            Conectar YouTube
          </a>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="flex items-center gap-2.5 min-w-0">
            {status.channelPicture
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={status.channelPicture} alt="" className="w-7 h-7 rounded-full object-cover" />
              : <MonitorPlay className="w-4 h-4 text-white/40" />}
            <p className="text-[12px] text-white/70 truncate">Canal conectado: <span className="text-white/90 font-medium">{status.channelTitle}</span></p>
          </div>
          <button onClick={disconnect} disabled={disconnecting} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-white/35 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50">
            {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlink className="w-3 h-3" />} Desconectar
          </button>
        </div>
      )}
    </div>
  );
}
