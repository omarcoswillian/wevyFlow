"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Plus,
  Loader2,
  Home,
  Search,
  BookOpen,
  FolderOpen,
  Star,
  Users,
  Share2,
  ExternalLink,
  Zap,
  PanelLeft,
  Key,
  CheckCircle,
  FileText,
  X,
  Paintbrush,
} from "lucide-react";
import { Platform } from "../lib/types";
import { ApiKeyModal } from "./ApiKeyModal";
import { useAppContext } from "../(app)/_context";

export interface GenerateData {
  prompt: string;
  platform: Platform;
  referenceUrl: string;
  brandReference: string;
  expectations: string;
  primaryColor: string;
  secondaryColor: string;
  fontChoice: string;
  stylePreset: string;
  images: { name: string; base64: string }[];
  copyDocument?: string;
}

interface HomeViewProps {
  onGenerate: (data: GenerateData) => void;
  isLoading: boolean;
  onNavigate?: (view: any) => void;
  onOpenSearch?: () => void;
  contentOverride?: React.ReactNode;
  activeNav?: string;
}

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "html", label: "HTML" },
  { id: "elementor", label: "Elementor" },
  { id: "webflow", label: "Webflow" },
];

const FONT_OPTIONS = [
  { id: "sora", label: "Sora" }, { id: "inter", label: "Inter" },
  { id: "poppins", label: "Poppins" }, { id: "montserrat", label: "Montserrat" },
  { id: "playfair", label: "Playfair" }, { id: "space-grotesk", label: "Space Grotesk" },
];

const STYLE_PRESETS = [
  { id: "dark-premium", label: "Dark", icon: "◉" }, { id: "light-clean", label: "Light", icon: "○" },
  { id: "glassmorphism", label: "Glass", icon: "◇" }, { id: "neon-tech", label: "Neon", icon: "▸" },
  { id: "luxury", label: "Luxury", icon: "★" }, { id: "brutalist", label: "Brutal", icon: "■" },
];

const COLOR_PRESETS = [
  { primary: "#a78bfa", secondary: "#6366f1" }, { primary: "#3b82f6", secondary: "#06b6d4" },
  { primary: "#ec4899", secondary: "#f43f5e" }, { primary: "#f97316", secondary: "#eab308" },
  { primary: "#10b981", secondary: "#14b8a6" }, { primary: "#f1f5f9", secondary: "#e2e8f0" },
];

