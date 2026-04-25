"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles, Upload, ImageIcon, Loader2, Check, AlertCircle,
  Trash2, Plus, X, RefreshCw,
} from "lucide-react";

interface GalleryImage {
  id: string;
  url: string;
  prompt: string | null;
  mode: string;
  created_at: string;
}

interface ImageAIPanelProps {
  selectedElementTagName?: string | null;
  onInsertImage: (url: string) => void;
}

type PanelTab = "create" | "edit" | "gallery";

const SIZES = [
  { id: "landscape", label: "Paisagem", ratio: "3/2" },
  { id: "square",    label: "Quadrado",  ratio: "1/1" },
  { id: "portrait",  label: "Retrato",   ratio: "2/3" },
] as const;

const QUALITIES = [
  { id: "high",   label: "Alta" },
  { id: "medium", label: "Média" },
  { id: "low",    label: "Baixa" },
] as const;

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

export function ImageAIPanel({ selectedElementTagName, onInsertImage }: ImageAIPanelProps) {
  const [tab, setTab] = useState<PanelTab>("create");

  // Create tab
  const [createPrompt, setCreatePrompt] = useState("");
  const [size, setSize] = useState<"landscape" | "square" | "portrait">("landscape");
  const [quality, setQuality] = useState<"high" | "medium" | "low">("medium");
  const [createLoading, setCreateLoading] = useState(false);
  const [createPreview, setCreatePreview] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit tab
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editPreview, setEditPreview] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Gallery
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null); // "create" | "edit" | null
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedGalleryUrl, setSelectedGalleryUrl] = useState<string | null>(null);

  const refInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true);
    const { data } = await supabase
      .from("ai_images")
      .select("id, url, prompt, mode, created_at")
      .order("created_at", { ascending: false });
    if (data) setGallery(data as GalleryImage[]);
    setGalleryLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  // ── Create ──────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!createPrompt.trim()) return;
    setCreateLoading(true);
    setCreateError(null);
    setCreatePreview(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: createPrompt.trim(), size, quality, apiKey: getOpenAIKey() }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error ?? "Erro ao gerar imagem."); return; }
      setCreatePreview(`data:${data.mimeType};base64,${data.b64}`);
    } catch {
      setCreateError("Falha na conexão. Tente novamente.");
    } finally {
      setCreateLoading(false);
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────────
  function handleRefFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRefFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setRefPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setEditPreview(null);
    setEditError(null);
  }

  async function handleEdit() {
    if (!editPrompt.trim() || !refPreview) return;
    setEditLoading(true);
    setEditError(null);
    setEditPreview(null);
    try {
      const res = await fetch("/api/edit-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: editPrompt.trim(), imageBase64: refPreview, size, quality, apiKey: getOpenAIKey() }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error ?? "Erro ao editar imagem."); return; }
      setEditPreview(`data:${data.mimeType};base64,${data.b64}`);
    } catch {
      setEditError("Falha na conexão. Tente novamente.");
    } finally {
      setEditLoading(false);
    }
  }

  // ── Save to gallery ──────────────────────────────────────────────────
  async function handleSaveToGallery(dataUrl: string, promptText: string, mode: "create" | "edit") {
    setSavingId(mode);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado.");

      const filename = `ai-image-${Date.now()}.png`;
      const file = await dataUrlToFile(dataUrl, filename);
      const path = `${user.id}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from("ai-images")
        .upload(path, file, { upsert: false, contentType: "image/png" });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("ai-images").getPublicUrl(path);

      await supabase.from("ai_images").insert({
        user_id: user.id,
        url: publicUrl,
        prompt: promptText || null,
        mode,
      });

      await loadGallery();
      setTab("gallery");
      if (mode === "create") { setCreatePreview(null); setCreatePrompt(""); }
      if (mode === "edit") { setEditPreview(null); setEditPrompt(""); setRefPreview(null); setRefFile(null); }
    } catch {
      // silent — user can retry
    } finally {
      setSavingId(null);
    }
  }

  // ── Upload to gallery ────────────────────────────────────────────────
  async function handleUploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadingFile(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado.");

      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/upload-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("ai-images")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("ai-images").getPublicUrl(path);
      await supabase.from("ai_images").insert({
        user_id: user.id,
        url: publicUrl,
        prompt: null,
        mode: "upload",
      });
      await loadGallery();
    } catch { /* silent */ } finally {
      setUploadingFile(false);
    }
  }

  // ── Delete from gallery ──────────────────────────────────────────────
  async function handleDeleteGallery(img: GalleryImage) {
    await supabase.from("ai_images").delete().eq("id", img.id);
    // Extract storage path from URL
    const urlObj = new URL(img.url);
    const storagePath = urlObj.pathname.split("/ai-images/")[1];
    if (storagePath) await supabase.storage.from("ai-images").remove([storagePath]);
    setGallery((prev) => prev.filter((g) => g.id !== img.id));
    if (selectedGalleryUrl === img.url) setSelectedGalleryUrl(null);
  }

  const isImgSelected = selectedElementTagName === "img";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-0.5 px-2 pt-2 pb-0 border-b border-white/[0.05] shrink-0">
        {(["create", "edit", "gallery"] as PanelTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-medium rounded-t-lg cursor-pointer transition-all border-b-2 -mb-px",
              tab === t ? "border-purple-500 text-white" : "border-transparent text-white/30 hover:text-white/60"
            )}
          >
            {t === "create" ? "Criar" : t === "edit" ? "Com referência" : "Galeria"}
          </button>
        ))}
      </div>

      {/* ── CREATE TAB ────────────────────────────────────────────── */}
      {tab === "create" && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <textarea
            value={createPrompt}
            onChange={(e) => setCreatePrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCreate(); }}
            placeholder="Descreva a imagem que quer gerar..."
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 resize-none h-[72px] transition-colors"
          />

          {/* Size */}
          <div>
            <span className="text-[9px] text-white/30 mb-1.5 block">Formato</span>
            <div className="flex gap-1.5">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSize(s.id)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border cursor-pointer transition-all text-[9px]",
                    size === s.id ? "border-purple-500/50 bg-purple-500/10 text-white" : "border-white/[0.06] text-white/30 hover:text-white/60"
                  )}
                >
                  <div className={cn("border rounded-sm w-4", size === s.id ? "border-purple-400" : "border-white/20")}
                    style={{ aspectRatio: s.ratio }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            {QUALITIES.map((q) => (
              <button
                key={q.id}
                onClick={() => setQuality(q.id)}
                className={cn("flex-1 py-1.5 rounded-md text-[10px] font-medium cursor-pointer transition-all",
                  quality === q.id ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/60"
                )}
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {createError && (
            <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-px" />
              <p className="text-[10px] text-red-300">{createError}</p>
            </div>
          )}

          {/* Preview */}
          {(createLoading || createPreview) && (
            <div className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02]" style={{ aspectRatio: size === "landscape" ? "3/2" : size === "portrait" ? "2/3" : "1/1" }}>
              {createLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  <p className="text-[10px] text-white/30">Gerando...</p>
                </div>
              )}
              {createPreview && !createLoading && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={createPreview} alt="Preview" className="w-full h-full object-cover" />
              )}
            </div>
          )}

          {/* Actions */}
          {createPreview && !createLoading ? (
            <div className="flex gap-2">
              <button onClick={() => { setCreatePreview(null); handleCreate(); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] text-white/50 hover:text-white cursor-pointer transition-all">
                <RefreshCw className="w-3 h-3" /> Outra
              </button>
              <button
                onClick={() => handleSaveToGallery(createPreview, createPrompt, "create")}
                disabled={savingId === "create"}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-[10px] font-semibold text-white cursor-pointer transition-all disabled:opacity-60"
              >
                {savingId === "create" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Aprovar
              </button>
            </div>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!createPrompt.trim() || createLoading}
              className={cn("w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-all",
                createPrompt.trim() && !createLoading ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-white/[0.04] text-white/20 cursor-not-allowed"
              )}
            >
              {createLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...</> : <><Sparkles className="w-3.5 h-3.5" /> Gerar imagem</>}
            </button>
          )}
        </div>
      )}

      {/* ── EDIT TAB ──────────────────────────────────────────────── */}
      {tab === "edit" && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {/* Reference upload */}
          <div>
            <span className="text-[9px] text-white/30 mb-1.5 block">Foto de referência (especialista / produto)</span>
            {refPreview ? (
              <div className="relative rounded-xl overflow-hidden border border-white/[0.06] aspect-video">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={refPreview} alt="Referência" className="w-full h-full object-cover" />
                <button
                  onClick={() => { setRefFile(null); setRefPreview(null); setEditPreview(null); }}
                  className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-black/60 text-white/70 hover:text-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => refInputRef.current?.click()}
                className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-xl border border-dashed border-white/[0.12] hover:border-white/25 text-white/30 hover:text-white/60 cursor-pointer transition-all"
              >
                <Upload className="w-5 h-5" />
                <span className="text-[10px]">Clique para selecionar a foto</span>
                <span className="text-[9px] text-white/20">JPG, PNG ou WEBP</span>
              </button>
            )}
            <input ref={refInputRef} type="file" accept="image/*" className="hidden" onChange={handleRefFileChange} />
          </div>

          {/* Format / Quality (same as create) */}
          <div className="flex gap-1.5">
            {SIZES.map((s) => (
              <button key={s.id} onClick={() => setSize(s.id)}
                className={cn("flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border cursor-pointer transition-all text-[9px]",
                  size === s.id ? "border-purple-500/50 bg-purple-500/10 text-white" : "border-white/[0.06] text-white/30 hover:text-white/60")}>
                <div className={cn("border rounded-sm w-4", size === s.id ? "border-purple-400" : "border-white/20")} style={{ aspectRatio: s.ratio }} />
                {s.label}
              </button>
            ))}
          </div>

          {/* Instruction prompt */}
          <textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            placeholder="Ex: Coloque esta pessoa em um escritório moderno com luz natural..."
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 resize-none h-[72px] transition-colors"
          />

          {/* Error */}
          {editError && (
            <div className="flex items-start gap-1.5 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-px" />
              <p className="text-[10px] text-red-300">{editError}</p>
            </div>
          )}

          {/* Result preview */}
          {(editLoading || editPreview) && (
            <div className="relative rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02]" style={{ aspectRatio: size === "landscape" ? "3/2" : size === "portrait" ? "2/3" : "1/1" }}>
              {editLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  <p className="text-[10px] text-white/30">Editando com IA...</p>
                </div>
              )}
              {editPreview && !editLoading && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editPreview} alt="Resultado" className="w-full h-full object-cover" />
              )}
            </div>
          )}

          {/* Actions */}
          {editPreview && !editLoading ? (
            <div className="flex gap-2">
              <button onClick={() => { setEditPreview(null); handleEdit(); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] text-white/50 hover:text-white cursor-pointer transition-all">
                <RefreshCw className="w-3 h-3" /> Outra
              </button>
              <button
                onClick={() => handleSaveToGallery(editPreview, editPrompt, "edit")}
                disabled={savingId === "edit"}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-[10px] font-semibold text-white cursor-pointer transition-all disabled:opacity-60"
              >
                {savingId === "edit" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Aprovar
              </button>
            </div>
          ) : (
            <button
              onClick={handleEdit}
              disabled={!editPrompt.trim() || !refPreview || editLoading}
              className={cn("w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold cursor-pointer transition-all",
                editPrompt.trim() && refPreview && !editLoading ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-white/[0.04] text-white/20 cursor-not-allowed"
              )}
            >
              {editLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Editando...</> : <><Sparkles className="w-3.5 h-3.5" /> Editar com IA</>}
            </button>
          )}
        </div>
      )}

      {/* ── GALLERY TAB ───────────────────────────────────────────── */}
      {tab === "gallery" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04] shrink-0">
            <span className="text-[10px] text-white/30">{gallery.length} imagem{gallery.length !== 1 ? "ns" : ""}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={loadGallery}
                className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                onClick={() => uploadInputRef.current?.click()}
                disabled={uploadingFile}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[10px] text-white/60 hover:text-white cursor-pointer transition-all"
              >
                {uploadingFile ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Upload
              </button>
              <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleUploadFile} />
            </div>
          </div>

          {/* Selected image insert bar */}
          {selectedGalleryUrl && (
            <div className="mx-3 mt-2 flex gap-2 items-center p-2 rounded-xl bg-purple-500/10 border border-purple-500/25 shrink-0">
              <p className="flex-1 text-[10px] text-purple-300 truncate">
                {isImgSelected ? "Substituir imagem selecionada" : "Inserir como novo elemento"}
              </p>
              <button
                onClick={() => { onInsertImage(selectedGalleryUrl); setSelectedGalleryUrl(null); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-[10px] font-semibold text-white cursor-pointer transition-colors"
              >
                <Check className="w-3 h-3" /> Inserir
              </button>
            </div>
          )}

          {/* Grid */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {galleryLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
              </div>
            ) : gallery.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <ImageIcon className="w-8 h-8 text-white/10" />
                <p className="text-[11px] text-white/30">Nenhuma imagem na galeria</p>
                <p className="text-[10px] text-white/20">Gere ou faça upload de imagens para elas aparecerem aqui</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {gallery.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => setSelectedGalleryUrl(selectedGalleryUrl === img.url ? null : img.url)}
                    className={cn(
                      "relative group rounded-xl overflow-hidden border cursor-pointer transition-all aspect-video",
                      selectedGalleryUrl === img.url ? "border-purple-500 ring-1 ring-purple-500/50" : "border-white/[0.06] hover:border-white/20"
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.prompt ?? "Imagem"} className="w-full h-full object-cover" />
                    {/* Mode badge */}
                    <div className="absolute top-1 left-1">
                      <span className={cn("px-1 py-0.5 rounded text-[8px] font-medium",
                        img.mode === "edit" ? "bg-amber-500/80 text-white" : img.mode === "upload" ? "bg-blue-500/80 text-white" : "bg-purple-500/80 text-white"
                      )}>
                        {img.mode === "edit" ? "Edição" : img.mode === "upload" ? "Upload" : "IA"}
                      </span>
                    </div>
                    {/* Delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteGallery(img); }}
                      className="absolute top-1 right-1 p-1 rounded-lg bg-black/60 text-white/0 group-hover:text-red-400 cursor-pointer transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                    {/* Selected overlay */}
                    {selectedGalleryUrl === img.url && (
                      <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-purple-300" />
                      </div>
                    )}
                    {/* Tooltip on hover */}
                    {img.prompt && (
                      <div className="absolute inset-x-0 bottom-0 p-1.5 bg-black/70 translate-y-full group-hover:translate-y-0 transition-transform">
                        <p className="text-[8px] text-white/70 line-clamp-2">{img.prompt}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
