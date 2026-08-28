"use client";

import { useState, useCallback, useEffect } from "react";

interface WebflowExportModalProps {
  open: boolean;
  onClose: () => void;
  code: string;
  projectId?: string;
}

type Step = "config" | "sites" | "idle" | "processing" | "done" | "error";

interface ExportResult {
  head: string;
  bodyBlocks: string[];
  script: string;
  imagesProcessed: number;
  usedWebflowAssets: boolean;
  headChars: number;
  bodyChars: number;
  scriptChars: number;
}

interface WebflowSite {
  id: string;
  displayName: string;
}

const TOKEN_KEY = "wf_webflow_token";
const SITE_ID_KEY = "wf_webflow_site_id";

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
  const [step, setStep] = useState<Step>("config");
  const [result, setResult] = useState<ExportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [leadToken, setLeadToken] = useState<string | null>(null);

  // Webflow account config — kept only in this browser (localStorage), never
  // sent to our database. Used per-request so exported images land on the
  // user's own Webflow Assets instead of WevyFlow's storage.
  const [tokenInput, setTokenInput] = useState("");
  const [webflowToken, setWebflowToken] = useState<string | null>(null);
  const [webflowSiteId, setWebflowSiteId] = useState<string | null>(null);
  const [sites, setSites] = useState<WebflowSite[]>([]);
  const [configError, setConfigError] = useState("");
  const [skippedAssets, setSkippedAssets] = useState(false);

  const run = useCallback(async (opts?: { token?: string | null; siteId?: string | null }) => {
    if (!code) return;
    const activeToken = opts?.token !== undefined ? opts.token : webflowToken;
    const activeSiteId = opts?.siteId !== undefined ? opts.siteId : webflowSiteId;
    setStep("processing");
    setResult(null);
    setErrorMsg("");
    try {
      // Get-or-create the token that routes leads from this exported page
      // back to the dashboard, regardless of where it ends up hosted.
      let token = leadToken;
      if (!token) {
        const sourceRes = await fetch("/api/pages/lead-source", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Export Webflow", platform: "webflow" }),
        });
        if (sourceRes.ok) {
          token = ((await sourceRes.json()) as { token: string }).token;
          setLeadToken(token);
        }
      }

      const res = await fetch("/api/export-webflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: code,
          projectId,
          leadToken: token,
          webflowToken: activeToken || undefined,
          webflowSiteId: activeSiteId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido");
      setResult(data as ExportResult);
      setStep("done");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Erro ao exportar");
      setStep("error");
    }
  }, [code, projectId, leadToken, webflowToken, webflowSiteId]);

  // On open: reuse a saved Webflow token/site if there is one, otherwise ask.
  useEffect(() => {
    if (!open) return;
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedSiteId = localStorage.getItem(SITE_ID_KEY);
    if (savedToken && savedSiteId) {
      setWebflowToken(savedToken);
      setWebflowSiteId(savedSiteId);
      setStep("idle");
    } else {
      setStep("config");
    }
  }, [open]);

  useEffect(() => {
    if (open && step === "idle") run();
  }, [open, step, run]);

  useEffect(() => {
    if (!open) {
      setStep("config");
      setConfigError("");
      setTokenInput("");
      setSites([]);
    }
  }, [open]);

  const handleConnectWebflow = useCallback(async () => {
    if (!tokenInput.trim()) return;
    setConfigError("");
    setStep("sites");
    try {
      const res = await fetch("/api/webflow/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Não foi possível validar o token");
      const list = (data.sites ?? []) as WebflowSite[];
      if (list.length === 0) throw new Error("Nenhum site encontrado para esse token");
      if (list.length === 1) {
        const site = list[0];
        localStorage.setItem(TOKEN_KEY, tokenInput.trim());
        localStorage.setItem(SITE_ID_KEY, site.id);
        setWebflowToken(tokenInput.trim());
        setWebflowSiteId(site.id);
        setStep("idle");
      } else {
        setSites(list);
      }
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Erro ao conectar com o Webflow");
      setStep("config");
    }
  }, [tokenInput]);

  const handlePickSite = useCallback((site: WebflowSite) => {
    localStorage.setItem(TOKEN_KEY, tokenInput.trim());
    localStorage.setItem(SITE_ID_KEY, site.id);
    setWebflowToken(tokenInput.trim());
    setWebflowSiteId(site.id);
    setStep("idle");
  }, [tokenInput]);

  const handleSkipAssets = useCallback(() => {
    setSkippedAssets(true);
    setWebflowToken(null);
    setWebflowSiteId(null);
    run({ token: null, siteId: null });
  }, [run]);

  const handleForgetWebflow = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(SITE_ID_KEY);
    setWebflowToken(null);
    setWebflowSiteId(null);
    setSkippedAssets(false);
    setStep("config");
  }, []);

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
                {webflowToken ? "Imagens vão direto pros seus Assets do Webflow" : "Limite Webflow: 50.000 chars por bloco"}
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
          {step === "config" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-wf-primary/8 border border-wf-primary/20 px-4 py-3 text-xs text-wf-text-muted leading-relaxed space-y-1">
                <strong className="text-wf-text block mb-1">Por que conectar sua conta Webflow?</strong>
                Assim as imagens da página são enviadas direto para os <strong>Assets do seu próprio site</strong> —
                a WevyFlow não guarda nem hospeda nada. Gere o token em <strong>Site Settings → Apps &amp; Integrations → API access</strong>{" "}
                no painel do seu site no Webflow.
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-wf-text-muted uppercase tracking-wider">Token do site Webflow</label>
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Cole o token aqui"
                  className="px-3 py-2 rounded-lg bg-wf-surface border border-wf-border text-sm text-wf-text placeholder:text-wf-text-muted focus:outline-none focus:border-wf-primary"
                />
                {configError && <p className="text-xs text-red-400">{configError}</p>}
              </div>

              <button
                onClick={handleConnectWebflow}
                disabled={!tokenInput.trim()}
                className="px-4 py-2.5 rounded-lg bg-wf-primary text-white text-sm font-semibold hover:bg-wf-primary-hover transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Conectar e continuar
              </button>

              <button
                onClick={handleSkipAssets}
                className="text-xs text-wf-text-muted hover:text-wf-text underline underline-offset-2 cursor-pointer text-center"
              >
                Pular por enquanto — imagens ficam temporárias no storage da WevyFlow
              </button>
            </div>
          )}

          {step === "sites" && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              {sites.length === 0 ? (
                <>
                  <div className="w-8 h-8 rounded-full border-2 border-wf-primary border-t-transparent animate-spin" />
                  <p className="text-sm text-wf-text-muted">Validando token e buscando seus sites…</p>
                </>
              ) : (
                <div className="w-full flex flex-col gap-2">
                  <p className="text-sm text-wf-text mb-1">Qual site é este projeto?</p>
                  {sites.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handlePickSite(s)}
                      className="px-4 py-2.5 rounded-lg border border-wf-border bg-wf-surface hover:border-wf-primary text-sm text-wf-text text-left transition-all cursor-pointer"
                    >
                      {s.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-10 h-10 rounded-full border-2 border-wf-primary border-t-transparent animate-spin" />
              <p className="text-sm text-wf-text-muted">
                {webflowToken ? "Enviando imagens pro seu Webflow e preparando o código…" : "Processando imagens e preparando o código…"}
              </p>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <p className="text-sm font-medium text-red-400">Erro ao exportar</p>
              <p className="text-xs text-wf-text-muted">{errorMsg}</p>
              <button
                onClick={() => run()}
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

              {result.usedWebflowAssets ? (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 text-xs text-emerald-300 leading-relaxed flex items-center justify-between gap-3">
                  <span>Imagens enviadas para os Assets do seu próprio site no Webflow — nenhuma depende da WevyFlow.</span>
                  <button onClick={handleForgetWebflow} className="shrink-0 underline underline-offset-2 hover:text-emerald-200 cursor-pointer">
                    trocar conta
                  </button>
                </div>
              ) : (
                skippedAssets && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-3 text-xs text-amber-300 leading-relaxed flex items-center justify-between gap-3">
                    <span>Imagens hospedadas temporariamente no storage da WevyFlow — conecte sua conta Webflow pra torná-las independentes.</span>
                    <button onClick={handleForgetWebflow} className="shrink-0 underline underline-offset-2 hover:text-amber-200 cursor-pointer">
                      conectar
                    </button>
                  </div>
                )
              )}

              {/* Instructions */}
              <div className="rounded-xl bg-wf-primary/8 border border-wf-primary/20 px-4 py-3 text-xs text-wf-text-muted leading-relaxed space-y-1">
                <strong className="text-wf-text block mb-2">Como adicionar no Webflow — 3 passos:</strong>
                <div><span className="inline-block w-5 text-wf-primary font-bold">1.</span><strong>Page Settings → Custom Code → Inside &lt;head&gt;</strong> → cola o bloco CSS</div>
                <div>
                  <span className="inline-block w-5 text-wf-primary font-bold">2.</span>
                  {result.bodyBlocks.length > 1
                    ? <>Adiciona <strong>{result.bodyBlocks.length} elementos Embed</strong> na página, um logo abaixo do outro na mesma ordem → cola um bloco HTML em cada</>
                    : <>Adiciona um elemento <strong>Embed</strong> na página → cola o bloco HTML</>}
                </div>
                <div><span className="inline-block w-5 text-wf-primary font-bold">3.</span><strong>Page Settings → Custom Code → Before &lt;/body&gt;</strong> → cola o bloco SCRIPT</div>
                <div className="text-wf-primary pt-1">O script separado do body garante que FAQ e animações funcionem no Webflow.</div>
                <div className="text-wf-primary">O bloco SCRIPT já inclui a captura de lead — os formulários enviam direto para o seu painel de Leads, mesmo hospedados no Webflow.</div>
                {result.bodyBlocks.length > 1 && (
                  <div className="text-wf-primary">A página passou de 50.000 chars, então o HTML foi dividido em {result.bodyBlocks.length} blocos — cada um vira um Embed separado, colados em sequência.</div>
                )}
              </div>

              <CopyBlock label="1 · CSS — Page Settings > Custom Code > Inside <head>" value={result.head} limit={50000} />
              {result.bodyBlocks.map((block, i) => (
                <CopyBlock
                  key={i}
                  label={
                    result.bodyBlocks.length > 1
                      ? `2${String.fromCharCode(97 + i)} · HTML — Embed element #${i + 1} de ${result.bodyBlocks.length}`
                      : "2 · HTML — cole dentro do Embed element"
                  }
                  value={block}
                  limit={50000}
                />
              ))}
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
