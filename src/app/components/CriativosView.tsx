"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles, Download, Trash2, Loader2, AlertCircle, Check, RefreshCw,
  ImageIcon, Bot, User, Send, ImagePlus, X, MessageSquare, FileText,
} from "lucide-react";
import type { CriativoFormat } from "../api/generate-criativo/route";

interface SavedCriativo {
  id: string;
  format: string;
  url: string;
  headline: string | null;
  produto: string | null;
  created_at: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: string[];
}

const FORMATS: {
  id: CriativoFormat;
  label: string;
  platform: string;
  size: string;
  w: number;
  h: number;
}[] = [
  { id: "youtube-thumbnail", label: "Thumbnail",    platform: "YouTube",        size: "1280 × 720",  w: 16, h: 9  },
  { id: "whatsapp",          label: "Criativo",      platform: "WhatsApp",       size: "1080 × 1080", w: 1,  h: 1  },
  { id: "banner-horizontal", label: "Banner",        platform: "Meta / Google",  size: "1200 × 628",  w: 1.91, h: 1},
  { id: "feed-retrato",      label: "Feed Retrato",  platform: "Instagram",      size: "1080 × 1350", w: 4,  h: 5  },
  { id: "feed-quadrado",     label: "Feed Quadrado", platform: "Instagram / FB", size: "1080 × 1080", w: 1,  h: 1  },
];

const FASES = [
  { id: "aquecimento",  label: "Aquecimento"  },
  { id: "lancamento",   label: "Lançamento"   },
  { id: "urgencia",     label: "Urgência"     },
  { id: "encerramento", label: "Encerramento" },
];

const ESTILOS = [
  { id: "bold",         label: "Bold"        },
  { id: "minimal",      label: "Minimal"     },
  { id: "professional", label: "Profissional"},
  { id: "colorful",     label: "Colorido"    },
];

