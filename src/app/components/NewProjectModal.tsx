"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { X, FolderPlus, User, Tag } from "lucide-react";

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (name: string, client: string) => Promise<void>;
}

export function NewProjectModal({ open, onClose, onConfirm }: NewProjectModalProps) {
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setClient("");
      setLoading(false);
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const canSubmit = name.trim().length > 0 && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      await onConfirm(name.trim(), client.trim() || "Sem cliente");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-[420px] bg-[#131316] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
              <FolderPlus className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-white">Novo projeto</h2>
              <p className="text-[11px] text-white/35 mt-0.5">Configure as informações do projeto</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="h-px bg-white/[0.06] mx-6" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Project name */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-white/40 uppercase tracking-widest mb-2">
              <Tag className="w-3 h-3" />
              Nome do projeto <span className="text-purple-400">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Landing Page Lançamento 2025"
              maxLength={80}
              className={cn(
                "w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20",
                "focus:outline-none transition-all",
                name.trim()
                  ? "border-purple-500/40 focus:border-purple-500/60 focus:shadow-[0_0_0_3px_rgba(168,85,247,0.08)]"
                  : "border-white/[0.07] focus:border-white/20"
              )}
            />
          </div>

          {/* Client name */}
          <div>
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-white/40 uppercase tracking-widest mb-2">
              <User className="w-3 h-3" />
              Cliente <span className="text-white/20 font-normal normal-case tracking-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              placeholder="Ex: João Silva"
              maxLength={60}
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-all"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-sm text-white/40 hover:text-white/60 hover:bg-white/[0.04] transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer",
                canSubmit
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/25 hover:scale-[1.01] active:scale-[0.99]"
                  : "bg-white/[0.05] text-white/20 cursor-not-allowed"
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeDasharray="56" strokeDashoffset="14" />
                  </svg>
                  Criando…
                </span>
              ) : (
                "Criar projeto"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
