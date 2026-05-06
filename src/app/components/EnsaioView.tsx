"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ENSAIO_STYLES, ENSAIO_CATEGORIES, type EnsaioStyle } from "@/data/ensaio-prompts";
import { createClient } from "@/lib/supabase/client";
import {
  Camera, Download, Loader2, Upload, Sparkles, Check,
  AlertCircle, Library, Wand2, Images, ChevronRight, Copy,
  ImagePlus, Zap, X,
} from "lucide-react";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

interface Result { id: string; dataUrl: string; styleName: string; }

/* ─── Prompt Card ─────────────────────────────────────────── */
function PromptCard({
  style,
  customPhoto,
  onUse,
  onPhotoUpload,
  uploading,
}: {
  style: EnsaioStyle;
  customPhoto: string | null;
  onUse: () => void;
  onPhotoUpload: (file: File) => void;
  uploading: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const photo = customPhoto;

  const copyPrompt = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(style.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="group relative rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/15 transition-all select-none">
      {/* Photo area */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "3/4" }}>
        {photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt={style.label}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            {/* Upload overlay on hover */}
            <button
              onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
              className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-sm text-[10px] text-white/80 border border-white/20 font-medium">
                <ImagePlus className="w-3 h-3" />
                Trocar foto
              </span>
            </button>
          </>
        ) : (
          /* Empty state — upload placeholder */
          <button
            onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
            className="w-full h-full flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors hover:bg-white/[0.04]"
            style={{ background: "linear-gradient(160deg, #0d0d18 0%, #16162a 60%, #090912 100%)" }}
          >
            {uploading ? (
              <Loader2 className="w-7 h-7 text-white/20 animate-spin" />
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-white/[0.12] flex items-center justify-center">
                  <ImagePlus className="w-5 h-5 text-white/20" />
                </div>
                <p className="text-[10px] text-white/25 text-center px-4 leading-relaxed">
                  Adicionar foto<br/>do cliente
                </p>
              </>
            )}
          </button>
        )}

        {/* Title overlay */}
        <div className="absolute inset-x-0 top-0 p-3 bg-gradient-to-b from-black/75 to-transparent pointer-events-none">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/95 line-clamp-1 block">
            {style.label}
          </span>
          <span
            className="inline-block mt-1 px-1.5 py-0.5 rounded-md text-[8px] font-semibold"
            style={{ background: `${style.accentColor}30`, color: style.accentColor, border: `1px solid ${style.accentColor}40` }}
          >
            {style.shot} · {style.categoryLabel}
          </span>
        </div>
      </div>

      {/* Content below photo */}
      <div className="bg-[#111116] border-t border-white/[0.05] px-3 pt-2.5 pb-3">
        <p className="text-[10px] text-white/45 leading-relaxed line-clamp-3 mb-2.5">
          {style.description}. {style.prompt.slice(0, 110)}...
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={e => { e.stopPropagation(); onUse(); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-semibold text-white transition-all cursor-pointer hover:brightness-110"
            style={{ background: `${style.accentColor}28`, border: `1px solid ${style.accentColor}45` }}
          >
            <Wand2 className="w-3.5 h-3.5" />
            Usar
          </button>
          <button
            onClick={copyPrompt}
            title="Copiar prompt"
            className="flex items-center justify-center px-2.5 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/50 hover:bg-white/12 hover:text-white/80 transition-all cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) onPhotoUpload(f);
          if (fileRef.current) fileRef.current.value = "";
        }}
      />
    </div>
  );
}

