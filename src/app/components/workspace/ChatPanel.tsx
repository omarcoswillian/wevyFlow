"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Bot, User, Loader2, ImagePlus, Send, X } from "lucide-react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: { name: string; base64: string }[];
  timestamp: number;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isRefining: boolean;
  code: string;
  /** Called for AI refinement requests */
  onRefine: (text: string, images?: { name: string; base64: string }[]) => void;
  /** Called for direct photo inserts (no AI call) — receives base64 + caption */
  onInsertPhoto: (base64: string, caption: string) => void;
  endRef: React.RefObject<HTMLDivElement | null>;
}

export function ChatPanel({ messages, isLoading, isRefining, code, onRefine, onInsertPhoto, endRef }: ChatPanelProps) {
  const [chatInput, setChatInput] = useState("");
  const [chatImages, setChatImages] = useState<{ name: string; base64: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const chatFileRef = useRef<HTMLInputElement>(null);

  const addImageFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 2_000_000) return;
      const reader = new FileReader();
      reader.onload = () => {
        setChatImages((prev) => prev.length >= 3 ? prev : [...prev, { name: file.name, base64: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleSend = useCallback(() => {
    if ((!chatInput.trim() && chatImages.length === 0) || isRefining) return;

    const isPhotoInsert =
      chatImages.length > 0 &&
      (!chatInput.trim() || chatInput.toLowerCase().includes("foto") || chatInput.toLowerCase().includes("imagem") || chatInput.toLowerCase().includes("inserir"));

    if (isPhotoInsert) {
      const caption = chatInput.trim() || "Inserir foto no template";
      onInsertPhoto(chatImages[0].base64, caption);
      setChatInput("");
      setChatImages([]);
      return;
    }

    const msg = chatInput.trim() || "Analise a imagem e aplique ao layout";
    const imgs = [...chatImages];
    onRefine(msg, imgs.length > 0 ? imgs : undefined);
    setChatInput("");
    setChatImages([]);
  }, [chatInput, chatImages, isRefining, onRefine, onInsertPhoto]);

  const handleChatImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addImageFiles(e.target.files);
    if (chatFileRef.current) chatFileRef.current.value = "";
  }, [addImageFiles]);

  // Global drag & drop + paste
  useEffect(() => {
    let dragCounter = 0;

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.types.includes("Files")) setIsDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) { dragCounter = 0; setIsDragging(false); }
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);
      if (e.dataTransfer?.files.length) addImageFiles(e.dataTransfer.files);
    };
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) { e.preventDefault(); addImageFiles(files); }
    };

    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);

    return () => {
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [addImageFiles]);

  const hasPhotoPlaceholder = code.includes("photo-placeholder") || code.includes("hero-right-fallback");

  return (
    <>
      {/* Global drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-purple-500/5 border-2 border-dashed border-purple-500/40 flex items-center justify-center backdrop-blur-[2px] pointer-events-none">
          <div className="text-center bg-[#1a1a1e]/90 backdrop-blur-xl rounded-2xl px-8 py-6 border border-purple-500/20 shadow-2xl">
            <ImagePlus className="w-10 h-10 text-purple-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-purple-300">Solte a imagem aqui</p>
            <p className="text-[11px] text-purple-400/40 mt-1">Print, referência ou mockup</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className="flex gap-2.5">
              <div className={cn(
                "w-6 h-6 rounded-lg shrink-0 flex items-center justify-center mt-0.5",
                msg.role === "user" ? "bg-white/[0.06]" : "bg-purple-500/15"
              )}>
                {msg.role === "user" ? <User className="w-3 h-3 text-white/40" /> : <Bot className="w-3 h-3 text-purple-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-white/25 mb-1">{msg.role === "user" ? "Você" : "WevyFlow"}</p>
                {msg.images && msg.images.length > 0 && (
                  <div className="flex gap-1.5 mb-2">
                    {msg.images.map((img, j) => (
                      <img key={j} src={img.base64} alt={img.name} className="w-20 h-20 rounded-xl object-cover border border-white/[0.1]" />
                    ))}
                  </div>
                )}
                <p className="text-[12px] text-white/60 leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {(isLoading || isRefining) && (
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-purple-500/15 shrink-0 flex items-center justify-center mt-0.5">
                <Bot className="w-3 h-3 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-white/25 mb-1">WevyFlow</p>
                <div className="flex items-center gap-2 text-[12px] text-purple-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {isRefining ? "Aplicando refinamento..." : "Construindo layout..."}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Photo insert banner */}
      {hasPhotoPlaceholder && (
        <div className="px-3 pt-2">
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => onInsertPhoto(reader.result as string, "Inserir foto no template");
                reader.readAsDataURL(file);
              };
              input.click();
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/15 transition-all cursor-pointer"
          >
            <ImagePlus className="w-4 h-4" />
            Inserir foto do mentor / produto
          </button>
        </div>
      )}

      {/* Chat input */}
      <div className="px-3 pb-3 pt-1 space-y-2">
        {chatImages.length > 0 && (
          <div className="flex gap-1.5 px-1">
            {chatImages.map((img, i) => (
              <div key={i} className="relative group">
                <img src={img.base64} alt={img.name} className="w-12 h-12 rounded-lg object-cover border border-white/[0.1]" />
                <button
                  onClick={() => setChatImages(prev => prev.filter((_, idx) => idx !== i))}
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
            disabled={isLoading || chatImages.length >= 3}
            className={cn(
              "p-1.5 rounded-lg transition-all cursor-pointer shrink-0",
              chatImages.length >= 3 ? "text-white/10 cursor-not-allowed" : "text-white/25 hover:text-purple-400 hover:bg-white/[0.05]"
            )}
            title="Enviar imagem (print, referência, mockup)"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          <input ref={chatFileRef} type="file" accept="image/*" multiple onChange={handleChatImageUpload} className="hidden" />

          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={chatImages.length > 0 ? "Descreva o que quer baseado na imagem..." : "Peça alterações, envie prints..."}
            className="flex-1 bg-transparent text-[12px] text-white placeholder:text-white/20 focus:outline-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isRefining || isLoading || (!chatInput.trim() && chatImages.length === 0)}
            className={cn(
              "p-1.5 rounded-lg transition-all cursor-pointer shrink-0",
              (chatInput.trim() || chatImages.length > 0) && !isRefining && !isLoading
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
  );
}
