"use client";

import { useState, useCallback, useEffect } from "react";

interface WebflowExportModalProps {
  open: boolean;
  onClose: () => void;
  code: string;
  projectId?: string;
}

type Step = "idle" | "processing" | "done" | "error";

interface ExportResult {
  head: string;
  body: string;
  script: string;
  imagesProcessed: number;
  headChars: number;
  bodyChars: number;
  scriptChars: number;
}

function CopyBlock({ label, value, limit }: { label: string; value: string; limit: number }) {
  const [copied, setCopied] = useState(false);
  const over = value.length > limit;

  const copy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-wf-text-muted uppercase tracking-wider">
          {label}
        </span>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-mono ${over ? "text-red-400" : "text-wf-text-muted"}`}>
            {value.length.toLocaleString()} / {limit.toLocaleString()} chars
            {over && " — EXCEDE LIMITE"}
          </span>
          <button
            onClick={copy}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              copied
                ? "bg-green-500/15 text-green-400 border border-green-500/30"
                : "bg-wf-surface border border-wf-border text-wf-text-muted hover:border-wf-primary hover:text-wf-primary"
            }`}
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
      </div>
      <div className="relative rounded-xl border border-wf-border bg-wf-surface overflow-hidden">
        <pre className="text-xs text-wf-text-muted font-mono p-4 overflow-auto max-h-52 leading-relaxed whitespace-pre-wrap break-all">
          {value.slice(0, 2000)}
          {value.length > 2000 && `\n\n… +${(value.length - 2000).toLocaleString()} chars`}
        </pre>
      </div>
    </div>
  );
}

export function WebflowExportModal({ open, onClose, code, projectId }: WebflowExportModalProps) {
  const [step, setStep] = useState<Step>("idle");
  const [result, setResult] = useState<ExportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const run = useCallback(async () => {
    if (!code) return;
    setStep("processing");
    setResult(null);
    setErrorMsg("");
    try {
      const res = await fetch("/api/export-webflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: code, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido");
      setResult(data as ExportResult);
      setStep("done");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Erro ao exportar");
      setStep("error");
    }
  }, [code, projectId]);

  useEffect(() => {
    if (open && step === "idle") run();
  }, [open, step, run]);

  useEffect(() => {
    if (!open) setStep("idle");
  }, [open]);

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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-wf-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-wf-primary/15 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-wf-primary">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-wf-text">Exportar para Webflow</h2>
              <p className="text-xs text-wf-text-muted">
                Imagens hospedadas automaticamente · Limite Webflow: 50.000 chars por bloco
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-wf-text-muted hover:text-wf-text hover:bg-wf-surface-hover transition-all cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
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
              {/* Stats */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Imagens", value: result.imagesProcessed },
                  { label: "CSS (head)", value: `${result.headChars.toLocaleString()}` },
                  { label: "HTML (embed)", value: `${result.bodyChars.toLocaleString()}` },
                  { label: "Script (footer)", value: `${result.scriptChars.toLocaleString()}` },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-wf-surface border border-wf-border p-3 text-center">
                    <p className="text-base font-semibold text-wf-text">{s.value}</p>
                    <p className="text-xs text-wf-text-muted mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Instructions */}
              <div className="rounded-xl bg-wf-primary/8 border border-wf-primary/20 px-4 py-3 text-xs text-wf-text-muted leading-relaxed space-y-1">
                <strong className="text-wf-text block mb-2">Como adicionar no Webflow — 3 passos:</strong>
                <div><span className="inline-block w-5 text-wf-primary font-bold">1.</span><strong>Page Settings → Custom Code → Inside &lt;head&gt;</strong> → cola o bloco CSS</div>
                <div><span className="inline-block w-5 text-wf-primary font-bold">2.</span>Adiciona um elemento <strong>Embed</strong> na página → cola o bloco HTML</div>
                <div><span className="inline-block w-5 text-wf-primary font-bold">3.</span><strong>Page Settings → Custom Code → Before &lt;/body&gt;</strong> → cola o bloco SCRIPT</div>
                <div className="text-wf-primary pt-1">O script separado do body garante que FAQ e animações funcionem no Webflow.</div>
              </div>

              <CopyBlock label="1 · CSS — Page Settings > Custom Code > Inside <head>" value={result.head} limit={50000} />
              <CopyBlock label="2 · HTML — cole dentro do Embed element" value={result.body} limit={50000} />
              {result.script && (
                <CopyBlock label="3 · SCRIPT — Page Settings > Custom Code > Before </body>" value={result.script} limit={50000} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