function getOpenAIKey(): string | undefined {
  try {
    const key = localStorage.getItem("wevyflow_byok_key");
    const provider = localStorage.getItem("wevyflow_byok_provider");
    if (key && provider === "openai") return key;
  } catch { /* no localStorage */ }
  return undefined;
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/png" });
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

async function downloadFromUrl(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const obj = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = obj;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(obj);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function CriativosView() {
  const [selectedFormat, setSelectedFormat] = useState<CriativoFormat>("youtube-thumbnail");
  const [produto, setProduto] = useState("");
  const [headline, setHeadline] = useState("");
  const [cta, setCta] = useState("");
  const [cor, setCor] = useState("#6c47ff");
  const [estilo, setEstilo] = useState("bold");
  const [fase, setFase] = useState("lancamento");
  const [quality, setQuality] = useState<"high" | "medium" | "low">("high");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ dataUrl: string; prompt: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [gallery, setGallery] = useState<SavedCriativo[]>([]);
  const [activeGalleryFormat, setActiveGalleryFormat] = useState("all");

  // Brief / Chat tabs
  const [briefTab, setBriefTab] = useState<"brief" | "chat">("brief");
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Descreva o criativo que deseja gerar, ou preencha o Brief ao lado e volte aqui para refinar." },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatImages, setChatImages] = useState<string[]>([]);

  const colorInputRef = useRef<HTMLInputElement>(null);
  const referenceFileRef = useRef<HTMLInputElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const supabase = createClient();

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, loading]);

  const loadGallery = useCallback(async () => {
    const { data } = await supabase
      .from("criativos")
      .select("id, format, url, headline, produto, created_at")
      .order("created_at", { ascending: false });
    if (data) setGallery(data as SavedCriativo[]);
  }, [supabase]);

  useEffect(() => { loadGallery(); }, [loadGallery]);

  const fmt = FORMATS.find((f) => f.id === selectedFormat)!;
  const canGenerate = (headline.trim() || produto.trim()) && !loading;

  async function callGenerate(opts: {
    chatInstruction?: string;
    referenceBase64?: string | null;
  }) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-criativo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: selectedFormat,
          produto,
          headline,
          cta,
          cor,
          estilo,
          fase,
          quality,
          apiKey: getOpenAIKey(),
          referenceBase64: opts.referenceBase64 ?? null,
          chatInstruction: opts.chatInstruction ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar.");
      setPreview({ dataUrl: `data:${data.mimeType};base64,${data.b64}`, prompt: data.prompt });
      return true;
    } catch (e: unknown) {
      const msg = String((e as Error)?.message ?? "Falha na conexão.");
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!canGenerate) return;
    setPreview(null);
    await callGenerate({ referenceBase64: referenceImage });
  }

  async function handleChatSend() {
    const text = chatInput.trim();
    const imgs = [...chatImages];
    if (!text && imgs.length === 0) return;
    if (loading) return;

    const content = text || "Analise a referência e gere o criativo";
    setChatMessages((prev) => [...prev, { role: "user", content, images: imgs.length > 0 ? imgs : undefined }]);
    setChatInput("");
    setChatImages([]);

    const refBase64 = imgs[0] ?? (preview ? preview.dataUrl : null);

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-criativo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: selectedFormat,
          produto,
          headline,
          cta,
          cor,
          estilo,
          fase,
          quality,
          apiKey: getOpenAIKey(),
          chatInstruction: content,
          referenceBase64: refBase64,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error ?? "Erro ao gerar.";
        setChatMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
        return;
      }
      setPreview({ dataUrl: `data:${data.mimeType};base64,${data.b64}`, prompt: data.prompt });
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: preview ? "Criativo refinado! Veja no preview. O que mais quer ajustar?" : "Criativo gerado! Veja no preview ao lado. O que mais quer ajustar?" },
      ]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Falha na conexão. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleReferenceUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReferenceImage(await readFileAsDataUrl(file));
    if (referenceFileRef.current) referenceFileRef.current.value = "";
  }

  async function handleChatImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 4_000_000) continue;
      const dataUrl = await readFileAsDataUrl(file);
      setChatImages((prev) => prev.length >= 3 ? prev : [...prev, dataUrl]);
    }
    if (chatFileRef.current) chatFileRef.current.value = "";
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();
      const filename = `criativo-${selectedFormat}-${Date.now()}.png`;
      const file = await dataUrlToFile(preview.dataUrl, filename);
      const path = `${user.id}/${filename}`;
      const { error: uploadError } = await supabase.storage.from("ai-images").upload(path, file, { upsert: false, contentType: "image/png" });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("ai-images").getPublicUrl(path);
      await supabase.from("criativos").insert({ user_id: user.id, format: selectedFormat, url: publicUrl, headline: headline || null, produto: produto || null, prompt: preview.prompt });
      await loadGallery();
      setPreview(null);
    } catch { /* silent */ } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: SavedCriativo) {
    await supabase.from("criativos").delete().eq("id", c.id);
    try {
      const storagePath = new URL(c.url).pathname.split("/ai-images/")[1];
      if (storagePath) await supabase.storage.from("ai-images").remove([storagePath]);
    } catch { /* ok */ }
    setGallery((prev) => prev.filter((x) => x.id !== c.id));
  }

  const filteredGallery = activeGalleryFormat === "all" ? gallery : gallery.filter((c) => c.format === activeGalleryFormat);

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      {/* Header */}
      <div className="px-8 pt-8 pb-5 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-[26px] font-bold text-white tracking-tight">Creatives</h1>
          <span className="px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.04] text-[10px] text-white/35 font-mono">gpt-image-2</span>
        </div>
        <p className="text-[13px] text-white/30">Criativos profissionais para cada fase do seu lançamento.</p>
      </div>

      {/* 3-column body */}
      <div className="flex-1 flex overflow-hidden px-8 pb-8 gap-5 min-h-0">

        {/* ── Col 1: Format list ─────────────────────────── */}
        <div className="w-[196px] shrink-0 flex flex-col gap-1 overflow-y-auto">
          <p className="text-[10px] font-semibold text-white/25 tracking-widest uppercase px-3 mb-1">Formato</p>
          {FORMATS.map((f) => {
            const active = selectedFormat === f.id;
            return (
              <button
                key={f.id}
                onClick={() => { setSelectedFormat(f.id); setPreview(null); setError(null); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-left",
                  active
                    ? "bg-purple-600/15 border-purple-500/40 text-white"
                    : "border-transparent text-white/40 hover:bg-white/[0.04] hover:text-white/70"
                )}
              >
                <div className="shrink-0 flex items-center justify-center w-8 h-8">
                  <div
                    className={cn("rounded border", active ? "border-purple-500/60 bg-purple-500/20" : "border-white/15 bg-white/[0.04]")}
                    style={{
                      aspectRatio: String(f.w / f.h),
                      height: f.h >= f.w ? 22 : undefined,
                      width: f.w > f.h ? 26 : undefined,
                      maxWidth: 28, maxHeight: 24,
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[12px] font-semibold leading-tight truncate", active ? "text-white" : "")}>{f.platform}</p>
                  <p className={cn("text-[10px] leading-tight mt-0.5 font-mono", active ? "text-purple-400" : "text-white/25")}>{f.size}</p>
                </div>
                {active && <div className="w-1 h-1 rounded-full bg-purple-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* ── Col 2: Brief / Chat ────────────────────────── */}
        <div className="w-[320px] shrink-0 flex flex-col overflow-hidden">
          <div className="flex-1 bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col">

            {/* Tab toggle */}
            <div className="px-4 py-2.5 border-b border-white/[0.06] shrink-0 flex items-center gap-1">
              <button
                onClick={() => setBriefTab("brief")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                  briefTab === "brief" ? "bg-purple-600/20 text-purple-300" : "text-white/30 hover:text-white/60"
                )}
              >
                <FileText className="w-3 h-3" /> Brief
              </button>
              <button
                onClick={() => setBriefTab("chat")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                  briefTab === "chat" ? "bg-purple-600/20 text-purple-300" : "text-white/30 hover:text-white/60"
                )}
              >
                <MessageSquare className="w-3 h-3" /> Chat
              </button>
            </div>

            {/* ── Brief tab ─────────────────────────────── */}
            {briefTab === "brief" && (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                  {/* Reference image upload */}
                  <div>
                    <label className="text-[10px] text-white/30 tracking-wider uppercase mb-1.5 block">
                      Referência <span className="normal-case text-white/15">— opcional, orienta o gpt-image-2</span>
                    </label>
                    {referenceImage ? (
                      <div className="relative rounded-xl overflow-hidden border border-white/[0.07]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={referenceImage} alt="Referência" className="w-full object-cover" style={{ maxHeight: 110 }} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 hover:opacity-100 transition-opacity flex items-end justify-between p-2">
                          <span className="text-[10px] text-white/60 font-mono">referência</span>
                          <button
                            onClick={() => setReferenceImage(null)}
                            className="w-6 h-6 rounded-lg bg-red-500/30 flex items-center justify-center text-red-300 hover:bg-red-500/50 transition-colors cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => referenceFileRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/[0.08] text-[11px] text-white/25 hover:text-white/50 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all cursor-pointer"
                      >
                        <ImagePlus className="w-3.5 h-3.5" /> Adicionar imagem de referência
                      </button>
                    )}
                    <input ref={referenceFileRef} type="file" accept="image/*" onChange={handleReferenceUpload} className="hidden" />
                  </div>

                  <div className="h-px bg-white/[0.05]" />

                  {/* Produto */}
                  <div>
                    <label className="text-[10px] text-white/30 tracking-wider uppercase mb-1.5 block">Produto / Oferta <span className="text-purple-500 normal-case">*</span></label>
                    <input
                      value={produto}
                      onChange={(e) => setProduto(e.target.value)}
                      placeholder="Curso de Marketing Digital"
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-white/15 focus:outline-none focus:border-purple-500/50 focus:bg-purple-500/5 transition-all"
                    />
                  </div>

                  {/* Headline */}
                  <div>
                    <label className="text-[10px] text-white/30 tracking-wider uppercase mb-1.5 block">Headline <span className="text-purple-500 normal-case">*</span> <span className="normal-case text-white/15">— texto da imagem</span></label>
                    <textarea
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="Aprenda a dobrar seu faturamento em 30 dias"
                      rows={3}
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-white/15 focus:outline-none focus:border-purple-500/50 focus:bg-purple-500/5 transition-all resize-none"
                    />
                  </div>

                  {/* CTA */}
                  <div>
                    <label className="text-[10px] text-white/30 tracking-wider uppercase mb-1.5 block">CTA <span className="normal-case text-white/15">— opcional</span></label>
                    <input
                      value={cta}
                      onChange={(e) => setCta(e.target.value)}
                      placeholder="Garanta sua vaga agora"
                      className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 text-[12px] text-white placeholder:text-white/15 focus:outline-none focus:border-purple-500/50 focus:bg-purple-500/5 transition-all"
                    />
                  </div>

                  <div className="h-px bg-white/[0.05]" />

                  {/* Cor + Qualidade */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-white/30 tracking-wider uppercase mb-1.5 block">Cor</label>
                      <div
                        className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-2 cursor-pointer hover:border-white/15 transition-colors"
                        onClick={() => colorInputRef.current?.click()}
                      >
                        <div className="w-4 h-4 rounded-md shrink-0 ring-1 ring-white/10" style={{ backgroundColor: cor }} />
                        <span className="text-[10px] text-white/40 font-mono">{cor.toUpperCase()}</span>
                        <input ref={colorInputRef} type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="hidden" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-white/30 tracking-wider uppercase mb-1.5 block">Qualidade</label>
                      <div className="flex gap-1 p-0.5 bg-white/[0.03] border border-white/[0.07] rounded-xl">
                        {(["high", "medium", "low"] as const).map((q) => (
                          <button key={q} onClick={() => setQuality(q)}
                            className={cn("flex-1 py-1.5 rounded-lg text-[9px] font-semibold cursor-pointer transition-all",
                              quality === q ? "bg-purple-600 text-white" : "text-white/25 hover:text-white/60")}>
                            {q === "high" ? "Alta" : q === "medium" ? "Med" : "Low"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Estilo */}
                  <div>
                    <label className="text-[10px] text-white/30 tracking-wider uppercase mb-2 block">Estilo</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ESTILOS.map((e) => (
                        <button key={e.id} onClick={() => setEstilo(e.id)}
                          className={cn("py-2 rounded-xl text-[11px] font-medium cursor-pointer transition-all border",
                            estilo === e.id ? "bg-purple-600/20 border-purple-500/40 text-purple-300" : "border-white/[0.07] text-white/30 hover:text-white/60 hover:border-white/15")}>
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fase */}
                  <div>
                    <label className="text-[10px] text-white/30 tracking-wider uppercase mb-2 block">Fase</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {FASES.map((f) => (
                        <button key={f.id} onClick={() => setFase(f.id)}
                          className={cn("py-2 rounded-xl text-[11px] font-medium cursor-pointer transition-all border",
                            fase === f.id ? "bg-purple-600/20 border-purple-500/40 text-purple-300" : "border-white/[0.07] text-white/30 hover:text-white/60 hover:border-white/15")}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-px" />
                      <p className="text-[11px] text-red-300 leading-snug">{error}</p>
                    </div>
                  )}
                </div>

                {/* Generate button */}
                <div className="px-5 py-4 border-t border-white/[0.06] shrink-0">
                  <button
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all",
                      canGenerate
                        ? "bg-purple-600 hover:bg-purple-500 text-white cursor-pointer active:scale-[0.99]"
                        : "bg-white/[0.04] text-white/15 cursor-not-allowed"
                    )}
                  >
                    {loading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                      : referenceImage
                        ? <><ImagePlus className="w-4 h-4" /> Gerar com referência</>
                        : <><Sparkles className="w-4 h-4" /> Gerar para {fmt.platform}</>
                    }
                  </button>
                </div>
              </>
            )}

            {/* ── Chat tab ──────────────────────────────── */}
            {briefTab === "chat" && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className="flex gap-2.5">
                      <div className={cn(
                        "w-6 h-6 rounded-lg shrink-0 flex items-center justify-center mt-0.5",
                        msg.role === "user" ? "bg-white/[0.06]" : "bg-purple-500/15"
                      )}>
                        {msg.role === "user"
                          ? <User className="w-3 h-3 text-white/40" />
                          : <Bot className="w-3 h-3 text-purple-400" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-white/25 mb-1">{msg.role === "user" ? "Você" : "WevyFlow"}</p>
                        {msg.images && msg.images.length > 0 && (
                          <div className="flex gap-1.5 mb-2 flex-wrap">
                            {msg.images.map((img, j) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={j} src={img} alt="ref" className="w-20 h-20 rounded-xl object-cover border border-white/[0.1]" />
                            ))}
                          </div>
                        )}
                        <p className="text-[12px] text-white/60 leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="flex gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-purple-500/15 shrink-0 flex items-center justify-center mt-0.5">
                        <Bot className="w-3 h-3 text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] text-white/25 mb-1">WevyFlow</p>
                        <div className="flex items-center gap-2 text-[12px] text-purple-400">
                          <Loader2 className="w-3 h-3 animate-spin" /> Gerando criativo...
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat input */}
                <div className="px-3 pb-3 pt-2 space-y-2 border-t border-white/[0.06] shrink-0">
                  {chatImages.length > 0 && (
                    <div className="flex gap-1.5 px-1 pt-1 flex-wrap">
                      {chatImages.map((img, i) => (
                        <div key={i} className="relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img} alt="ref" className="w-12 h-12 rounded-lg object-cover border border-white/[0.1]" />
                          <button
                            onClick={() => setChatImages((prev) => prev.filter((_, idx) => idx !== i))}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-2.5 py-2 focus-within:border-purple-500/30 transition-colors">
                    <button
                      onClick={() => chatFileRef.current?.click()}
                      disabled={loading || chatImages.length >= 3}
                      className={cn(
                        "p-1.5 rounded-lg transition-all cursor-pointer shrink-0",
                        chatImages.length >= 3 ? "text-white/10 cursor-not-allowed" : "text-white/25 hover:text-purple-400 hover:bg-white/[0.05]"
                      )}
                      title="Enviar referência"
                    >
                      <ImagePlus className="w-4 h-4" />
                    </button>
                    <input ref={chatFileRef} type="file" accept="image/*" multiple onChange={handleChatImageUpload} className="hidden" />

                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                      placeholder={preview ? "O que quer ajustar?" : "Descreva o criativo..."}
                      className="flex-1 bg-transparent text-[12px] text-white placeholder:text-white/20 focus:outline-none"
                      disabled={loading}
                    />
                    <button
                      onClick={handleChatSend}
                      disabled={loading || (!chatInput.trim() && chatImages.length === 0)}
                      className={cn(
                        "p-1.5 rounded-lg transition-all cursor-pointer shrink-0",
                        (chatInput.trim() || chatImages.length > 0) && !loading
                          ? "bg-purple-500 text-white hover:bg-purple-400"
                          : "text-white/15"
                      )}
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[9px] text-white/15 text-center">Envie prints e referências — a IA analisa visualmente</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Col 3: Preview ─────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Canvas */}
          <div className="flex-1 rounded-2xl border border-white/[0.07] bg-[#0d0d10] flex items-center justify-center overflow-hidden relative min-h-0">
            <div
              className="relative"
              style={{
                aspectRatio: String(fmt.w / fmt.h),
                maxWidth: "100%",
                maxHeight: "100%",
                width: fmt.w >= fmt.h ? "90%" : undefined,
                height: fmt.w < fmt.h ? "90%" : undefined,
              }}
            >
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/[0.02] rounded-xl border border-white/[0.06]">
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-0 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-purple-400/60" />
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[13px] text-white/50 font-medium">Gerando com gpt-image-2</p>
                    <p className="text-[11px] text-white/20 font-mono">{fmt.platform} · {fmt.size}</p>
                  </div>
                </div>
              )}

              {!loading && !preview && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/[0.08]">
                  <ImageIcon className="w-8 h-8 text-white/10" />
                  <div className="text-center">
                    <p className="text-[13px] text-white/20">Preview aparece aqui</p>
                    <p className="text-[11px] text-white/10 mt-0.5 font-mono">{fmt.platform} · {fmt.size}</p>
                  </div>
                </div>
              )}

              {preview && !loading && (
                <div className="absolute inset-0 rounded-xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview.dataUrl} alt="Criativo" className="w-full h-full object-contain" />
                  <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-[10px] text-white/60 font-mono">
                    {fmt.platform} · {fmt.size}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action bar */}
          {preview && !loading && (
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => { setPreview(null); callGenerate({ referenceBase64: referenceImage }); }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.08] text-[12px] text-white/50 hover:text-white hover:border-white/20 cursor-pointer transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Outra versão
              </button>
              <button
                onClick={() => downloadDataUrl(preview.dataUrl, `criativo-${selectedFormat}.png`)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/[0.08] text-[12px] text-white/50 hover:text-white hover:border-white/20 cursor-pointer transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Baixar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-[12px] font-bold text-white cursor-pointer transition-all disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Salvar na galeria
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Gallery ─────────────────────────────────────── */}
      {gallery.length > 0 && (
        <div className="px-8 pb-10 space-y-5">
          <div className="flex items-center gap-4">
            <h2 className="text-[15px] font-bold text-white">Galeria</h2>
            <span className="text-[11px] text-white/20 font-mono">{gallery.length}</span>
            <div className="flex-1 h-px bg-white/[0.06]" />
            <button onClick={loadGallery} className="p-1.5 rounded-lg text-white/20 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {["all", ...FORMATS.filter((f) => gallery.some((c) => c.format === f.id)).map((f) => f.id)].map((id) => {
              const f = FORMATS.find((x) => x.id === id);
              return (
                <button
                  key={id}
                  onClick={() => setActiveGalleryFormat(id)}
                  className={cn("px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-all border",
                    activeGalleryFormat === id
                      ? "bg-purple-600/20 border-purple-500/40 text-purple-300"
                      : "border-white/[0.07] text-white/30 hover:text-white/60 hover:border-white/15")}
                >
                  {id === "all" ? `Todos (${gallery.length})` : f?.platform ?? id}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-4 gap-4">
            {filteredGallery.map((criativo) => {
              const f = FORMATS.find((x) => x.id === criativo.format);
              return (
                <div key={criativo.id} className="group rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/15 transition-all bg-white/[0.02]">
                  <div className="relative overflow-hidden" style={{ aspectRatio: f ? String(f.w / f.h) : "16/9" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={criativo.url} alt={criativo.headline ?? "Criativo"} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-x-0 bottom-0 p-3 flex gap-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => downloadFromUrl(criativo.url, `criativo-${criativo.format}.png`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm text-white/80 text-[11px] cursor-pointer hover:bg-white/20 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Baixar
                      </button>
                      <button
                        onClick={() => handleDelete(criativo)}
                        className="p-1.5 rounded-lg bg-red-500/20 backdrop-blur-sm text-red-300 cursor-pointer hover:bg-red-500/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="px-3 py-2.5 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-semibold text-purple-400 tracking-wide uppercase">{f?.platform ?? criativo.format}</span>
                    </div>
                    {criativo.headline && <p className="text-[11px] text-white/70 font-medium line-clamp-1">{criativo.headline}</p>}
                    {criativo.produto && <p className="text-[10px] text-white/25 line-clamp-1">{criativo.produto}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