/* ─── Main View ───────────────────────────────────────────── */
export function EnsaioView() {
  const supabase = createClient();

  const [tab,            setTab]            = useState<"biblioteca" | "gerar" | "gerados">("biblioteca");
  const [activeCategory, setActiveCategory] = useState("todos");
  const [selectedStyle,  setSelectedStyle]  = useState<EnsaioStyle | null>(null);
  const [photoDataUrl,   setPhotoDataUrl]   = useState<string | null>(null);
  const [generating,     setGenerating]     = useState(false);
  const [results,        setResults]        = useState<Result[]>([]);
  const [error,          setError]          = useState<string | null>(null);

  /* custom photos per style id */
  const [customPhotos,    setCustomPhotos]    = useState<Record<string, string>>({});
  const [uploadingStyle,  setUploadingStyle]  = useState<string | null>(null);

  /* batch generation */
  const [showBatchPanel,    setShowBatchPanel]    = useState(false);
  const [modelPhotoDataUrl, setModelPhotoDataUrl] = useState<string | null>(null);
  const [batchGenerating,   setBatchGenerating]   = useState(false);
  const [batchProgress,     setBatchProgress]     = useState<{ done: number; total: number; current: string } | null>(null);
  const modelPhotoRef = useRef<HTMLInputElement>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);

  /* ── Load custom photos from Supabase on mount ── */
  const loadCustomPhotos = useCallback(async () => {
    const map: Record<string, string> = {};
    await Promise.all(
      ENSAIO_STYLES.map(async style => {
        const path = `ensaio-styles/${style.id}.jpg`;
        const { data } = supabase.storage.from("ai-images").getPublicUrl(path);
        if (data?.publicUrl) {
          /* test if file exists with a HEAD request */
          try {
            const bust = `${data.publicUrl}?t=${Date.now()}`;
            const r = await fetch(bust, { method: "HEAD" });
            if (r.ok) map[style.id] = bust;
          } catch { /* file doesn't exist yet */ }
        }
      })
    );
    setCustomPhotos(map);
  }, [supabase]);

  useEffect(() => { loadCustomPhotos(); }, [loadCustomPhotos]);

  /* ── Upload custom photo for a style ── */
  const handlePhotoUpload = async (style: EnsaioStyle, file: File) => {
    setUploadingStyle(style.id);
    try {
      const path = `ensaio-styles/${style.id}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("ai-images")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("ai-images").getPublicUrl(path);
      /* bust cache by adding timestamp */
      setCustomPhotos(prev => ({ ...prev, [style.id]: `${data.publicUrl}?t=${Date.now()}` }));
    } catch (e) {
      console.error("Upload error:", e);
    } finally {
      setUploadingStyle(null);
    }
  };

  /* ── Batch: generate example photos for all styles with a model ── */
  const generateAllExamples = async () => {
    if (!modelPhotoDataUrl || batchGenerating) return;
    setBatchGenerating(true);
    const styles = ENSAIO_STYLES;
    setBatchProgress({ done: 0, total: styles.length, current: styles[0]?.label ?? "" });

    for (let i = 0; i < styles.length; i++) {
      const style = styles[i];
      setBatchProgress({ done: i, total: styles.length, current: style.label });
      try {
        const res = await fetch("/api/generate-design", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: style.prompt,
            referenceImages: [],
            avatarImages: [modelPhotoDataUrl],
            format: "4:5",
          }),
        });
        const json = await res.json();
        if (!res.ok) { console.warn(`Skipping ${style.id}:`, json.error); continue; }

        const byteStr = atob(json.b64);
        const ab = new ArrayBuffer(byteStr.length);
        const ia = new Uint8Array(ab);
        for (let j = 0; j < byteStr.length; j++) ia[j] = byteStr.charCodeAt(j);
        const blob = new Blob([ab], { type: json.mimeType });

        const path = `ensaio-styles/${style.id}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("ai-images")
          .upload(path, blob, { upsert: true, contentType: json.mimeType });
        if (!upErr) {
          const { data } = supabase.storage.from("ai-images").getPublicUrl(path);
          setCustomPhotos(prev => ({ ...prev, [style.id]: `${data.publicUrl}?t=${Date.now()}` }));
        }
      } catch (e) {
        console.error(`Error generating ${style.id}:`, e);
      }
    }

    setBatchProgress({ done: styles.length, total: styles.length, current: "Concluido!" });
    setBatchGenerating(false);
  };

  const filteredStyles = activeCategory === "todos"
    ? ENSAIO_STYLES
    : ENSAIO_STYLES.filter(s => s.category === activeCategory);

  const handlePhotoInput = async (files: FileList | null) => {
    if (!files?.[0]) return;
    setPhotoDataUrl(await readFileAsDataUrl(files[0]));
  };

  const handleUseStyle = (style: EnsaioStyle) => {
    setSelectedStyle(style);
    setTab("gerar");
  };

  const handleGenerate = async () => {
    if (!selectedStyle || !photoDataUrl || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: selectedStyle.prompt,
          referenceImages: [],
          avatarImages: [photoDataUrl],
          format: "4:5",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro na geração");
      const dataUrl = `data:${json.mimeType};base64,${json.b64}`;
      setResults(prev => [{ id: crypto.randomUUID(), dataUrl, styleName: selectedStyle.label }, ...prev]);
      setTab("gerados");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = !!selectedStyle && !!photoDataUrl && !generating;

  return (
    <div className="flex flex-col h-full bg-[#0a0a0e]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.05] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center">
            <Camera className="w-4 h-4 text-pink-400" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-white/90">Ensaio Fotografico</h1>
            <p className="text-[11px] text-white/30">Escolha um estilo, envie sua foto e gere fotos profissionais com IA</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
          {([
            { id: "biblioteca", icon: <Library className="w-3.5 h-3.5" />,  label: "Biblioteca", count: ENSAIO_STYLES.length },
            { id: "gerar",      icon: <Wand2 className="w-3.5 h-3.5" />,    label: "Gerar",      count: null },
            { id: "gerados",    icon: <Images className="w-3.5 h-3.5" />,   label: "Gerados",    count: results.length || null },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all cursor-pointer",
                tab === t.id
                  ? "bg-purple-600 text-white shadow-[0_0_16px_rgba(124,58,237,0.4)]"
                  : "text-white/40 hover:text-white/70"
              )}
            >
              {t.icon}
              {t.label}
              {t.count !== null && t.count > 0 && (
                <span className={cn(
                  "text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center",
                  tab === t.id ? "bg-white/20 text-white" : "bg-white/[0.08] text-white/40"
                )}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════ TAB: BIBLIOTECA ══════════ */}
      {tab === "biblioteca" && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Category filter + batch trigger */}
          <div className="flex gap-1.5 px-8 py-3 border-b border-white/[0.04] flex-wrap shrink-0 items-center justify-between">
            <div className="flex gap-1.5 flex-wrap">
              {ENSAIO_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border",
                    activeCategory === cat.id
                      ? "bg-purple-600/20 text-purple-300 border-purple-500/40"
                      : "text-white/30 border-transparent hover:text-white/60 hover:border-white/10"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowBatchPanel(p => !p)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all cursor-pointer border",
                showBatchPanel
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/35"
                  : "text-white/35 border-white/10 hover:text-white/60 hover:border-white/20"
              )}
            >
              <Zap className="w-3 h-3" />
              Gerar com modelo
            </button>
          </div>

          {/* Batch panel */}
          {showBatchPanel && (
            <div className="shrink-0 mx-8 my-3 p-4 rounded-2xl bg-amber-500/[0.06] border border-amber-500/20 flex items-center gap-5">
              {/* Model photo */}
              <div
                onClick={() => !batchGenerating && modelPhotoRef.current?.click()}
                className={cn(
                  "relative w-16 h-20 rounded-xl overflow-hidden border-2 border-dashed shrink-0 flex items-center justify-center transition-all",
                  modelPhotoDataUrl ? "border-amber-500/40" : "border-white/15 hover:border-amber-500/30 cursor-pointer"
                )}
              >
                {modelPhotoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={modelPhotoDataUrl} alt="modelo" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <Upload className="w-4 h-4 text-white/25" />
                )}
                {modelPhotoDataUrl && !batchGenerating && (
                  <div
                    className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    onClick={e => { e.stopPropagation(); modelPhotoRef.current?.click(); }}
                  >
                    <Upload className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
              <input ref={modelPhotoRef} type="file" accept="image/*" className="hidden" onChange={async e => {
                const f = e.target.files?.[0];
                if (f) setModelPhotoDataUrl(await readFileAsDataUrl(f));
                if (modelPhotoRef.current) modelPhotoRef.current.value = "";
              }} />

              {/* Info + progress */}
              <div className="flex-1 min-w-0">
                {batchProgress ? (
                  <>
                    <p className="text-[12px] font-semibold text-amber-300 mb-1.5">
                      {batchProgress.done < batchProgress.total
                        ? `Gerando ${batchProgress.done + 1} de ${batchProgress.total} — ${batchProgress.current}`
                        : "Concluido!"}
                    </p>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all duration-500"
                        style={{ width: `${(batchProgress.done / batchProgress.total) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-white/30 mt-1">{batchProgress.done}/{batchProgress.total} estilos gerados</p>
                  </>
                ) : (
                  <>
                    <p className="text-[12px] font-semibold text-white/70 mb-0.5">Gerar exemplos com esta modelo</p>
                    <p className="text-[10px] text-white/30">
                      {modelPhotoDataUrl
                        ? `${ENSAIO_STYLES.length} estilos serao gerados e salvos automaticamente`
                        : "Faca upload da foto da modelo para comecar"}
                    </p>
                  </>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {!batchGenerating && (
                  <button
                    onClick={generateAllExamples}
                    disabled={!modelPhotoDataUrl}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[12px] font-semibold transition-all cursor-pointer",
                      modelPhotoDataUrl
                        ? "bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                        : "bg-white/[0.04] text-white/20 cursor-not-allowed border border-white/[0.06]"
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Gerar todos
                  </button>
                )}
                {batchGenerating && (
                  <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                    <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                    <span className="text-[12px] text-amber-300">Gerando...</span>
                  </div>
                )}
                {!batchGenerating && (
                  <button
                    onClick={() => { setShowBatchPanel(false); setBatchProgress(null); }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/30 hover:text-white/60 cursor-pointer transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Cards grid */}
          <div className="flex-1 overflow-y-auto px-8 py-6">
            <div className="columns-4 gap-4 space-y-4">
              {filteredStyles.map(style => (
                <div key={style.id} className="break-inside-avoid">
                  <PromptCard
                    style={style}
                    customPhoto={customPhotos[style.id] ?? null}
                    onUse={() => handleUseStyle(style)}
                    onPhotoUpload={file => handlePhotoUpload(style, file)}
                    uploading={uploadingStyle === style.id}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════ TAB: GERAR ══════════ */}
      {tab === "gerar" && (
        <div className="flex-1 flex min-h-0">
          {/* Left — config */}
          <div className="w-[340px] border-r border-white/[0.05] flex flex-col p-6 gap-6 shrink-0">
            {/* Selected style */}
            <div>
              <p className="text-[10px] text-white/30 font-medium uppercase tracking-widest mb-2">Estilo selecionado</p>
              {selectedStyle ? (
                <div
                  className="relative rounded-2xl overflow-hidden border-2 cursor-pointer"
                  style={{ aspectRatio: "3/2", borderColor: `${selectedStyle.accentColor}50` }}
                  onClick={() => setTab("biblioteca")}
                >
                  {customPhotos[selectedStyle.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={customPhotos[selectedStyle.id]} alt={selectedStyle.label} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #0d0d18 0%, #16162a 60%, #090912 100%)" }} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-3">
                    <p className="text-[13px] font-bold text-white">{selectedStyle.label}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: selectedStyle.accentColor }}>{selectedStyle.shot} · {selectedStyle.categoryLabel}</p>
                  </div>
                  <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/60 text-[9px] text-white/60 border border-white/10">
                    Trocar
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setTab("biblioteca")}
                  className="w-full flex items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-white/[0.08] text-white/25 hover:border-purple-500/30 hover:text-white/50 transition-all cursor-pointer text-[12px]"
                >
                  <Library className="w-4 h-4" />
                  Escolher da Biblioteca
                </button>
              )}
            </div>

            {/* Upload photo */}
            <div>
              <p className="text-[10px] text-white/30 font-medium uppercase tracking-widest mb-2">Sua foto</p>
              <div
                onClick={() => photoInputRef.current?.click()}
                className={cn(
                  "relative w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all overflow-hidden flex items-center justify-center",
                  photoDataUrl ? "border-pink-500/40" : "border-white/[0.08] hover:border-pink-500/30"
                )}
                style={{ aspectRatio: "1/1" }}
              >
                {photoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoDataUrl} alt="sua foto" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
                      <Upload className="w-5 h-5 text-white/20" />
                    </div>
                    <p className="text-[12px] text-white/30">Upload da sua foto</p>
                    <p className="text-[10px] text-white/15">PNG, JPG, WEBP</p>
                  </div>
                )}
                {photoDataUrl && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-[11px] text-white/80 font-medium">Trocar foto</p>
                  </div>
                )}
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={e => handlePhotoInput(e.target.files)} />
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-300 leading-snug">{error}</p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={cn(
                "w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-[14px] font-bold transition-all cursor-pointer mt-auto",
                canGenerate
                  ? "bg-pink-600 hover:bg-pink-500 text-white shadow-[0_0_32px_rgba(236,72,153,0.35)]"
                  : "bg-white/[0.03] text-white/20 cursor-not-allowed border border-white/[0.05]"
              )}
            >
              {generating
                ? <><Loader2 className="w-5 h-5 animate-spin" />Gerando ensaio...</>
                : <><Sparkles className="w-5 h-5" />Gerar Ensaio</>
              }
            </button>
          </div>

          {/* Right — prompt preview */}
          <div className="flex-1 flex flex-col p-8 gap-4 overflow-y-auto">
            <p className="text-[10px] text-white/30 font-medium uppercase tracking-widest">Prompt do estilo</p>
            {selectedStyle ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStyle.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-2.5 py-1 rounded-lg font-medium border"
                      style={{ background: `${selectedStyle.accentColor}15`, color: `${selectedStyle.accentColor}cc`, borderColor: `${selectedStyle.accentColor}30` }}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex-1 bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5">
                  <p className="text-[12px] text-white/50 leading-relaxed font-mono whitespace-pre-wrap">{selectedStyle.prompt}</p>
                </div>
                <div className="flex items-center gap-2 text-white/20">
                  <ChevronRight className="w-3.5 h-3.5" />
                  <p className="text-[11px]">O sistema vai aplicar esse prompt com o seu rosto como referencia</p>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                <Library className="w-8 h-8 text-white/10" />
                <p className="text-[13px] text-white/25">Escolha um estilo na Biblioteca</p>
                <button onClick={() => setTab("biblioteca")}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[12px] text-white/40 hover:text-white/70 cursor-pointer transition-all">
                  Ir para Biblioteca
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ TAB: GERADOS ══════════ */}
      {tab === "gerados" && (
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-pink-500/[0.07] border border-pink-500/15 flex items-center justify-center">
                <Images className="w-7 h-7 text-pink-400/40" />
              </div>
              <p className="text-[14px] font-semibold text-white/30">Nenhum ensaio gerado ainda</p>
              <button onClick={() => setTab("biblioteca")}
                className="px-5 py-2.5 rounded-xl bg-pink-600/20 border border-pink-500/30 text-[12px] text-pink-300 hover:bg-pink-600/30 cursor-pointer transition-all font-medium">
                Explorar estilos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-5">
              {generating && (
                <div className="rounded-2xl border-2 border-dashed border-pink-500/30 bg-pink-500/[0.03] flex flex-col items-center justify-center gap-3" style={{ aspectRatio: "4/5" }}>
                  <Loader2 className="w-7 h-7 text-pink-400 animate-spin" />
                  <p className="text-[11px] text-pink-300/60">Gerando...</p>
                </div>
              )}
              {results.map(r => (
                <div key={r.id} className="group relative rounded-2xl overflow-hidden border border-white/[0.06] hover:border-pink-500/30 transition-all" style={{ aspectRatio: "4/5" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.dataUrl} alt="ensaio" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 group-hover:opacity-100 transition-all bg-gradient-to-t from-black/90 to-transparent flex flex-col gap-2">
                    <p className="text-[10px] text-white/50 truncate">{r.styleName}</p>
                    <a href={r.dataUrl} download="ensaio.png"
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white/15 backdrop-blur-sm text-white text-[11px] font-medium cursor-pointer hover:bg-white/25 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Baixar
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
