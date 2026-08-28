"use client";

import { useState, useCallback, useEffect } from "react";

interface WordPressExportModalProps {
  open: boolean;
  onClose: () => void;
  code: string;
  title?: string;
  projectId?: string;
}

type Step = "idle" | "processing" | "done" | "error";

interface ExportResult {
  code: string;
  imagesProcessed: number;
  htmlChars: number;
}

export function WordPressExportModal({ open, onClose, code, title, projectId }: WordPressExportModalProps) {
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<ExportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [leadToken, setLeadToken] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!code) return;
    setStep("processing");
    setResult(null);
    setErrorMsg("");
    try {
      let token = leadToken;
      if (!token) {
        const sourceRes = await fetch("/api/pages/lead-source", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title || "Export WordPress", platform: "wordpress" }),
        });
        if (sourceRes.ok) {
          token = ((await sourceRes.json()) as { token: string }).token;
          setLeadToken(token);
        }
      }

      const res = await fetch("/api/export-wordpress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: code, title, projectId, leadToken: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido");
      setResult(data as ExportResult);
      setStep("done");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Erro ao exportar");
      setStep("error");
    }
  }, [code, title, projectId, leadToken]);

  useEffect(() => {
    if (open && step === "idle") run();
  }, [open, step, run]);

  useEffect(() => {
    if (!open) setStep("idle");
  }, [open]);

  const handleCopy = useCallback(() => {
    if (!result) return;
    navigator.clipboard.writeText(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-wf-border bg-wf-bg shadow-2xl flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-wf-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-wf-text">Exportar para WordPress</h2>
            <p className="text-xs text-wf-text-muted">Plugin nativo WevyFlow · sem Elementor, sem tema por cima</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-wf-text-muted hover:text-wf-text hover:bg-wf-surface-hover transition-all cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-10 h-10 rounded-full border-2 border-wf-primary border-t-transparent animate-spin" />
              <p className="text-sm text-wf-text-muted">Processando imagens e preparando o código…</p>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <p className="text-sm font-medium text-red-400">Erro ao exportar</p>
              <p className="text-xs text-wf-text-muted">{errorMsg}</p>
              <button
                onClick={run}
                className="mt-2 px-4 py-2 rounded-lg bg-wf-primary text-white text-sm font-medium hover:bg-wf-primary-hover transition-all cursor-pointer"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {step === "done" && result && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-wf-surface border border-wf-border p-3 text-center">
                  <p className="text-base font-semibold text-wf-text">{result.imagesProcessed}</p>
                  <p className="text-xs text-wf-text-muted mt-0.5">Imagens</p>
                </div>
                <div className="rounded-xl bg-wf-surface border border-wf-border p-3 text-center">
                  <p className="text-base font-semibold text-wf-text">{result.htmlChars.toLocaleString()}</p>
                  <p className="text-xs text-wf-text-muted mt-0.5">Caracteres</p>
                </div>
              </div>

              <div className="rounded-xl bg-wf-primary/8 border border-wf-primary/20 px-4 py-3 text-xs text-wf-text-muted leading-relaxed space-y-1">
                <strong className="text-wf-text block mb-2">Como publicar — precisa do plugin WevyFlow instalado no WordPress:</strong>
                <div><span className="inline-block w-5 text-wf-primary font-bold">1.</span>No WordPress, vá em <strong>WevyFlow Pages → Nova Página</strong></div>
                <div><span className="inline-block w-5 text-wf-primary font-bold">2.</span>Cole o código abaixo no campo <strong>&quot;Código WevyFlow&quot;</strong></div>
                <div><span className="inline-block w-5 text-wf-primary font-bold">3.</span>Clique em <strong>Salvar/Publicar</strong> — a página fica no ar, sem tema por cima</div>
                <div className="text-wf-primary pt-1">O código já inclui a captura de lead — os formulários enviam direto para o seu painel de Leads, mesmo hospedado fora da WevyFlow (ex: Hostinger).</div>
                <div className="text-wf-primary">As imagens já vêm embutidas no próprio código — nada fica hospedado na WevyFlow, a página funciona 100% independente.</div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-wf-text-muted uppercase tracking-wider">Código WevyFlow — cole no plugin</span>
                  <button
                    onClick={handleCopy}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      copied
                        ? "bg-green-500/15 text-green-400 border border-green-500/30"
                        : "bg-wf-surface border border-wf-border text-wf-text-muted hover:border-wf-primary hover:text-wf-primary"
                    }`}
                  >
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                </div>
                <div className="relative rounded-xl border border-wf-border bg-wf-surface overflow-hidden">
                  <pre className="text-xs text-wf-text-muted font-mono p-4 overflow-auto max-h-52 leading-relaxed whitespace-pre-wrap break-all">
                    {result.code.slice(0, 2000)}
                    {result.code.length > 2000 && `\n\n… +${(result.code.length - 2000).toLocaleString()} chars`}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
