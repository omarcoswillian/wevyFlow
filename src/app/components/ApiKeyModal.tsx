"use client";

import { useState, useEffect, useRef } from "react";
import { X, Key, ExternalLink, CheckCircle, AlertCircle, Eye, EyeOff, ChevronDown } from "lucide-react";
import {
  AIProvider,
  PROVIDER_META,
  MODEL_OPTIONS,
  DEFAULT_MODELS,
  detectProvider,
} from "../lib/ai-provider";

interface ApiKeyModalProps {
  open: boolean;
  currentKey: string;
  currentProvider: AIProvider;
  currentModel: string;
  onSave: (key: string, provider: AIProvider, model: string) => void;
  onClear: () => void;
  onClose: () => void;
}

const PROVIDERS: AIProvider[] = ["anthropic", "openai", "openrouter"];

export function ApiKeyModal({
  open, currentKey, currentProvider, currentModel,
  onSave, onClear, onClose,
}: ApiKeyModalProps) {
  const [provider, setProvider] = useState<AIProvider>(currentProvider);
  const [key, setKey] = useState("");
  const [model, setModel] = useState(currentModel);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "validating" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const MASK = "••••••••••••••••••••••••••";

  useEffect(() => {
    if (open) {
      setProvider(currentProvider);
      setKey(currentKey ? MASK : "");
      setModel(currentModel || DEFAULT_MODELS[currentProvider]);
      setStatus(currentKey ? "ok" : "idle");
      setErrorMsg("");
      setShow(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, currentKey, currentProvider, currentModel]);

  if (!open) return null;

  const meta = PROVIDER_META[provider];
  const isEditing = key !== MASK;
  const hasKey = !!currentKey;

  function handleProviderChange(p: AIProvider) {
    setProvider(p);
    setKey("");
    setModel(DEFAULT_MODELS[p]);
    setStatus("idle");
    setErrorMsg("");
  }

  function handleKeyChange(v: string) {
    setKey(v);
    setStatus("idle");
    setErrorMsg("");
    // Auto-detect provider from key prefix
    if (v.length > 8) {
      const detected = detectProvider(v);
      if (detected !== provider) setProvider(detected);
    }
  }

  async function handleSave() {
    const trimmed = key.trim();
    if (!trimmed || trimmed === MASK) { onClose(); return; }
    if (trimmed.length < 20) {
      setStatus("error");
      setErrorMsg("Chave muito curta. Verifique se copiou corretamente.");
      return;
    }
    setStatus("validating");
    setErrorMsg("");
    try {
      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: trimmed, provider, model }),
      });
      if (res.ok) {
        setStatus("ok");
        onSave(trimmed, provider, model);
        setTimeout(onClose, 500);
      } else {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setErrorMsg(data.error || "Chave inválida ou sem créditos.");
      }
    } catch {
      setStatus("error");
      setErrorMsg("Erro de conexão. Verifique sua internet.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-[440px] bg-[#111114] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <Key className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-white">Conectar sua IA</p>
              <p className="text-[10px] text-white/30">Use qualquer provedor com sua API Key</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Provider tabs */}
          <div>
            <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-2">Provedor</p>
            <div className="grid grid-cols-3 gap-1.5">
              {PROVIDERS.map((p) => {
                const m = PROVIDER_META[p];
                const active = provider === p;
                return (
                  <button
                    key={p}
                    onClick={() => handleProviderChange(p)}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      active
                        ? "border-purple-500/40 bg-purple-500/10 text-white"
                        : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/60 hover:bg-white/[0.04]"
                    }`}
                  >
                    <span className="text-[12px] font-semibold">{m.label}</span>
                    <span className="text-[9px] leading-tight text-white/30">{m.description}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Connected status */}
          {hasKey && !isEditing && currentProvider === provider && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-emerald-400">Conectado · {PROVIDER_META[currentProvider].label}</p>
                <p className="text-[10px] text-white/30 font-mono truncate">{currentKey.slice(0, 16)}…{currentKey.slice(-4)}</p>
              </div>
            </div>
          )}

          {/* API Key input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-white/30 uppercase tracking-wider">API Key</label>
              <a
                href={meta.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 transition-colors"
              >
                Obter key <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <div className="relative">
              <input
                ref={inputRef}
                type={show ? "text" : "password"}
                value={key}
                onChange={(e) => handleKeyChange(e.target.value)}
                onFocus={() => { if (key === MASK) { setKey(""); setStatus("idle"); } }}
                placeholder={meta.keyPlaceholder}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 pr-10 text-[12px] text-white placeholder:text-white/15 focus:outline-none focus:border-purple-500/40 transition-all font-mono"
              />
              <button
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors cursor-pointer"
              >
                {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {status === "error" && (
              <div className="flex items-start gap-1.5 text-red-400">
                <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                <p className="text-[11px]">{errorMsg}</p>
              </div>
            )}
          </div>

          {/* Model selector */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Modelo</label>
            {provider === "openrouter" ? (
              <div className="space-y-1">
                <div className="relative">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 pr-8 text-[12px] text-white focus:outline-none focus:border-purple-500/40 transition-all appearance-none cursor-pointer"
                  >
                    {MODEL_OPTIONS.openrouter.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#111114]">{m.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
                </div>
                <p className="text-[9px] text-white/20">Ou acesse openrouter.ai/models para ver todos</p>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3.5 py-2.5 pr-8 text-[12px] text-white focus:outline-none focus:border-purple-500/40 transition-all appearance-none cursor-pointer"
                >
                  {MODEL_OPTIONS[provider].map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#111114]">{m.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Privacy note */}
          <p className="text-[10px] text-white/20 leading-relaxed">
            Sua key é enviada diretamente ao provedor e nunca armazenada nos nossos servidores.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-white/[0.06] bg-white/[0.02]">
          {hasKey && (
            <button onClick={onClear} className="px-3.5 py-2 rounded-xl text-[12px] font-medium text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer">
              Desconectar
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-3.5 py-2 rounded-xl text-[12px] text-white/40 hover:text-white/60 transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={status === "validating"}
            className="px-4 py-2 rounded-xl text-[12px] font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            {status === "validating" ? "Validando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
