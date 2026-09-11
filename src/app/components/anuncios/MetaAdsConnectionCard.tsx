"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2, Unlink, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdAccount { id: string; name: string }

interface MetaAdsStatus {
  configured: boolean;
  connected: boolean;
  metaUserName?: string | null;
  adAccountId?: string | null;
  adAccountName?: string | null;
  availableAdAccounts?: AdAccount[];
  needsAccountPick?: boolean;
}

const META_ERROR_LABELS: Record<string, string> = {
  not_configured: "Integração com Meta Ads ainda não configurada.",
  denied: "Conexão cancelada — você não autorizou o acesso.",
  invalid_state: "A sessão de conexão expirou — tenta de novo.",
  unknown: "Não deu pra conectar com o Meta Ads — tenta de novo.",
};

/** Connection status card for the "Conectar Meta Ads" flow (camada 3 do
 * roadmap de Ads). Enquanto META_APP_ID/META_APP_SECRET não estiverem
 * configurados (App Review da Meta ainda em andamento), mostra um estado
 * informativo em vez de um botão quebrado. */
export function MetaAdsConnectionCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<MetaAdsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [confirmingAccount, setConfirmingAccount] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/meta-ads/status");
      const data = (await res.json()) as MetaAdsStatus;
      setStatus(data);
      if (data.availableAdAccounts?.length) setSelectedAccountId(data.availableAdAccounts[0].id);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Mensagens vindas do redirect do callback OAuth (?meta_connected / ?meta_error)
  useEffect(() => {
    const connected = searchParams.get("meta_connected");
    const error = searchParams.get("meta_error");
    if (connected) setNotice({ type: "success", text: "Meta Ads conectado!" });
    else if (error) setNotice({ type: "error", text: META_ERROR_LABELS[error] ?? META_ERROR_LABELS.unknown });
    if (connected || error) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("meta_connected");
      params.delete("meta_error");
      params.delete("meta_pick_account");
      const qs = params.toString();
      router.replace(qs ? `/anuncios?${qs}` : "/anuncios");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch("/api/integrations/meta-ads/disconnect", { method: "POST" });
      await loadStatus();
      setNotice({ type: "success", text: "Meta Ads desconectado." });
    } catch {
      setNotice({ type: "error", text: "Não deu pra desconectar — tenta de novo." });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleConfirmAccount = async () => {
    if (!selectedAccountId) return;
    setConfirmingAccount(true);
    try {
      const res = await fetch("/api/integrations/meta-ads/select-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adAccountId: selectedAccountId }),
      });
      if (!res.ok) throw new Error();
      await loadStatus();
    } catch {
      setNotice({ type: "error", text: "Não deu pra selecionar essa conta — tenta de novo." });
    } finally {
      setConfirmingAccount(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />
        <span className="text-[11px] text-white/30">Verificando conexão com o Meta Ads...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notice && (
        <div className={cn(
          "flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-[11px]",
          notice.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-300"
        )}>
          <span className="flex items-center gap-1.5">{notice.type === "success" ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />} {notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-current/60 hover:text-current cursor-pointer shrink-0">×</button>
        </div>
      )}

      {!status?.configured ? (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <Info className="w-4 h-4 text-white/25 shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/35 leading-relaxed">
            Conexão com conta real de Meta Ads (CTR, impressões, vendas) ainda não está disponível — a WevyFlow está no processo de aprovação da Meta pra isso. Por enquanto, os dados abaixo são o proxy de tempo no ar.
          </p>
        </div>
      ) : !status.connected ? (
        <a
          href="/api/integrations/meta-ads/connect"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1877F2] hover:brightness-110 text-white text-[12px] font-medium transition-all cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>
          Conectar Meta Ads
        </a>
      ) : status.needsAccountPick ? (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex-wrap">
          <span className="text-[11px] text-white/50">Qual conta de anúncio é essa?</span>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] text-white/70 outline-none cursor-pointer"
          >
            {status.availableAdAccounts?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button
            onClick={handleConfirmAccount}
            disabled={confirmingAccount}
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-medium cursor-pointer transition-colors disabled:opacity-50"
          >
            {confirmingAccount ? "Confirmando..." : "Confirmar"}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 flex-wrap">
          <span className="flex items-center gap-2 text-[11px] text-emerald-300">
            <Check className="w-3.5 h-3.5" /> Conectado: <strong className="font-semibold">{status.adAccountName ?? status.metaUserName}</strong>
          </span>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/40 hover:text-red-300 text-[10px] font-medium cursor-pointer transition-colors disabled:opacity-50"
          >
            <Unlink className="w-3 h-3" /> {disconnecting ? "Desconectando..." : "Desconectar"}
          </button>
        </div>
      )}
    </div>
  );
}
