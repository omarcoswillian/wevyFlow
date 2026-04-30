"use client";

import { useState } from "react";
import { X, Sparkles, Image, Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageGeneratorModalProps {
  onInsert: (dataUrl: string) => void;
  onClose: () => void;
}

const SIZES = [
  { id: "landscape", label: "Paisagem", desc: "1536 × 1024", ratio: "aspect-[3/2]" },
  { id: "square",    label: "Quadrado",  desc: "1024 × 1024", ratio: "aspect-square" },
  { id: "portrait",  label: "Retrato",   desc: "1024 × 1536", ratio: "aspect-[2/3]" },
] as const;

const QUALITIES = [
  { id: "high",   label: "Alta",   desc: "Melhor qualidade" },
  { id: "medium", label: "Média",  desc: "Equilibrado" },
  { id: "low",    label: "Baixa",  desc: "Mais rápido" },
] as const;

const PROMPT_SUGGESTIONS = [
  "Foto profissional de produto em fundo branco com iluminação suave",
  "Pessoa sorrindo em reunião de negócios, estilo corporativo moderno",
  "Background abstrato com gradiente azul e roxo, estilo tech",
  "Mockup de smartphone exibindo aplicativo, fundo minimalista",
  "Equipe diversa colaborando em escritório moderno, luz natural",
];

export function ImageGeneratorModal({ onInsert, onClose }: ImageGeneratorModalProps) {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState<"landscape" | "square" | "portrait">("landscape");
  const [quality, setQuality] = useState<"high" | "medium" | "low">("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function getImageConfig(): { apiKey?: string; imageProvider: string; imageModel?: string } {
    try {
      const key = localStorage.getItem("wf_img_key") || undefined;
      const provider = localStorage.getItem("wf_img_provider") || "openai";
      const model = localStorage.getItem("wf_img_model") || undefined;
      return { apiKey: key, imageProvider: provider, imageModel: model };
    } catch { /* no localStorage */ }
    return { imageProvider: "openai" };
  }

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const imgConfig = getImageConfig();
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), size, quality, ...imgConfig }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao gerar imagem.");
        return;
      }

      setPreview(`data:${data.mimeType};base64,${data.b64}`);
    } catch {
      setError("Falha na conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function handleInsert() {
    if (preview) {
      onInsert(preview);
      onClose();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-xl bg-[#111] border border-white/[0.08] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-[14px] font-semibold text-white">Gerar imagem com IA</span>
            <span className="px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-400 text-[10px] font-mono">gpt-image-2</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Prompt */}
          <div>
            <label className="text-[11px] text-white/50 mb-1.5 block">Descreva a imagem</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
              placeholder="Ex: Homem sorrindo ao computador, escritório moderno, luz natural..."
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2.5 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 resize-none h-[80px] transition-colors"
            />
            {/* Suggestions */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PROMPT_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setPrompt(s)}
                  className="px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05] text-[10px] text-white/30 hover:text-white/60 hover:border-white/10 cursor-pointer transition-all truncate max-w-[200px]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div>
            <label className="text-[11px] text-white/50 mb-1.5 block">Formato</label>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSize(s.id)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border cursor-pointer transition-all",
                    size === s.id
                      ? "border-purple-500/50 bg-purple-500/10 text-white"
                      : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70 hover:border-white/10"
                  )}
                >
                  <div className={cn("border-2 rounded-sm", size === s.id ? "border-purple-400" : "border-white/20", s.ratio, "w-6")} />
                  <span className="text-[10px] font-medium">{s.label}</span>
                  <span className="text-[9px] opacity-60">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <label className="text-[11px] text-white/50 mb-1.5 block">Qualidade</label>
            <div className="flex gap-1.5 p-0.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              {QUALITIES.map((q) => (
                <button
                  key={q.id}
                  onClick={() => setQuality(q.id)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-[11px] font-medium cursor-pointer transition-all",
                    quality === q.id ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"
                  )}
                >
                  {q.label}
                  <span className="block text-[9px] opacity-60 font-normal">{q.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-red-300">{error}</p>
            </div>
          )}

          {/* Preview */}
          {(loading || preview) && (
            <div className={cn("relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02]", size === "landscape" ? "aspect-[3/2]" : size === "portrait" ? "aspect-[2/3]" : "aspect-square")}>
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                  <p className="text-[11px] text-white/40">Gerando com gpt-image-2...</p>
                </div>
              )}
              {preview && !loading && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview gerado" className="w-full h-full object-cover" />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.06] flex gap-2.5 shrink-0">
          {preview && !loading ? (
            <>
              <button
                onClick={handleGenerate}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-[12px] text-white/60 hover:text-white hover:border-white/15 cursor-pointer transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Gerar outra
              </button>
              <button
                onClick={handleInsert}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-[12px] font-semibold text-white cursor-pointer transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Usar imagem
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-[12px] text-white/50 hover:text-white cursor-pointer transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || loading}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold cursor-pointer transition-all",
                  prompt.trim() && !loading
                    ? "bg-purple-600 hover:bg-purple-500 text-white"
                    : "bg-white/[0.04] text-white/20 cursor-not-allowed"
                )}
              >
                {loading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</>
                ) : (
                  <><Image className="w-3.5 h-3.5" /> Gerar imagem</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
