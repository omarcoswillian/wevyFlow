"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ExternalLink, Trash2, Upload, X, Globe, Loader2, Plus, Copy, Check, Zap, Pen } from "lucide-react";

interface PublishedPage {
  id: string;
  slug: string;
  title: string;
  page_type: string | null;
  created_at: string;
  updated_at: string;
  views: number;
}

interface ImportState {
  open: boolean;
  name: string;
  file: File | null;
  loading: boolean;
  error: string;
  done: boolean;
  doneSlug: string;
}

const INIT_IMPORT: ImportState = {
  open: false,
  name: "",
  file: null,
  loading: false,
  error: "",
  done: false,
  doneSlug: "",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

async function compressDataUrl(dataUrl: string, maxWidth = 1440, quality = 0.82): Promise<string> {
  if (!dataUrl.startsWith("data:image")) return dataUrl;
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const ratio = Math.min(1, maxWidth / img.width);
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://app.wevyflow.com";

export default function PaginasView() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pages, setPages] = useState<PublishedPage[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [imp, setImp] = useState<ImportState>(INIT_IMPORT);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchPages = useCallback(async () => {
    setLoadingList(true);
    setListError("");
    try {
      const { data, error } = await supabase
        .from("published_pages")
        .select("id, slug, title, page_type, created_at, updated_at, views")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setPages((data as PublishedPage[]) || []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Erro ao carregar paginas.");
    } finally {
      setLoadingList(false);
    }
  }, [supabase]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setImp((prev) => ({
      ...prev,
      file: f,
      name: prev.name || (f ? f.name.replace(/\.wevypage\.json$/i, "").replace(/_/g, " ") : ""),
      error: "",
    }));
  };

  const handleImport = async () => {
    if (!imp.file) { setImp((p) => ({ ...p, error: "Selecione o arquivo .wevypage.json." })); return; }
    if (!imp.name.trim()) { setImp((p) => ({ ...p, error: "Informe um nome." })); return; }
    setImp((p) => ({ ...p, loading: true, error: "" }));
    try {
      const text = await imp.file.text();
      let parsed: { name?: string; refWidth?: number; html?: string; assets?: Record<string, string> };
      try { parsed = JSON.parse(text); } catch { throw new Error("Arquivo invalido."); }
      if (!parsed.html) throw new Error("Campo 'html' ausente no arquivo.");

      const assets = parsed.assets || {};
      const compressed: Record<string, string> = {};
      for (const [id, dataUrl] of Object.entries(assets)) {
        compressed[id] = await compressDataUrl(dataUrl as string);
      }
      let finalHtml = parsed.html as string;
      for (const [id, dataUrl] of Object.entries(compressed)) {
        finalHtml = finalHtml.replaceAll(`'${id}'`, `'${dataUrl}'`);
        finalHtml = finalHtml.replaceAll(`"${id}"`, `"${dataUrl}"`);
      }

      const res = await fetch("/api/pages/figma-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: imp.name.trim(), refWidth: parsed.refWidth ?? 1440, html: finalHtml }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao importar.");
      setImp((p) => ({ ...p, loading: false, done: true, doneSlug: json.slug }));
      fetchPages();
    } catch (e) {
      setImp((p) => ({ ...p, loading: false, error: e instanceof Error ? e.message : "Erro." }));
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("published_pages").delete().eq("id", id);
      if (error) throw error;
      setPages((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirm(null);
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  };

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(`${APP_URL}/p/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  const closeImport = () => {
    setImp(INIT_IMPORT);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-[20px] font-bold text-white">Paginas Publicadas</h1>
            <p className="text-[12px] text-white/40 mt-0.5">
              Geradas por IA ou importadas do Figma — publicadas em{" "}
              <span className="text-white/60 font-mono text-[11px]">wevyflow.com/p/</span>
            </p>
          </div>
          <button
            onClick={() => setImp((p) => ({ ...p, open: true }))}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-white/[0.12] text-white/40 hover:text-white/60 hover:border-white/25 text-[12px] font-medium transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Importar do Figma
          </button>
        </div>

        {/* Info pill — how to publish AI pages */}
        <div className="mb-6 flex items-start gap-3 px-4 py-3 rounded-xl bg-purple-500/[0.06] border border-purple-500/[0.12]">
          <Zap className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-white/50 leading-relaxed">
            Para publicar uma pagina gerada por IA, abra-a no editor e clique no botao{" "}
            <span className="text-purple-400 font-semibold">Publicar</span> na barra superior. A pagina fica disponivel em poucos segundos.
          </p>
        </div>

        {/* Content */}
        {loadingList ? (
          <div className="flex items-center gap-2 text-white/30 text-[12px] py-16 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando...
          </div>
        ) : listError ? (
          <div className="text-red-400 text-[12px] py-16 text-center">{listError}</div>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
              <Globe className="w-6 h-6 text-white/20" />
            </div>
            <p className="text-[13px] font-semibold text-white/50">Nenhuma pagina publicada ainda</p>
            <p className="text-[12px] text-white/25 max-w-xs text-center leading-relaxed">
              Gere uma pagina no editor e clique em Publicar, ou importe um arquivo do Figma.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pages.map((page) => (
              <PageCard
                key={page.id}
                page={page}
                onDelete={() => setDeleteConfirm(page.id)}
                onCopy={() => copyUrl(page.slug)}
                copied={copied === page.slug}
                appUrl={APP_URL}
              />
            ))}
          </div>
        )}
      </div>

      {/* Import Panel */}
      {imp.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-[#18181c] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-[13px] font-semibold">Importar pagina do Figma</h2>
              <button onClick={closeImport} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {imp.done ? (
                <div className="space-y-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
                    <p className="text-emerald-400 text-[12px] font-semibold mb-1">Pagina importada com sucesso</p>
                    <p className="text-white/40 text-[11px] font-mono">/p/{imp.doneSlug}</p>
                  </div>
                  <div className="flex gap-2">
                    <a href={`/p/${imp.doneSlug}`} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-[12px] font-semibold transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" /> Abrir pagina
                    </a>
                    <button onClick={closeImport}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-[12px] text-white/60 font-medium transition-colors cursor-pointer">
                      Fechar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 text-[11px] text-white/40 leading-relaxed">
                    No plugin Figma, selecione o frame e clique em{" "}
                    <strong className="text-white/60">Exportar pagina selecionada</strong>. Faca upload do{" "}
                    <code className="bg-white/[0.07] px-1 py-0.5 rounded">.wevypage.json</code> abaixo.
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-white/40 mb-1.5">Arquivo .wevypage.json</label>
                    <div onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-white/[0.08] hover:border-purple-500/40 rounded-xl p-6 text-center cursor-pointer transition-colors group">
                      <Upload className="w-5 h-5 mx-auto mb-2 text-white/20 group-hover:text-purple-400/60 transition-colors" />
                      {imp.file
                        ? <p className="text-[12px] text-white/60">{imp.file.name}</p>
                        : <p className="text-[12px] text-white/25">Clique para selecionar</p>
                      }
                    </div>
                    <input ref={fileInputRef} type="file" accept=".json,.wevypage.json" className="hidden" onChange={handleFileChange} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-white/40 mb-1.5">Nome da pagina</label>
                    <input type="text" value={imp.name} onChange={(e) => setImp((p) => ({ ...p, name: e.target.value, error: "" }))}
                      placeholder="Ex: Landing Page Produto X"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] focus:border-purple-500/40 focus:outline-none text-[12px] text-white placeholder-white/20 transition-colors" />
                  </div>
                  {imp.error && (
                    <p className="text-red-400 text-[11px] bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{imp.error}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleImport} disabled={imp.loading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-[12px] font-semibold transition-colors cursor-pointer">
                      {imp.loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Importando...</> : "Importar"}
                    </button>
                    <button onClick={closeImport} disabled={imp.loading}
                      className="px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-[12px] text-white/50 font-medium transition-colors cursor-pointer">
                      Cancelar
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-[#18181c] border border-white/[0.08] rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-[13px] font-semibold">Despublicar pagina?</h3>
            <p className="text-[11px] text-white/40 leading-relaxed">
              A pagina vai sair do ar imediatamente. O conteudo nao pode ser recuperado.
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/80 hover:bg-red-500 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors cursor-pointer">
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Despublicar
              </button>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-[12px] text-white/50 font-medium transition-colors cursor-pointer">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageCard({
  page, onDelete, onCopy, copied, appUrl,
}: {
  page: PublishedPage;
  onDelete: () => void;
  onCopy: () => void;
  copied: boolean;
  appUrl: string;
}) {
  const isFigma = page.page_type === "figma";
  const publicUrl = `${appUrl}/p/${page.slug}`;

  return (
    <div className="group bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.10] rounded-2xl p-4 transition-all flex flex-col gap-3">
      {/* Type badge + title */}
      <div className="flex items-start gap-2.5">
        <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${isFigma ? "bg-[#1abcfe]/10 border border-[#1abcfe]/20" : "bg-purple-500/10 border border-purple-500/20"}`}>
          {isFigma
            ? <Pen className="w-3.5 h-3.5 text-[#1abcfe]" />
            : <Zap className="w-3.5 h-3.5 text-purple-400" />
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-white truncate leading-tight">{page.title}</p>
          <p className="text-[10px] text-white/30 mt-0.5">{formatDate(page.updated_at)}</p>
        </div>
      </div>

      {/* URL slug */}
      <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.05] rounded-lg px-2.5 py-1.5">
        <Globe className="w-2.5 h-2.5 text-white/20 shrink-0" />
        <p className="text-[10px] font-mono text-white/30 truncate flex-1">/p/{page.slug}</p>
        {page.views > 0 && (
          <span className="shrink-0 text-[9px] text-white/20">{page.views} views</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 mt-auto">
        <a href={publicUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-white/50 hover:text-white text-[11px] font-medium transition-colors">
          <ExternalLink className="w-3 h-3" />
          Abrir
        </a>
        <button onClick={onCopy}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-white/50 hover:text-white text-[11px] font-medium transition-colors cursor-pointer">
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copiado" : "Copiar URL"}
        </button>
        <button onClick={onDelete}
          className="ml-auto p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          title="Despublicar">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
