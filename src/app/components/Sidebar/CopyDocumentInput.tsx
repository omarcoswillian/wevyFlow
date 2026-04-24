"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface CopyDocumentInputProps {
  value: string;
  onChange: (text: string) => void;
}

const MAX_COPY_CHARS = 20_000;

export function CopyDocumentInput({ value, onChange }: CopyDocumentInputProps) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "docx" && ext !== "pdf") {
      setUploadError("Formato inválido. Envie .docx ou .pdf");
      return;
    }
    setUploading(true);
    setUploadError(null);
    setFileName(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/parse-document", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error || "Erro ao processar arquivo"); return; }
      onChange(json.text.slice(0, MAX_COPY_CHARS));
      setFileName(json.fileName);
    } catch {
      setUploadError("Erro de conexão ao processar arquivo");
    } finally {
      setUploading(false);
    }
  }, [onChange]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleClear = () => {
    onChange("");
    setFileName(null);
    setUploadError(null);
  };

  const hasContent = value.trim().length > 0;

  return (
    <div className="border-b border-wf-border">
      {/* Toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-wf-surface/50 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={cn("transition-colors", hasContent ? "text-wf-primary" : "text-wf-text-muted/50 group-hover:text-wf-text-muted")}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <span className={cn("text-[11px] font-semibold uppercase tracking-widest", hasContent ? "text-wf-primary" : "text-wf-text-muted/60 group-hover:text-wf-text-muted")}>
            {hasContent ? `Copy carregada (${value.length.toLocaleString()} chars)` : "Tenho copy pronta"}
          </span>
          {hasContent && (
            <span className="w-1.5 h-1.5 rounded-full bg-wf-primary flex-shrink-0" />
          )}
        </div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={cn("text-wf-text-muted/40 transition-transform", open ? "rotate-180" : "")}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expandable content */}
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
              isDragging
                ? "border-wf-primary bg-wf-primary/10"
                : "border-wf-border hover:border-wf-primary/40 hover:bg-wf-surface/30"
            )}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".docx,.pdf"
              className="hidden"
              onChange={handleFileInput}
            />

            {uploading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-wf-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeDasharray="56" strokeDashoffset="14" />
                </svg>
                <span className="text-[11px] text-wf-text-muted">Extraindo texto…</span>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-wf-text-muted/50">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span className="text-[11px] text-wf-text-muted text-center leading-relaxed">
                  {fileName
                    ? <><span className="text-wf-primary font-medium">{fileName}</span><br />Clique para substituir</>
                    : <>Arraste ou clique para enviar<br /><span className="text-wf-text-muted/50">.docx ou .pdf · máx 10MB</span></>
                  }
                </span>
              </>
            )}
          </div>

          {uploadError && (
            <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {uploadError}
            </p>
          )}

          {/* Textarea to view/edit extracted copy */}
          {hasContent && (
            <div className="relative">
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value.slice(0, MAX_COPY_CHARS))}
                placeholder="Ou cole sua copy aqui…"
                rows={8}
                className="w-full bg-wf-surface border border-wf-border rounded-xl p-3 pb-6 text-[12px] text-wf-text placeholder:text-wf-text-muted/40 resize-none focus:outline-none focus:border-wf-primary transition-all leading-relaxed"
              />
              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                <span className={cn("text-[10px]", value.length > MAX_COPY_CHARS * 0.9 ? "text-wf-danger" : "text-wf-text-muted/40")}>
                  {value.length.toLocaleString()} / {MAX_COPY_CHARS.toLocaleString()}
                </span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[10px] text-wf-text-muted/50 hover:text-red-400 transition-colors"
                >
                  Limpar
                </button>
              </div>
            </div>
          )}

          {/* Paste-only (no file yet) */}
          {!hasContent && (
            <div className="relative">
              <textarea
                value={value}
                onChange={(e) => onChange(e.target.value.slice(0, MAX_COPY_CHARS))}
                placeholder="Ou cole sua copy aqui diretamente…"
                rows={5}
                className="w-full bg-wf-surface border border-wf-border rounded-xl p-3 pb-6 text-[12px] text-wf-text placeholder:text-wf-text-muted/40 resize-none focus:outline-none focus:border-wf-primary transition-all leading-relaxed"
              />
              <span className="absolute bottom-2 right-3 text-[10px] text-wf-text-muted/40">
                {value.length} / {MAX_COPY_CHARS.toLocaleString()}
              </span>
            </div>
          )}

          <p className="text-[10px] text-wf-text-muted/40 leading-relaxed">
            A IA vai usar exatamente seu texto — sem inventar copy nova.
          </p>
        </div>
      )}
    </div>
  );
}
