"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Plus,
  Loader2,
  Home,
  Search,
  Layout,
  FolderOpen,
  Star,
  Users,
  Share2,
  PanelLeft,
  FileText,
  X,
  Paintbrush,
  Rocket,
  UserCheck,
  Zap,
  Sprout,
  PlayCircle,
  Repeat,
  ChevronRight,
  ChevronDown,
  Mail,
  Globe,
  TrendingUp,
  LogOut,
  Fingerprint,
  BookOpen,
  ShoppingCart,
  Monitor,
  MessageCircle,
  ClipboardList,
  Tv2,
  Lock,
  Camera,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Platform } from "../lib/types";
import { ApiKeyModal } from "./ApiKeyModal";
import { useAppContext } from "../(app)/_context";
import type { LaunchKit, StrategyId } from "../lib/types-kit";
import type { Project } from "../lib/projects";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNavigate?: (view: any) => void;
  onOpenSearch?: () => void;
  contentOverride?: React.ReactNode;
  activeNav?: string;
  upgradeOpen?: boolean;
  onUpgradeClose?: () => void;
}

const LAUNCH_TYPES = [
  "Perpétuo", "Semente", "Interno", "Externo", "Afiliados", "Pago / VSL",
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

const STRATEGY_ICONS: Record<StrategyId, React.ElementType> = {
  classico: Rocket,
  meteorico: Zap,
  semente: Sprout,
  "pago-vsl": PlayCircle,
  perpetuo: Repeat,
};

const STRATEGY_LABELS: Record<StrategyId, string> = {
  classico: "Clássico",
  meteorico: "Meteórico",
  semente: "Semente",
  "pago-vsl": "Pago / VSL",
  perpetuo: "Perpétuo",
};

export function HomeView({ onGenerate, isLoading, onNavigate, onOpenSearch, contentOverride, activeNav, upgradeOpen: upgradeOpenProp, onUpgradeClose }: HomeViewProps) {
  const nav = onNavigate || (() => {});
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTipo = searchParams.get("tipo") ?? "criativos";
  const { apiKey, aiProvider, aiModel, saveApiKey, clearApiKey, imageApiKey, imageProvider, imageModel, saveImageApiKey, clearImageApiKey, setShowLaunchWizard, launchKits, projects, webhookUrl, setWebhookUrl } = useAppContext();
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [_platform, _setPlatform] = useState<Platform>("html");
  const [referenceUrl, setReferenceUrl] = useState("");
  const [brandReference, _setBrandReference] = useState("");
  const [expectations, _setExpectations] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#a78bfa");
  const [secondaryColor, setSecondaryColor] = useState("#6366f1");
  const [fontChoice, setFontChoice] = useState("sora");
  const [stylePreset, setStylePreset] = useState("dark-premium");
  const [images, setImages] = useState<{ name: string; base64: string }[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [designExpanded, setDesignExpanded] = useState(activeNav === "criativos" || activeNav === "ensaio");
  const [lpExpanded, setLpExpanded] = useState(false);
  const [copyDocument, setCopyDocument] = useState("");
  const [copyFileName, setCopyFileName] = useState<string | null>(null);
  const [copyUploading, setCopyUploading] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyTab, setCopyTab] = useState<"upload" | "url">("upload");
  const [copyUrl, setCopyUrl] = useState("");
  const [bottomTab, setBottomTab] = useState<"kits" | "projetos">("kits");
  const [produto, setProduto] = useState("");
  const [nicho, setNicho] = useState("");
  const [publicoAlvo, setPublicoAlvo] = useState("");
  const [promessa, setPromessa] = useState("");
  const [mecanismo, setMecanismo] = useState("");
  const [preco, setPreco] = useState("");
  const [provas, setProvas] = useState("");
  const [tipoLancamento, setTipoLancamento] = useState("Perpétuo");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const TYPEWRITER_WORDS = ["Projeto", "Lançamento"];
  const [twText, setTwText] = useState("");
  const [twWordIdx, setTwWordIdx] = useState(0);
  const [twDeleting, setTwDeleting] = useState(false);
  useEffect(() => {
    const current = TYPEWRITER_WORDS[twWordIdx];
    let delay: number;
    if (!twDeleting) {
      if (twText.length < current.length) {
        delay = 90 + Math.random() * 40;
        const t = setTimeout(() => setTwText(current.slice(0, twText.length + 1)), delay);
        return () => clearTimeout(t);
      } else {
        delay = 1800;
        const t = setTimeout(() => setTwDeleting(true), delay);
        return () => clearTimeout(t);
      }
    } else {
      if (twText.length > 0) {
        delay = 55;
        const t = setTimeout(() => setTwText(current.slice(0, twText.length - 1)), delay);
        return () => clearTimeout(t);
      } else {
        delay = 320;
        const t = setTimeout(() => {
          setTwDeleting(false);
          setTwWordIdx(i => (i + 1) % TYPEWRITER_WORDS.length);
        }, delay);
        return () => clearTimeout(t);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twText, twDeleting, twWordIdx]);

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
    const briefing = [
      produto && `Produto: ${produto}`,
      nicho && `Nicho: ${nicho}`,
      tipoLancamento && `Tipo de lançamento: ${tipoLancamento}`,
      publicoAlvo && `Público-alvo: ${publicoAlvo}`,
      promessa && `Transformação prometida: ${promessa}`,
      mecanismo && `Mecanismo único: ${mecanismo}`,
      preco && `Preço + âncora: ${preco}`,
      provas && `Provas e resultados: ${provas}`,
    ].filter(Boolean).join("\n");
    const enrichedPrompt = briefing ? `${briefing}\n\n${prompt}`.trim() : prompt;
    onGenerate({ prompt: enrichedPrompt, platform: "html", referenceUrl, brandReference: produto || brandReference, expectations: promessa || expectations, primaryColor, secondaryColor, fontChoice, stylePreset, images, copyDocument: copyDocument.trim() || undefined });
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

  const recentProjects = projects.slice(0, 6);

  // Usage data (only relevant when not using BYOK)
  const [usage, setUsage] = useState<{ creditsUsed: number; creditsLimit: number; planLabel: string; plan: string; month: string } | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setUsage({ creditsUsed: d.creditsUsed, creditsLimit: d.creditsLimit, planLabel: d.planLabel, plan: d.plan, month: d.month }))
      .catch(() => {});
  }, []);

  // Current user info for sidebar avatar + logout
  const [userEmail, setUserEmail] = useState<string | null>(null);
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const handleLogout = useCallback(async () => {
    await createClient().auth.signOut();
    window.location.href = "/login";
  }, []);

  return (
    <div className="flex h-screen bg-[#080809] p-2 gap-2">
      {/* ─── Left Sidebar ─── */}
      <aside className={cn(
        "shrink-0 flex flex-col bg-[#0e0e11] rounded-[20px] z-20 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        sidebarCollapsed ? "w-[56px]" : "w-[220px]"
      )}>
        {/* Logo + toggle */}
        <div className="px-2 pt-3 pb-2">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/IconeAtual3.png" alt="WevyFlow" className="w-8 h-8" />
              <button onClick={() => setSidebarCollapsed(false)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6b6b6b] hover:text-[#9a9a9a] hover:bg-white/[0.06] transition-all cursor-pointer">
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center px-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/IconeAtual3.png" alt="WevyFlow" className="w-7 h-7 shrink-0" />
              <div className="flex-1" />
              <button onClick={() => setSidebarCollapsed(true)} className="w-7 h-7 rounded-lg flex items-center justify-center text-[#6b6b6b] hover:text-[#9a9a9a] hover:bg-white/[0.06] transition-all cursor-pointer">
                <PanelLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto scrollbar-none">
          <SidebarItem icon={<Home className="w-4 h-4" />} label="Home" active={!activeNav || activeNav === "home"} collapsed={sidebarCollapsed} onClick={() => nav("home")} />
          <SidebarItem icon={<Search className="w-4 h-4" />} label="Search" collapsed={sidebarCollapsed} shortcut="⌘K" onClick={onOpenSearch} />

          {/* separator */}
          {!sidebarCollapsed && <div className="pt-3 pb-1"><span className="px-2 text-[9px] font-medium text-white/20 uppercase tracking-widest">Criar</span></div>}
          {sidebarCollapsed && <div className="pt-3" />}

          <SidebarItem icon={<Rocket className="w-4 h-4" />} label="Lançamentos" active={activeNav === "lancamentos"} collapsed={sidebarCollapsed} onClick={() => nav("lancamentos")} accent />
          {/* Landing Pages — accordion */}
          <div>
            <button
              onClick={() => sidebarCollapsed ? nav("resources") : setLpExpanded(p => !p)}
              title={sidebarCollapsed ? "Landing Pages" : undefined}
              className={cn(
                "flex items-center w-full rounded-xl transition-colors cursor-pointer",
                sidebarCollapsed ? "justify-center p-2.5" : "gap-2.5 px-2.5 py-2 text-[12px]",
                activeNav === "resources"
                  ? "bg-white/[0.06] text-[#d1d1d1]"
                  : "text-[#6b6b6b] hover:bg-white/[0.04] hover:text-[#9a9a9a]"
              )}
            >
              <Layout className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">Landing Pages</span>
                  <ChevronDown className={cn("w-3 h-3 text-white/20 transition-transform duration-200", lpExpanded ? "rotate-0" : "-rotate-90")} />
                </>
              )}
            </button>
            {!sidebarCollapsed && lpExpanded && (
              <div className="ml-3 mt-0.5 border-l border-white/[0.06] pl-2 space-y-0.5 pb-1">
                {([
                  { label: "Página de vendas",   icon: <Rocket className="w-3 h-3" />,   categoria: "vendas"  },
                  { label: "Página de captura",  icon: <UserCheck className="w-3 h-3" />, categoria: "captura" },
                  { label: "Página de blog",     icon: <FileText className="w-3 h-3" />,  categoria: "blog"    },
                  { label: "Eventos / Workshop", icon: <Zap className="w-3 h-3" />,       categoria: "evento"  },
                  { label: "Agregadora",         icon: <Globe className="w-3 h-3" />,     categoria: "servico" },
                ]).map((item) => {
                  const isActive = activeNav === "resources" && currentTipo === item.categoria;
                  return (
                    <button key={item.label} onClick={() => router.push(`/resources?categoria=${item.categoria}`)}
                      className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] cursor-pointer transition-colors text-left",
                        isActive ? "bg-white/[0.06] text-white/80" : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]")}>
                      {item.icon}
                      <span className="flex-1 truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* Design — accordion */}
          <div>
            <button
              onClick={() => sidebarCollapsed ? nav("criativos") : setDesignExpanded(p => !p)}
              title={sidebarCollapsed ? "Design" : undefined}
              className={cn(
                "flex items-center w-full rounded-xl transition-colors cursor-pointer",
                sidebarCollapsed ? "justify-center p-2.5" : "gap-2.5 px-2.5 py-2 text-[12px]",
                (activeNav === "criativos" || activeNav === "ensaio")
                  ? "bg-white/[0.06] text-[#d1d1d1]"
                  : "text-[#6b6b6b] hover:bg-white/[0.04] hover:text-[#9a9a9a]"
              )}
            >
              <Paintbrush className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">Design</span>
                  <ChevronDown className={cn("w-3 h-3 text-white/20 transition-transform duration-200", designExpanded ? "rotate-0" : "-rotate-90")} />
                </>
              )}
            </button>
            {!sidebarCollapsed && designExpanded && (
              <div className="ml-3 mt-0.5 border-l border-white/[0.06] pl-2 space-y-0.5 pb-1">
                <p className="text-[8px] font-semibold text-white/20 uppercase tracking-widest px-2 pt-2 pb-0.5">Primário</p>
                {([
                  { label: "KV",                   icon: <Fingerprint className="w-3 h-3" />,  tipo: null,               onClick: () => nav("marca") },
                  { label: "Criativos",            icon: <Paintbrush className="w-3 h-3" />,   tipo: "criativos",        onClick: () => router.push("/criativos?tipo=criativos") },
                  { label: "Ensaio Fotografico",   icon: <Camera className="w-3 h-3" />,        tipo: "ensaio",           onClick: () => router.push("/ensaio") },
                  { label: "Capas dos módulos",    icon: <BookOpen className="w-3 h-3" />,      tipo: "capas-modulos",    onClick: () => router.push("/criativos?tipo=capas-modulos") },
                  { label: "Banner checkout",      icon: <ShoppingCart className="w-3 h-3" />, tipo: "banner-checkout",  onClick: () => router.push("/criativos?tipo=banner-checkout") },
                ]).map((item) => {
                  const isActive = item.tipo === "ensaio"
                    ? activeNav === "ensaio"
                    : activeNav === "criativos" && item.tipo !== null && currentTipo === item.tipo;
                  return (
                    <button key={item.label} onClick={item.onClick}
                      className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] cursor-pointer transition-colors text-left",
                        isActive ? "bg-white/[0.06] text-white/80" : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]")}>
                      {item.icon}
                      <span className="flex-1 truncate">{item.label}</span>
                    </button>
                  );
                })}
                <p className="text-[8px] font-semibold text-white/20 uppercase tracking-widest px-2 pt-3 pb-0.5">Secundário</p>
                {([
                  { label: "PDF / E-book",       icon: <FileText className="w-3 h-3" />,       tipo: "pdf-ebook",        onClick: () => router.push("/criativos?tipo=pdf-ebook") },
                  { label: "Slide",              icon: <Monitor className="w-3 h-3" />,         tipo: "slide",            onClick: () => router.push("/criativos?tipo=slide") },
                  { label: "Thumb YouTube",      icon: <PlayCircle className="w-3 h-3" />,      tipo: "thumb-youtube",    onClick: () => router.push("/criativos?tipo=thumb-youtube") },
                  { label: "Capa YouTube",       icon: <Tv2 className="w-3 h-3" />,             tipo: "capa-youtube",     onClick: () => router.push("/criativos?tipo=capa-youtube") },
                  { label: "WhatsApp API",       icon: <MessageCircle className="w-3 h-3" />,   tipo: "whatsapp-api",     onClick: () => router.push("/criativos?tipo=whatsapp-api") },
                  { label: "Banner e-mail",      icon: <Mail className="w-3 h-3" />,            tipo: "banner-email",     onClick: () => router.push("/criativos?tipo=banner-email") },
                  { label: "Capa de formulário", icon: <ClipboardList className="w-3 h-3" />,   tipo: "capa-formulario",  onClick: () => router.push("/criativos?tipo=capa-formulario") },
                ]).map((item) => {
                  const isActive = activeNav === "criativos" && currentTipo === item.tipo;
                  return (
                    <button key={item.label} onClick={item.onClick}
                      className={cn("flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-[11px] cursor-pointer transition-colors text-left",
                        isActive ? "bg-white/[0.06] text-white/80" : "text-white/40 hover:text-white/70 hover:bg-white/[0.04]")}>
                      {item.icon}
                      <span className="flex-1 truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <SidebarItem icon={<Mail className="w-4 h-4" />} label="Emails" active={activeNav === "emails"} collapsed={sidebarCollapsed} onClick={() => nav("emails")} />
          <SidebarItem icon={<UserCheck className="w-4 h-4" />} label="Leads" active={activeNav === "leads"} collapsed={sidebarCollapsed} onClick={() => nav("leads")} />
          <SidebarItem icon={<Globe className="w-4 h-4" />} label="Domínios" active={activeNav === "paginas"} collapsed={sidebarCollapsed} onClick={() => nav("paginas")} />

          {!sidebarCollapsed && <div className="pt-3 pb-1"><span className="px-2 text-[9px] font-medium text-white/20 uppercase tracking-widest">Projetos</span></div>}
          {sidebarCollapsed && <div className="pt-3" />}

          <SidebarItem icon={<FolderOpen className="w-4 h-4" />} label="Todos" active={activeNav === "projects-all"} collapsed={sidebarCollapsed} onClick={() => nav("projects-all")} />
          <SidebarItem icon={<Star className="w-4 h-4" />} label="Favoritos" active={activeNav === "projects-starred"} collapsed={sidebarCollapsed} onClick={() => nav("projects-starred")} />
          <SidebarItem icon={<Users className="w-4 h-4" />} label="Criados por mim" active={activeNav === "projects-mine"} collapsed={sidebarCollapsed} onClick={() => nav("projects-mine")} />
          <SidebarItem icon={<Share2 className="w-4 h-4" />} label="Compartilhados" active={activeNav === "projects-shared"} collapsed={sidebarCollapsed} onClick={() => nav("projects-shared")} />
        </nav>

        {/* Bottom — Usage + User */}
        <div className="px-2 pb-3 space-y-1.5">
          {/* Usage widget */}
          {!sidebarCollapsed && usage && (() => {
            const pct = Math.min(100, (usage.creditsUsed / usage.creditsLimit) * 100);
            const nearLimit = usage.creditsUsed >= usage.creditsLimit * 0.8;
            const atLimit = usage.creditsUsed >= usage.creditsLimit;
            return (
              <button
                onClick={() => setUpgradeOpen(true)}
                className="w-full px-2.5 py-2 rounded-xl bg-white/[0.025] border border-white/[0.05] hover:border-purple-500/20 hover:bg-white/[0.04] transition-all text-left cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-white/30" />
                    <span className="text-[9px] text-white/30 font-medium uppercase tracking-widest">Plano {usage.planLabel}</span>
                  </div>
                  <span className="text-[9px] text-white/20">{usage.month}</span>
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/50">
                    {usage.creditsUsed} / {usage.creditsLimit} gerações
                  </span>
                  <span className={cn("text-[9px] font-medium", atLimit ? "text-red-400" : nearLimit ? "text-orange-400" : "text-white/25")}>
                    {atLimit ? "Limite atingido" : nearLimit ? `${usage.creditsLimit - usage.creditsUsed} restantes` : `${usage.creditsLimit - usage.creditsUsed} restantes`}
                  </span>
                </div>
                <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", atLimit ? "bg-red-500" : nearLimit ? "bg-orange-400" : "bg-purple-500")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {(nearLimit || atLimit) && (
                  <p className="text-[9px] text-purple-400 mt-1.5 font-medium">Fazer upgrade →</p>
                )}
              </button>
            );
          })()}

          {/* User row */}
          {userEmail && (
            !sidebarCollapsed ? (
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-semibold text-purple-300 uppercase leading-none">
                    {userEmail[0]}
                  </span>
                </div>
                <span className="flex-1 text-[11px] text-white/40 truncate min-w-0">{userEmail}</span>
                <button
                  onClick={handleLogout}
                  title="Sair"
                  className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogout}
                title="Sair"
                className="w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        <ApiKeyModal
          open={apiKeyModalOpen}
          currentKey={apiKey} currentProvider={aiProvider} currentModel={aiModel}
          onSave={saveApiKey} onClear={clearApiKey}
          currentImageKey={imageApiKey} currentImageProvider={imageProvider} currentImageModel={imageModel}
          onSaveImage={saveImageApiKey} onClearImage={clearImageApiKey}
          onClose={() => setApiKeyModalOpen(false)}
        />
      </aside>

      {/* Upgrade modal */}
      {(upgradeOpen || upgradeOpenProp) && (
        <UpgradeModal usage={usage} onClose={() => { setUpgradeOpen(false); onUpgradeClose?.(); }} />
      )}

      {/* ─── Main Area ─── */}
      <main className="flex-1 flex flex-col relative overflow-hidden rounded-[20px] bg-[#0c0c10]">
        {/* Aurora gradient — only on home */}
        {!contentOverride && <div className="aurora-bg" style={{ borderRadius: "20px" }} />}


        {contentOverride ? (
          <div className="flex-1 overflow-y-auto">{contentOverride}</div>
        ) : (
          <div className="relative z-10 flex-1 overflow-y-auto">

            {/* ─── Hero: Prompt area ─── */}
            <div className="flex flex-col items-center justify-center px-6 py-12 min-h-[90vh]">
              <h1 className="text-3xl md:text-[2.6rem] font-semibold text-center text-white mb-8 tracking-tight leading-tight animate-fade-in-slow">
                Vamos construir seu{" "}
                <span className="whitespace-nowrap">
                  <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent">
                    {twText}{twText.length === TYPEWRITER_WORDS[twWordIdx].length && !twDeleting ? "?" : ""}
                  </span>
                  <span className="animate-pulse text-purple-400 font-light">|</span>
                </span>
              </h1>

              {/* Config panel — fluxo normal, empurra a barra pra baixo */}
              {showConfig && (
                <div className="w-full max-w-[580px] mb-3 rounded-2xl bg-[#18181b] border border-white/[0.07] shadow-2xl shadow-black/70 animate-slide-up overflow-y-auto max-h-[62vh]">

                  {/* ── Seção 1: Briefing do produto ── */}
                  <div className="p-4 space-y-3">
                    <p className="text-[9px] uppercase tracking-widest text-white/20 font-semibold">Sobre o produto</p>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block">Nome do produto</label>
                        <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex: Método Alpha" className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors" />
                      </div>
                      <div>
                        <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block">Nicho</label>
                        <input value={nicho} onChange={(e) => setNicho(e.target.value)} placeholder="Ex: Fitness, finanças, desenvolvimento pessoal..." className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors" />
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block">Tipo de lançamento</label>
                      <div className="flex flex-wrap gap-1">
                        {LAUNCH_TYPES.map((t) => (
                          <button key={t} onClick={() => setTipoLancamento(t)}
                            className={cn("px-2 py-1 rounded-md text-[9px] font-medium transition-all cursor-pointer border", tipoLancamento === t ? "bg-purple-500/20 border-purple-500/40 text-purple-300" : "bg-white/[0.03] border-white/[0.06] text-white/30 hover:text-white/50 hover:border-white/[0.10]")}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block">Público-alvo</label>
                      <input value={publicoAlvo} onChange={(e) => setPublicoAlvo(e.target.value)} placeholder="Ex: Empreendedores iniciantes que querem viver de infoprodutos" className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors" />
                    </div>

                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block">Transformação prometida</label>
                      <textarea value={promessa} onChange={(e) => setPromessa(e.target.value)} rows={2} placeholder="Ex: Do zero ao primeiro R$ 10k em 60 dias" className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors resize-none" />
                    </div>
                  </div>

                  {/* ── Seção 1b: Copy — Diagnóstico do produto ── */}
                  <div className="px-4 pb-4 pt-1 border-t border-white/[0.05] space-y-3">
                    <div className="pt-3">
                      <p className="text-[9px] uppercase tracking-widest text-purple-400/60 font-semibold">Copy — Diagnóstico do produto</p>
                      <p className="text-[9px] text-white/20 mt-0.5">Quanto mais detalhado, mais específica e persuasiva será a copy gerada.</p>
                    </div>

                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block">Mecanismo único</label>
                      <textarea value={mecanismo} onChange={(e) => setMecanismo(e.target.value)} rows={2} placeholder="Ex: Método das 3 fases de recondicionamento metabólico — sequência específica que ativa a queima de gordura visceral sem corte calórico agressivo" className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors resize-none" />
                    </div>

                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block">Preço + âncora</label>
                      <input value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="Ex: R$997 — de R$2.997 (parcela em 12x de R$97)" className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors" />
                    </div>

                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block">Provas e resultados</label>
                      <textarea value={provas} onChange={(e) => setProvas(e.target.value)} rows={2} placeholder="Ex: 3.200 alunos. Ana P. (SP): perdeu 14kg em 67 dias. Média: 8,3kg nos primeiros 30 dias." className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors resize-none" />
                    </div>
                  </div>

                  {/* ── Seção 2: Identidade visual ── */}
                  <div className="px-4 pb-4 pt-1 border-t border-white/[0.05] space-y-3">
                    <p className="text-[9px] uppercase tracking-widest text-white/20 font-semibold pt-3">Identidade visual</p>

                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block">Referência visual</label>
                      <input type="url" value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)} placeholder="https://site-de-referencia.com" className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors" />
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
                      <span className="text-[9px] text-white/25 uppercase tracking-widest">Logo / Imgs</span>
                      {images.map((img, i) => (
                        <div key={i} className="relative group">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
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
                  </div>

                  {/* ── Seção 3: Copy ── */}
                  <div className="px-4 pb-4 pt-1 border-t border-white/[0.05]">
                    <div className="flex items-center justify-between mb-2 pt-3">
                      <p className="text-[9px] uppercase tracking-widest text-white/20 font-semibold">Copy pronta</p>
                      {copyFileName && (
                        <button onClick={clearCopyDocument} className="text-[9px] text-red-400/60 hover:text-red-400 transition-colors cursor-pointer flex items-center gap-1">
                          <X className="w-2.5 h-2.5" /> Remover
                        </button>
                      )}
                    </div>
                    {copyFileName ? (
                      <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                        <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="text-[11px] text-purple-300 truncate flex-1">{copyFileName}</span>
                        <span className="text-[9px] text-white/25">{copyDocument.length.toLocaleString()} chars</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex rounded-lg bg-white/[0.04] p-0.5 mb-2">
                          {(["upload", "url"] as const).map((tab) => (
                            <button key={tab} onClick={() => { setCopyTab(tab); setCopyError(null); }}
                              className={cn("flex-1 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer", copyTab === tab ? "bg-white/[0.08] text-white/70" : "text-white/25 hover:text-white/40")}>
                              {tab === "upload" ? "Upload .docx / .pdf" : "URL do Google Docs"}
                            </button>
                          ))}
                        </div>
                        {copyTab === "upload" && (
                          <button onClick={() => docInputRef.current?.click()} disabled={copyUploading}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-white/10 text-white/25 hover:text-purple-400 hover:border-purple-500/30 transition-all cursor-pointer text-[11px] disabled:opacity-50">
                            {copyUploading ? <><Loader2 className="w-3 h-3 animate-spin" /> Processando…</> : <><FileText className="w-3 h-3" /> Selecionar arquivo</>}
                          </button>
                        )}
                        {copyTab === "url" && (
                          <div className="space-y-1.5">
                            <div className="flex gap-1.5">
                              <input type="url" value={copyUrl} onChange={(e) => setCopyUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleDocUrlImport()}
                                placeholder="https://docs.google.com/document/d/..."
                                className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30 min-w-0" />
                              <button onClick={handleDocUrlImport} disabled={copyUploading || !copyUrl.trim()}
                                className={cn("shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer", copyUploading || !copyUrl.trim() ? "bg-white/[0.04] text-white/20 cursor-not-allowed" : "bg-purple-500/20 text-purple-300 hover:bg-purple-500/30")}>
                                {copyUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Importar"}
                              </button>
                            </div>
                            <p className="text-[9px] text-white/20 leading-relaxed">O documento deve estar público (&quot;Qualquer pessoa com o link&quot;).</p>
                          </div>
                        )}
                      </>
                    )}
                    {copyError && <p className="text-[10px] text-red-400/70 mt-1.5">{copyError}</p>}
                    <input ref={docInputRef} type="file" accept=".docx,.pdf" onChange={handleDocFileInput} className="hidden" />
                  </div>

                  {/* ── Seção 4: Integrações ── */}
                  <div className="px-4 pb-4 pt-1 border-t border-white/[0.05]">
                    <p className="text-[9px] uppercase tracking-widest text-white/20 font-semibold pt-3 mb-2">Integrações</p>
                    <label className="text-[9px] uppercase tracking-widest text-white/25 font-medium mb-1 block">Webhook de leads</label>
                    <input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://hooks.activehosted.com/proc.php?..."
                      className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-colors"
                    />
                    <p className="text-[9px] text-white/20 mt-1">ActiveCampaign, Mailchimp, RD Station. Formulários capturarão leads automaticamente.</p>
                  </div>
                </div>
              )}

              {/* Prompt Bar */}
              <div className="w-full max-w-[580px] animate-fade-in-delay">
                <div className="flex items-center gap-2 px-2.5 py-2 rounded-full bg-[#18181b] border border-white/[0.08] shadow-2xl shadow-black/70">
                  <button onClick={() => setShowConfig(!showConfig)} className={cn("shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer", showConfig ? "bg-purple-500/20 text-purple-400" : "bg-white/[0.05] text-white/30 hover:bg-white/[0.08] hover:text-white/50")}>
                    <Plus className={cn("w-4 h-4 transition-transform duration-200", showConfig && "rotate-45")} />
                  </button>
                  <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={handleKeyDown}
                    placeholder={copyFileName ? `Copy carregada — descreva o estilo desejado…` : "Descreva o seu lançamento..."}
                    className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/25 focus:outline-none px-1" autoFocus />
                  {copyFileName && (
                    <div className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/15 border border-purple-500/25">
                      <FileText className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] text-purple-300 max-w-[80px] truncate">{copyFileName}</span>
                      <button onClick={clearCopyDocument} className="text-purple-400/50 hover:text-purple-300 cursor-pointer ml-0.5"><X className="w-2.5 h-2.5" /></button>
                    </div>
                  )}
                  <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
                    <Rocket className="w-3 h-3 text-purple-400" />
                    <span className="text-[11px] text-purple-300 font-medium">Lançamento</span>
                  </div>
                  <button onClick={handleSubmit} disabled={isLoading || (!prompt.trim() && !copyDocument.trim() && images.length === 0)}
                    className={cn("shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all cursor-pointer", isLoading || (!prompt.trim() && !copyDocument.trim() && images.length === 0) ? "bg-white/[0.05] text-white/15 cursor-not-allowed" : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/30 hover:scale-105 active:scale-95")}>
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>{/* end hero */}

            {/* ─── Bottom Shelf — peek no fim do scroll ─── */}
            <div className="px-4 pb-4">
              <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] overflow-hidden">
                {/* tabs row */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/[0.04]">
                  <div className="flex items-center gap-1">
                    {([
                      { id: "kits", label: "Meus Kits" },
                      { id: "projetos", label: "Projetos" },
                    ] as const).map((t) => (
                      <button key={t.id} onClick={() => setBottomTab(t.id)}
                        className={cn("px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                          bottomTab === t.id ? "bg-white/[0.08] text-white/80" : "text-white/30 hover:text-white/50")}>
                        {t.label}
                        {t.id === "kits" && launchKits.length > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[9px]">{launchKits.length}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => bottomTab === "kits" ? nav("lancamentos") : nav("projects-all")}
                    className="flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition-colors cursor-pointer">
                    Ver todos <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* content */}
                <div className="px-3 py-3">
                  {bottomTab === "kits" ? (
                    <KitsRow kits={launchKits} onNew={() => setShowLaunchWizard(true)} onNavigate={() => nav("lancamentos")} />
                  ) : (
                    <ProjectsRow projects={recentProjects} onNew={() => nav("home")} onNavigate={() => nav("projects-all")} />
                  )}
                </div>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

/* ── Kits Row ────────────────────────────────────────────── */
function KitsRow({ kits, onNew, onNavigate }: { kits: LaunchKit[]; onNew: () => void; onNavigate: () => void }) {
  if (kits.length === 0) {
    return (
      <div className="flex items-center gap-4">
        {/* new kit card */}
        <button onClick={onNew}
          className="flex flex-col items-center justify-center gap-2 w-[160px] h-[88px] shrink-0 rounded-xl border border-dashed border-white/[0.08] hover:border-purple-500/30 hover:bg-purple-500/[0.04] transition-all cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-white/[0.04] group-hover:bg-purple-500/10 flex items-center justify-center transition-colors">
            <Plus className="w-4 h-4 text-white/20 group-hover:text-purple-400" />
          </div>
          <span className="text-[11px] text-white/25 group-hover:text-white/50">Novo Kit</span>
        </button>
        <div>
          <p className="text-[12px] font-medium text-white/40 mb-0.5">Nenhum kit criado ainda</p>
          <p className="text-[11px] text-white/25">Crie um kit de lançamento para gerar todos os ativos da sua estratégia automaticamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 overflow-x-auto scrollbar-none pb-1">
      {/* New kit button */}
      <button onClick={onNew}
        className="flex flex-col items-center justify-center gap-1.5 w-[130px] h-[88px] shrink-0 rounded-xl border border-dashed border-white/[0.06] hover:border-purple-500/30 hover:bg-purple-500/[0.04] transition-all cursor-pointer group">
        <div className="w-7 h-7 rounded-full bg-white/[0.03] group-hover:bg-purple-500/10 flex items-center justify-center">
          <Plus className="w-3.5 h-3.5 text-white/20 group-hover:text-purple-400" />
        </div>
        <span className="text-[10px] text-white/25 group-hover:text-white/50">Novo Kit</span>
      </button>

      {kits.slice(0, 5).map((kit) => {
        const Icon = STRATEGY_ICONS[kit.strategyId] ?? Rocket;
        const done = kit.assets.filter((a) => a.status === "done").length;
        const total = kit.assets.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const color = kit.brandInfo.primaryColor || "#a78bfa";

        return (
          <button key={kit.id} onClick={onNavigate}
            className="group relative flex flex-col justify-between w-[160px] h-[88px] shrink-0 rounded-xl overflow-hidden border border-white/[0.04] hover:border-white/[0.12] transition-all cursor-pointer text-left">
            {/* color bg */}
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${color}18 0%, ${color}06 100%)` }} />
            <div className="relative z-10 p-3 flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="p-1 rounded-md" style={{ background: `${color}25` }}>
                  <Icon className="w-3 h-3" style={{ color }} />
                </div>
                <span className="text-[9px] text-white/30 uppercase tracking-wider">{STRATEGY_LABELS[kit.strategyId]}</span>
              </div>
              <p className="text-[11px] font-semibold text-white/80 truncate leading-tight">{kit.brandInfo.productName}</p>
            </div>
            <div className="relative z-10 px-3 pb-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-white/25">{done}/{total} ativos</span>
                <span className="text-[9px] text-white/25">{pct}%</span>
              </div>
              <div className="h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ── Projects Row ────────────────────────────────────────── */
function ProjectsRow({ projects, onNew, onNavigate }: { projects: Project[]; onNew: () => void; onNavigate: () => void }) {
  if (projects.length === 0) {
    return (
      <div className="flex items-center gap-4">
        <button onClick={onNew}
          className="flex flex-col items-center justify-center gap-2 w-[160px] h-[88px] shrink-0 rounded-xl border border-dashed border-white/[0.08] hover:border-purple-500/30 hover:bg-purple-500/[0.04] transition-all cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-white/[0.04] group-hover:bg-purple-500/10 flex items-center justify-center transition-colors">
            <Plus className="w-4 h-4 text-white/20 group-hover:text-purple-400" />
          </div>
          <span className="text-[11px] text-white/25 group-hover:text-white/50">Novo Projeto</span>
        </button>
        <div>
          <p className="text-[12px] font-medium text-white/40 mb-0.5">Nenhum projeto ainda</p>
          <p className="text-[11px] text-white/25">Gere uma landing page e salve em um projeto para acessar aqui.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 overflow-x-auto scrollbar-none pb-1">
      <button onClick={onNew}
        className="flex flex-col items-center justify-center gap-1.5 w-[130px] h-[88px] shrink-0 rounded-xl border border-dashed border-white/[0.06] hover:border-purple-500/30 hover:bg-purple-500/[0.04] transition-all cursor-pointer group">
        <div className="w-7 h-7 rounded-full bg-white/[0.03] group-hover:bg-purple-500/10 flex items-center justify-center">
          <Plus className="w-3.5 h-3.5 text-white/20 group-hover:text-purple-400" />
        </div>
        <span className="text-[10px] text-white/25 group-hover:text-white/50">Novo</span>
      </button>

      {projects.slice(0, 5).map((project) => (
        <button key={project.id} onClick={onNavigate}
          className="group relative flex flex-col justify-between w-[160px] h-[88px] shrink-0 rounded-xl overflow-hidden border border-white/[0.04] hover:border-white/[0.12] transition-all cursor-pointer text-left bg-white/[0.02]">
          {project.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.thumbnail} alt={project.name} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent" />
          )}
          <div className="relative z-10 p-3 flex-1 flex flex-col justify-end">
            <p className="text-[11px] font-semibold text-white/80 truncate">{project.name}</p>
            {project.client && <p className="text-[9px] text-white/30 truncate">{project.client}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}

const UPGRADE_PLANS = [
  { id: "starter", label: "Starter", price: "R$ 97", credits: 20, highlight: false, desc: "Ideal para começar" },
  { id: "pro",     label: "Pro",     price: "R$ 197", credits: 60, highlight: true,  desc: "Melhor custo-benefício" },
  { id: "scale",   label: "Scale",   price: "R$ 397", credits: 150, highlight: false, desc: "Para alto volume" },
] as const;

function UpgradeModal({ usage, onClose }: { usage: { creditsUsed: number; creditsLimit: number; planLabel: string; plan: string } | null; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-[480px] bg-[#0e0e11] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Faça upgrade do seu plano</h2>
              {usage && usage.creditsUsed >= usage.creditsLimit ? (
                <p className="text-sm text-red-400 mt-1">Você atingiu seu limite mensal de {usage.creditsLimit} gerações.</p>
              ) : usage ? (
                <p className="text-sm text-white/40 mt-1">{usage.creditsUsed} / {usage.creditsLimit} gerações usadas este mês.</p>
              ) : null}
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white/60 cursor-pointer transition-colors p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Plans */}
        <div className="p-6 space-y-3">
          {UPGRADE_PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "relative flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all",
                plan.highlight
                  ? "border-purple-500/40 bg-purple-500/[0.07]"
                  : "border-white/[0.06] bg-white/[0.02]"
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-[9px] font-bold text-white uppercase tracking-wide">Popular</span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-white">{plan.label}</span>
                  <span className="text-[10px] text-white/30">{plan.desc}</span>
                </div>
                <span className="text-[11px] text-white/40">{plan.credits} gerações / mês</span>
              </div>
              <div className="text-right">
                <div className="text-base font-bold text-white">{plan.price}</div>
                <div className="text-[10px] text-white/30">/mês</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-6 pb-6">
          <a
            href="https://wa.me/5511999999999?text=Quero%20fazer%20upgrade%20na%20WevyFlow"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm hover:shadow-lg hover:shadow-purple-500/20 transition-all cursor-pointer"
          >
            Entrar em contato para upgrade
          </a>
          <p className="text-center text-[10px] text-white/25 mt-2">Pagamento via PIX, cartão ou boleto. Suporte em até 24h.</p>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, active, collapsed, shortcut, onClick, accent }: { icon: React.ReactNode; label: string; active?: boolean; collapsed: boolean; shortcut?: string; onClick?: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center w-full rounded-xl transition-colors cursor-pointer",
        collapsed ? "justify-center p-2.5" : "gap-2.5 px-2.5 py-2 text-[12px]",
        active
          ? accent ? "bg-purple-500/15 text-purple-300" : "bg-white/[0.06] text-[#d1d1d1]"
          : accent ? "text-purple-400/70 hover:bg-purple-500/10 hover:text-purple-300" : "text-[#6b6b6b] hover:bg-white/[0.04] hover:text-[#9a9a9a]"
      )}
    >
      {icon}
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
      {!collapsed && shortcut && <span className="text-[10px] text-white/15">{shortcut}</span>}
    </button>
  );
}