export function HomeView({ onGenerate, isLoading, onNavigate, onOpenSearch, contentOverride, activeNav }: HomeViewProps) {
  const nav = onNavigate || (() => {});
  const { apiKey, aiProvider, aiModel, saveApiKey, clearApiKey } = useAppContext();
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState<Platform>("html");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [brandReference, setBrandReference] = useState("");
  const [expectations, setExpectations] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#a78bfa");
  const [secondaryColor, setSecondaryColor] = useState("#6366f1");
  const [fontChoice, setFontChoice] = useState("sora");
  const [stylePreset, setStylePreset] = useState("dark-premium");
  const [images, setImages] = useState<{ name: string; base64: string }[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [copyDocument, setCopyDocument] = useState("");
  const [copyFileName, setCopyFileName] = useState<string | null>(null);
  const [copyUploading, setCopyUploading] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyTab, setCopyTab] = useState<"upload" | "url">("upload");
  const [copyUrl, setCopyUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const handleDocUpload = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase().split(".").pop();
    if (ext !== "docx" && ext !== "pdf") { setCopyError("Use .docx ou .pdf"); return; }
    setCopyUploading(true); setCopyError(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/parse-document", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) { setCopyError(json.error || "Erro ao processar"); return; }
      setCopyDocument(json.text.slice(0, 20000));
      setCopyFileName(json.fileName);
    } catch { setCopyError("Erro de conexão"); }
    finally { setCopyUploading(false); }
  }, []);

  const handleDocFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleDocUpload(file);
    e.target.value = "";
  };

  const handleDocUrlImport = useCallback(async () => {
    if (!copyUrl.trim()) return;
    setCopyUploading(true); setCopyError(null);
    try {
      const res = await fetch("/api/parse-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: copyUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setCopyError(json.error || "Erro ao importar"); return; }
      setCopyDocument(json.text.slice(0, 20000));
      setCopyFileName(json.fileName);
      setCopyUrl("");
    } catch { setCopyError("Erro de conexão"); }
    finally { setCopyUploading(false); }
  }, [copyUrl]);

  const clearCopyDocument = () => { setCopyDocument(""); setCopyFileName(null); setCopyError(null); setCopyUrl(""); };

  const handleSubmit = () => {
    if ((!prompt.trim() && images.length === 0 && !copyDocument.trim()) || isLoading) return;
    onGenerate({ prompt, platform, referenceUrl, brandReference, expectations, primaryColor, secondaryColor, fontChoice, stylePreset, images, copyDocument: copyDocument.trim() || undefined });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); handleSubmit(); }
  };

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 500_000) return;
      const reader = new FileReader();
      reader.onload = () => { setImages((prev) => prev.length >= 5 ? prev : [...prev, { name: file.name, base64: reader.result as string }]); };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div className="flex h-screen bg-[#080809] p-2 gap-2">
      {/* ─── Left Sidebar ─── */}
      <aside className={cn(
        "shrink-0 flex flex-col bg-[#0e0e11] rounded-[20px] z-20 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        sidebarCollapsed ? "w-[56px]" : "w-[220px]"
      )}>
        {/* Top: Logo + Sidebar Toggle */}
        <div className="px-2 pt-3 pb-2">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <img src="/IconeAtual3.png" alt="WevyFlow" className="w-8 h-8" />
              <button onClick={() => setSidebarCollapsed(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b6b6b] hover:text-[#9a9a9a] hover:bg-white/[0.06] transition-all cursor-pointer" title="Expandir sidebar">
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center px-2">
              <img src="/IconeAtual3.png" alt="WevyFlow" className="w-7 h-7 shrink-0" />
              <div className="flex-1" />
              <button onClick={() => setSidebarCollapsed(true)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6b6b6b] hover:text-[#9a9a9a] hover:bg-white/[0.06] transition-all cursor-pointer" title="Recolher sidebar">
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-hidden">
          <SidebarItem icon={<Home className="w-4 h-4" />} label="Home" active={!activeNav || activeNav === "home"} collapsed={sidebarCollapsed} onClick={() => nav("home")} />
          <SidebarItem icon={<Search className="w-4 h-4" />} label="Search" collapsed={sidebarCollapsed} shortcut="⌘K" onClick={onOpenSearch} />
          <SidebarItem icon={<BookOpen className="w-4 h-4" />} label="Resources" active={activeNav === "resources"} collapsed={sidebarCollapsed} onClick={() => nav("resources")} />
          <SidebarItem icon={<Paintbrush className="w-4 h-4" />} label="Creatives" active={activeNav === "criativos"} collapsed={sidebarCollapsed} onClick={() => nav("criativos")} />

          {!sidebarCollapsed && (
            <div className="pt-4 pb-2">
              <span className="px-2 text-[9px] font-medium text-white/20 uppercase tracking-widest">Projetos</span>
            </div>
          )}
          {sidebarCollapsed && <div className="pt-3" />}
          <SidebarItem icon={<FolderOpen className="w-4 h-4" />} label="Todos" active={activeNav === "projects-all"} collapsed={sidebarCollapsed} onClick={() => nav("projects-all")} />
          <SidebarItem icon={<Star className="w-4 h-4" />} label="Favoritos" active={activeNav === "projects-starred"} collapsed={sidebarCollapsed} onClick={() => nav("projects-starred")} />
          <SidebarItem icon={<Users className="w-4 h-4" />} label="Criados por mim" active={activeNav === "projects-mine"} collapsed={sidebarCollapsed} onClick={() => nav("projects-mine")} />
          <SidebarItem icon={<Share2 className="w-4 h-4" />} label="Compartilhados" active={activeNav === "projects-shared"} collapsed={sidebarCollapsed} onClick={() => nav("projects-shared")} />
        </nav>

        {/* Bottom — API Key / BYOK */}
        <div className="px-2 pb-3 space-y-1">
          {!sidebarCollapsed ? (
            <>
              {apiKey ? (
                <button
                  onClick={() => setApiKeyModalOpen(true)}
                  className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors cursor-pointer group"
                >
                  <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-[11px] font-medium text-emerald-400">IA Conectada</p>
                    <p className="text-[9px] text-white/25 font-mono truncate">{apiKey.slice(0, 14)}…</p>
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => setApiKeyModalOpen(true)}
                  className="flex items-center gap-2 w-full px-2.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-purple-500/20 transition-colors cursor-pointer"
                >
                  <Key className="w-3 h-3 text-purple-400 shrink-0" />
                  <div className="flex-1 text-left">
                    <p className="text-[11px] font-medium text-white/50">Conectar sua IA</p>
                    <p className="text-[9px] text-white/20">API Key Anthropic</p>
                  </div>
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => setApiKeyModalOpen(true)}
              className={cn(
                "w-10 h-10 mx-auto rounded-xl flex items-center justify-center transition-colors cursor-pointer",
                apiKey
                  ? "text-emerald-400 hover:bg-emerald-500/10"
                  : "text-purple-400 hover:bg-purple-500/10"
              )}
              title={apiKey ? "IA Conectada" : "Conectar sua IA"}
            >
              {apiKey ? <CheckCircle className="w-4 h-4" /> : <Key className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* API Key Modal */}
        <ApiKeyModal
          open={apiKeyModalOpen}
          currentKey={apiKey}
          currentProvider={aiProvider}
          currentModel={aiModel}
          onSave={saveApiKey}
          onClear={clearApiKey}
          onClose={() => setApiKeyModalOpen(false)}
        />
      </aside>

      {/* ─── Main Area (rounded card with aurora) ─── */}
      <main className="flex-1 flex flex-col relative overflow-hidden rounded-[20px] bg-[#0c0c10]">
        {/* Aurora gradient — only on home */}
        {!contentOverride && <div className="aurora-bg" style={{ borderRadius: "20px" }} />}

        {/* Content override for other pages */}
        {contentOverride ? (
          <div className="flex-1 overflow-y-auto">{contentOverride}</div>
        ) : (
        <>

        {/* Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
          {/* Headline */}
          <h1 className="text-3xl md:text-[2.6rem] font-semibold text-center text-white mb-8 tracking-tight leading-tight animate-fade-in-slow">
            O que vamos construir,{" "}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
              Designer?
            </span>
          </h1>

          {/* Config panel */}
          {showConfig && (
            <div className="w-full max-w-[580px] mb-3 rounded-2xl bg-[#161619]/90 backdrop-blur-xl border border-white/[0.06] p-4 space-y-3 animate-slide-up">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block">Referência</label>
                  <input type="url" value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)} placeholder="https://site.com" className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30" />
                </div>
                <div>
                  <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block">Brand</label>
                  <input value={brandReference} onChange={(e) => setBrandReference(e.target.value)} placeholder="Apple, Stripe..." className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30" />
                </div>
              </div>
              <div>
                <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block">Sensação desejada</label>
                <input value={expectations} onChange={(e) => setExpectations(e.target.value)} placeholder="luxo, tecnológico, clean..." className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30" />
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-white/25 uppercase tracking-widest">Cor</span>
                  {COLOR_PRESETS.map((cp, i) => (
                    <button key={i} onClick={() => { setPrimaryColor(cp.primary); setSecondaryColor(cp.secondary); }}
                      className={cn("w-5 h-5 rounded-md border transition-all cursor-pointer hover:scale-110", primaryColor === cp.primary ? "border-white/50 scale-110" : "border-transparent")}
                      style={{ background: `linear-gradient(135deg, ${cp.primary}, ${cp.secondary})` }} />
                  ))}
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-4 h-4 rounded cursor-pointer bg-transparent border-0" />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-white/25 uppercase tracking-widest mr-1">Fonte</span>
                  {FONT_OPTIONS.map((f) => (
                    <button key={f.id} onClick={() => setFontChoice(f.id)}
                      className={cn("px-1.5 py-0.5 rounded text-[9px] cursor-pointer transition-all", fontChoice === f.id ? "bg-purple-500/20 text-purple-400" : "text-white/25 hover:text-white/40")}>{f.label}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[9px] text-white/25 uppercase tracking-widest mr-1">Estilo</span>
                {STYLE_PRESETS.map((s) => (
                  <button key={s.id} onClick={() => setStylePreset(s.id)}
                    className={cn("px-2 py-0.5 rounded text-[9px] cursor-pointer transition-all flex items-center gap-1", stylePreset === s.id ? "bg-purple-500/20 text-purple-400" : "text-white/25 hover:text-white/40")}>
                    {s.icon} {s.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-white/25 uppercase tracking-widest">Imgs</span>
                {images.map((img, i) => (
                  <div key={i} className="relative group">
                    <img src={img.base64} alt="" className="w-8 h-8 rounded-lg object-cover border border-white/10" />
                    <button onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer">×</button>
                  </div>
                ))}
                {images.length < 5 && (
                  <button onClick={() => fileInputRef.current?.click()} className="w-8 h-8 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-white/20 hover:text-purple-400 hover:border-purple-500/30 transition-all cursor-pointer">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
              </div>

              {/* ─── Copy Document ─── */}
              <div className="pt-1 border-t border-white/[0.05]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] text-white/25 uppercase tracking-widest">Copy pronta</span>
                  {copyFileName && (
                    <button onClick={clearCopyDocument} className="text-[9px] text-red-400/60 hover:text-red-400 transition-colors cursor-pointer flex items-center gap-1">
                      <X className="w-2.5 h-2.5" /> Remover
                    </button>
                  )}
                </div>

                {/* Loaded indicator */}
                {copyFileName ? (
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="text-[11px] text-purple-300 truncate flex-1">{copyFileName}</span>
                    <span className="text-[9px] text-white/25">{copyDocument.length.toLocaleString()} chars</span>
                  </div>
                ) : (
                  <>
                    {/* Tabs */}
                    <div className="flex rounded-lg bg-white/[0.04] p-0.5 mb-2">
                      {(["upload", "url"] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => { setCopyTab(tab); setCopyError(null); }}
                          className={cn(
                            "flex-1 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer",
                            copyTab === tab ? "bg-white/[0.08] text-white/70" : "text-white/25 hover:text-white/40"
                          )}
                        >
                          {tab === "upload" ? "Upload .docx / .pdf" : "URL do Google Docs"}
                        </button>
                      ))}
                    </div>

                    {/* Upload tab */}
                    {copyTab === "upload" && (
                      <button
                        onClick={() => docInputRef.current?.click()}
                        disabled={copyUploading}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-white/10 text-white/25 hover:text-purple-400 hover:border-purple-500/30 transition-all cursor-pointer text-[11px] disabled:opacity-50"
                      >
                        {copyUploading
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> Processando…</>
                          : <><FileText className="w-3 h-3" /> Selecionar arquivo</>
                        }
                      </button>
                    )}

                    {/* URL tab */}
                    {copyTab === "url" && (
                      <div className="space-y-1.5">
                        <div className="flex gap-1.5">
                          <input
                            type="url"
                            value={copyUrl}
                            onChange={(e) => setCopyUrl(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleDocUrlImport()}
                            placeholder="https://docs.google.com/document/d/..."
                            className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30 min-w-0"
                          />
                          <button
                            onClick={handleDocUrlImport}
                            disabled={copyUploading || !copyUrl.trim()}
                            className={cn(
                              "shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
                              copyUploading || !copyUrl.trim()
                                ? "bg-white/[0.04] text-white/20 cursor-not-allowed"
                                : "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30"
                            )}
                          >
                            {copyUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Importar"}
                          </button>
                        </div>
                        <p className="text-[9px] text-white/20 leading-relaxed">
                          O documento deve estar público ("Qualquer pessoa com o link").
                        </p>
                      </div>
                    )}
                  </>
                )}

                {copyError && <p className="text-[10px] text-red-400/70 mt-1.5">{copyError}</p>}
                <input ref={docInputRef} type="file" accept=".docx,.pdf" onChange={handleDocFileInput} className="hidden" />
              </div>
            </div>
          )}

          {/* ─── Prompt Bar Pill ─── */}
          <div className="w-full max-w-[580px] animate-fade-in-delay">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-full bg-[#161619]/80 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/50">
              {/* (+) config */}
              <button
                onClick={() => setShowConfig(!showConfig)}
                className={cn(
                  "shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer",
                  showConfig ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.05] text-white/30 hover:bg-white/[0.08] hover:text-white/50"
                )}
              >
                <Plus className={cn("w-4 h-4 transition-transform duration-200", showConfig && "rotate-45")} />
              </button>

              {/* Input */}
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={copyFileName ? `Copy carregada — descreva o estilo desejado…` : "Descreva o layout que você quer criar..."}
                className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/25 focus:outline-none px-1"
                autoFocus
              />

              {/* Doc badge */}
              {copyFileName && (
                <div className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/15 border border-purple-500/25">
                  <FileText className="w-3 h-3 text-purple-400" />
                  <span className="text-[10px] text-purple-300 max-w-[80px] truncate">{copyFileName}</span>
                  <button onClick={clearCopyDocument} className="text-purple-400/50 hover:text-purple-300 cursor-pointer ml-0.5">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              )}

              {/* Platform pill */}
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform)}
                className="shrink-0 bg-white/[0.05] border-0 rounded-full px-3 py-1.5 text-[11px] text-white/40 cursor-pointer focus:outline-none hover:bg-white/[0.08] transition-colors appearance-none pr-6"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L4 4L7 1' stroke='rgba(255,255,255,0.25)' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
              >
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#1a1a1a]">{p.label}</option>
                ))}
              </select>

              {/* Build */}
              <button
                onClick={handleSubmit}
                disabled={isLoading || (!prompt.trim() && !copyDocument.trim() && images.length === 0)}
                className={cn(
                  "shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer",
                  isLoading || (!prompt.trim() && !copyDocument.trim() && images.length === 0)
                    ? "bg-white/[0.05] text-white/15 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/30 hover:scale-105 active:scale-95"
                )}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* ─── Bottom hint ─── */}
        <div className="relative z-10 px-6 pb-5">
          <div className="max-w-[580px] mx-auto text-center">
            <p className="text-[11px] text-white/20">
              Ou escolha um template pronto em{" "}
              <button onClick={() => nav("resources")} className="text-purple-400 hover:text-purple-300 transition-colors cursor-pointer underline underline-offset-2">
                Resources
              </button>
            </p>
          </div>
        </div>
        </>
        )}
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, collapsed, shortcut, onClick }: { icon: React.ReactNode; label: string; active?: boolean; collapsed: boolean; shortcut?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center w-full rounded-xl transition-colors cursor-pointer",
        collapsed ? "justify-center p-2.5" : "gap-2.5 px-2.5 py-2 text-[12px]",
        active ? "bg-white/[0.06] text-[#d1d1d1]" : "text-[#6b6b6b] hover:bg-white/[0.04] hover:text-[#9a9a9a]"
      )}
    >
      {icon}
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
      {!collapsed && shortcut && <span className="text-[10px] text-white/15">{shortcut}</span>}
    </button>
  );
}
