"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Platform } from "../lib/types";
import { useHistory } from "../lib/history";
import { useProjects, Project, ProjectPage } from "../lib/projects";
import { compactStorage, aggressiveCleanup, formatBytes } from "../lib/storage-compact";
import { GenerateData } from "../components/HomeView";
import { AIProvider, DEFAULT_MODELS, STORAGE_KEY_KEY, STORAGE_PROVIDER_KEY, STORAGE_MODEL_KEY } from "../lib/ai-provider";
import { ImageProvider, DEFAULT_IMAGE_MODELS, IMAGE_STORAGE_KEY, IMAGE_STORAGE_PROVIDER, IMAGE_STORAGE_MODEL } from "../lib/image-ai-provider";
import { NewProjectModal } from "../components/NewProjectModal";
import type { LaunchKit } from "../lib/types-kit";
import { optimizeHtml } from "../lib/html-optimizer";

/* ───────────────────────────────────────────────────────────
   View / Path mapping
   (sidebar/palette use activeNav strings, router uses paths)
   ─────────────────────────────────────────────────────────── */
export type AppView =
  | "home"
  | "resources"
  | "criativos"
  | "lancamentos"
  | "emails"
  | "leads"
  | "paginas"
  | "projects-all"
  | "projects-starred"
  | "projects-mine"
  | "projects-shared"
  | "project-detail"
  | "workspace";

export function viewToPath(view: AppView, projectId?: string): string {
  switch (view) {
    case "home": return "/";
    case "resources": return "/resources";
    case "criativos": return "/criativos";
    case "lancamentos": return "/lancamentos";
    case "emails": return "/emails";
    case "leads": return "/leads";
    case "paginas": return "/paginas";
    case "projects-all": return "/projects";
    case "projects-starred": return "/projects/starred";
    case "projects-mine": return "/projects/mine";
    case "projects-shared": return "/projects/shared";
    case "project-detail": return projectId ? `/projects/${projectId}` : "/projects";
    case "workspace": return "/workspace";
  }
}

/* ───────────────────────────────────────────────────────────
   Context
   ─────────────────────────────────────────────────────────── */
type DesignContext = {
  primaryColor?: string;
  secondaryColor?: string;
  fontChoice?: string;
  stylePreset?: string;
} | null;

interface AppContextValue {
  // projects (from useProjects hook)
  projects: Project[];
  saveError: string | null;
  createProject: (name: string, client: string) => Promise<Project>;
  addPageToProject: (projectId: string, page: Omit<ProjectPage, "id" | "createdAt" | "updatedAt">) => void;
  updatePageCode: (projectId: string, pageId: string, code: string) => void;
  toggleStar: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  deletePageFromProject: (projectId: string, pageId: string) => void;
  updateCoverImage: (projectId: string, file: File) => Promise<void>;

  // generation state
  generatedCode: string;
  isLoading: boolean;
  isRefining: boolean;
  error: string;
  currentPlatform: Platform;
  currentPrompt: string;
  activePageId: string | null;

  // BYOK — text AI
  apiKey: string;
  aiProvider: AIProvider;
  aiModel: string;
  saveApiKey: (key: string, provider: AIProvider, model: string) => void;
  clearApiKey: () => void;

  // BYOK — image AI
  imageApiKey: string;
  imageProvider: ImageProvider;
  imageModel: string;
  saveImageApiKey: (key: string, provider: ImageProvider, model: string) => void;
  clearImageApiKey: () => void;

  // command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // launch kits
  launchKits: LaunchKit[];
  activeLaunchKit: LaunchKit | null;
  showLaunchWizard: boolean;
  setShowLaunchWizard: (open: boolean) => void;
  setActiveLaunchKit: (kit: LaunchKit | null) => void;
  saveLaunchKit: (kit: LaunchKit) => void;
  deleteLaunchKit: (id: string) => void;

  // integrations
  webhookUrl: string;
  setWebhookUrl: (url: string) => void;

  // actions
  navigate: (view: AppView, projectId?: string) => void;
  handleGenerate: (data: GenerateData) => Promise<void>;
  handleRefine: (refinementRequest: string, images?: { name: string; base64: string }[]) => Promise<void>;
  handleBack: () => void;
  handleOpenProject: (project: Project) => void;
  handleOpenPage: (page: ProjectPage) => void;
  handleCreateProject: () => void;
  handleCreatePage: () => void;
  handleTemplateFromResources: (prompt: string) => Promise<void>;
  openCodeInWorkspace: (code: string, prompt?: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside <AppProvider>");
  return ctx;
}

/* ───────────────────────────────────────────────────────────
   Provider
   ─────────────────────────────────────────────────────────── */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [generatedCode, setGeneratedCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState("");
  const [currentPlatform, setCurrentPlatform] = useState<Platform>("html");
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [currentDesignContext, setCurrentDesignContext] = useState<DesignContext>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [storageToast, setStorageToast] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);

  // integrations
  const [webhookUrl, setWebhookUrlState] = useState("");
  const setWebhookUrl = useCallback((url: string) => {
    try { localStorage.setItem("wf_webhook_url", url); } catch {}
    setWebhookUrlState(url);
  }, []);

  // launch kits — persisted to localStorage
  const [launchKits, setLaunchKits] = useState<LaunchKit[]>([]);
  const [activeLaunchKit, setActiveLaunchKit] = useState<LaunchKit | null>(null);
  const [showLaunchWizard, setShowLaunchWizard] = useState(false);

  const saveLaunchKit = useCallback((kit: LaunchKit) => {
    setLaunchKits((prev) => {
      const idx = prev.findIndex((k) => k.id === kit.id);
      const next = idx >= 0
        ? [...prev.slice(0, idx), kit, ...prev.slice(idx + 1)]
        : [...prev, kit];
      try { localStorage.setItem("wf_launch_kits", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const deleteLaunchKit = useCallback((id: string) => {
    setLaunchKits((prev) => {
      const next = prev.filter((k) => k.id !== id);
      try { localStorage.setItem("wf_launch_kits", JSON.stringify(next)); } catch {}
      return next;
    });
    setActiveLaunchKit((prev) => (prev?.id === id ? null : prev));
  }, []);

  // BYOK — text AI (provider + key + model stored in localStorage)
  const [apiKey, setApiKeyState] = useState<string>("");
  const [aiProvider, setAiProviderState] = useState<AIProvider>("anthropic");
  const [aiModel, setAiModelState] = useState<string>("claude-sonnet-4-6");

  // BYOK — image AI
  const [imageApiKey, setImageApiKeyState] = useState<string>("");
  const [imageProvider, setImageProviderState] = useState<ImageProvider>("openai");
  const [imageModel, setImageModelState] = useState<string>("gpt-image-2");

  useEffect(() => {
    try { setLaunchKits(JSON.parse(localStorage.getItem("wf_launch_kits") || "[]")); } catch {}
  }, []);

  useEffect(() => {
    setApiKeyState(localStorage.getItem(STORAGE_KEY_KEY) ?? "");
    setAiProviderState((localStorage.getItem(STORAGE_PROVIDER_KEY) as AIProvider) ?? "anthropic");
    setAiModelState(localStorage.getItem(STORAGE_MODEL_KEY) ?? "claude-sonnet-4-6");
    setImageApiKeyState(localStorage.getItem(IMAGE_STORAGE_KEY) ?? "");
    setImageProviderState((localStorage.getItem(IMAGE_STORAGE_PROVIDER) as ImageProvider) ?? "openai");
    setImageModelState(localStorage.getItem(IMAGE_STORAGE_MODEL) ?? "gpt-image-2");
    setWebhookUrlState(localStorage.getItem("wf_webhook_url") ?? "");
  }, []);

  const saveApiKey = useCallback((key: string, provider: AIProvider, model: string) => {
    localStorage.setItem(STORAGE_KEY_KEY, key);
    localStorage.setItem(STORAGE_PROVIDER_KEY, provider);
    localStorage.setItem(STORAGE_MODEL_KEY, model || DEFAULT_MODELS[provider]);
    setApiKeyState(key);
    setAiProviderState(provider);
    setAiModelState(model || DEFAULT_MODELS[provider]);
  }, []);

  const clearApiKey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_KEY);
    localStorage.removeItem(STORAGE_PROVIDER_KEY);
    localStorage.removeItem(STORAGE_MODEL_KEY);
    setApiKeyState("");
    setAiProviderState("anthropic");
    setAiModelState("claude-sonnet-4-6");
  }, []);

  const saveImageApiKey = useCallback((key: string, provider: ImageProvider, model: string) => {
    localStorage.setItem(IMAGE_STORAGE_KEY, key);
    localStorage.setItem(IMAGE_STORAGE_PROVIDER, provider);
    localStorage.setItem(IMAGE_STORAGE_MODEL, model || DEFAULT_IMAGE_MODELS[provider]);
    setImageApiKeyState(key);
    setImageProviderState(provider);
    setImageModelState(model || DEFAULT_IMAGE_MODELS[provider]);
  }, []);

  const clearImageApiKey = useCallback(() => {
    localStorage.removeItem(IMAGE_STORAGE_KEY);
    localStorage.removeItem(IMAGE_STORAGE_PROVIDER);
    localStorage.removeItem(IMAGE_STORAGE_MODEL);
    setImageApiKeyState("");
    setImageProviderState("openai");
    setImageModelState("gpt-image-2");
  }, []);

  const { addEntry } = useHistory();
  const {
    projects, saveError, createProject, addPageToProject, updatePageCode,
    toggleStar, deleteProject, deletePageFromProject, updateCoverImage,
  } = useProjects();

  /* storage error toast */
  useEffect(() => {
    if (saveError) {
      setStorageToast(saveError);
      const timer = setTimeout(() => setStorageToast(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [saveError]);

  /* silent auto-compaction on mount */
  useEffect(() => {
    const result = compactStorage();
    const saved = result.bytesBefore - result.bytesAfter;
    if (saved > 50 * 1024) {
      setStorageToast(`Espaço liberado: ${formatBytes(saved)} (${result.keysShrunk} entradas otimizadas)`);
      setTimeout(() => setStorageToast(null), 5000);
    }
  }, []);

  /* Cmd+K — toggle palette */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* navigation helper */
  const navigate = useCallback((view: AppView, projectId?: string) => {
    if (view === "home") {
      setGeneratedCode("");
      setError("");
    }
    router.push(viewToPath(view, projectId));
  }, [router]);

  /* streaming helper */
  const streamFromAPI = useCallback(
    async (url: string, body: object): Promise<string> => {
      setError("");
      setGeneratedCode("");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(290000), // 290s — just under server maxDuration=300
      });
      if (!res.ok) {
        let msg = "Erro ao processar";
        try { const data = await res.json(); msg = data.error || msg; } catch {}
        throw new Error(msg);
      }
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Streaming não suportado");
      const decoder = new TextDecoder();
      let fullCode = "";
      let lastUpdate = 0;
      const UPDATE_INTERVAL = 80;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullCode += decoder.decode(value, { stream: true });
          const now = Date.now();
          if (now - lastUpdate >= UPDATE_INTERVAL) {
            lastUpdate = now;
            const snapshot = fullCode;
            startTransition(() => setGeneratedCode(snapshot));
          }
        }
      } catch {
        // Stream aborted mid-way — if meaningful content was generated, use it
        if (fullCode.length > 500) {
          startTransition(() => setGeneratedCode(fullCode));
          setError("Geração parcial — a IA demorou mais que o esperado. O conteúdo foi salvo. Refine via chat ou regenere.");
          return fullCode;
        }
        throw new Error("A geração falhou antes de produzir conteúdo suficiente. Tente novamente.");
      }
      // Final flush
      startTransition(() => setGeneratedCode(fullCode));
      return fullCode;
    },
    []
  );

  /* active project is derived from URL in the detail route — but for
     addPageToProject on generate, we'd need to know which project is active.
     Keep a local ref to the most recently opened project id for that. */
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const handleGenerate = useCallback(
    async (data: GenerateData) => {
      if (isLoading) return;
      setIsLoading(true);
      setCurrentPlatform(data.platform);
      setCurrentPrompt(data.prompt);
      setCurrentDesignContext({
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        fontChoice: data.fontChoice,
        stylePreset: data.stylePreset,
      });
      router.push("/workspace");

      try {
        if (data.prompt.startsWith("READY:")) {
          const templateId = data.prompt.replace("READY:", "");
          const res = await fetch(`/api/template?id=${templateId}`);
          if (!res.ok) throw new Error("Template nao encontrado");
          const rawHtml = await res.text();
          const html = optimizeHtml(rawHtml, { webhookUrl: webhookUrl || undefined });
          setGeneratedCode(html);
          addEntry({ id: crypto.randomUUID(), prompt: "Template: " + templateId, platform: data.platform, code: html, createdAt: Date.now() });
          if (activeProjectId) {
            addPageToProject(activeProjectId, { name: "Template: " + templateId, code: html, platform: data.platform });
          }
          return;
        }

        const rawCode = await streamFromAPI("/api/generate", {
          ...data,
          copyDocument: data.copyDocument || undefined,
          apiKey: apiKey || undefined,
          aiProvider: apiKey ? aiProvider : undefined,
          aiModel: apiKey ? aiModel : undefined,
        });
        // rawCode may be partial (stream aborted but content was salvaged)
        if (rawCode && rawCode.length > 100) {
          const code = optimizeHtml(rawCode, { webhookUrl: webhookUrl || undefined });
          if (code !== rawCode) startTransition(() => setGeneratedCode(code));
          addEntry({ id: crypto.randomUUID(), prompt: data.prompt, platform: data.platform, code, createdAt: Date.now() });
          if (activeProjectId) {
            addPageToProject(activeProjectId, { name: data.prompt.slice(0, 50), code, platform: data.platform });
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, streamFromAPI, addEntry, activeProjectId, addPageToProject, router]
  );

  const handleRefine = useCallback(
    async (refinementRequest: string, images?: { name: string; base64: string }[]) => {
      if (!generatedCode || isRefining) return;
      setIsRefining(true);
      try {
        const rawCode = await streamFromAPI("/api/refine", {
          originalCode: generatedCode,
          refinementRequest,
          platform: currentPlatform,
          images: images || [],
          designContext: currentDesignContext,
          apiKey: apiKey || undefined,
          aiProvider: apiKey ? aiProvider : undefined,
          aiModel: apiKey ? aiModel : undefined,
        });
        if (rawCode) {
          const code = optimizeHtml(rawCode, { webhookUrl: webhookUrl || undefined });
          if (code !== rawCode) startTransition(() => setGeneratedCode(code));
          addEntry({ id: crypto.randomUUID(), prompt: `Refinamento: ${refinementRequest}`, platform: currentPlatform, code, createdAt: Date.now() });
          if (activeProjectId && activePageId) {
            updatePageCode(activeProjectId, activePageId, code);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        setError(msg === "Failed to fetch"
          ? "Erro de conexao com a IA. O template pode ser muito grande — tente um pedido mais simples."
          : msg);
      } finally {
        setIsRefining(false);
      }
    },
    [generatedCode, isRefining, currentPlatform, currentDesignContext, streamFromAPI, addEntry, activeProjectId, activePageId, updatePageCode]
  );

  const handleBack = useCallback(() => {
    setGeneratedCode("");
    setError("");
    setActivePageId(null);
    router.push("/");
  }, [router]);

  const handleOpenProject = useCallback((project: Project) => {
    setActiveProjectId(project.id);
    router.push(`/projects/${project.id}`);
  }, [router]);

  const handleOpenPage = useCallback((page: ProjectPage) => {
    setGeneratedCode(page.code);
    setCurrentPlatform(page.platform);
    setCurrentPrompt(page.name);
    setActivePageId(page.id);
    router.push("/workspace");
  }, [router]);

  const handleCreateProject = useCallback(() => {
    setNewProjectModalOpen(true);
  }, []);

  const handleCreateProjectConfirm = useCallback(async (name: string, client: string) => {
    const project = await createProject(name, client);
    setActiveProjectId(project.id);
    router.push(`/projects/${project.id}`);
  }, [createProject, router]);

  const handleCreatePage = useCallback(() => {
    router.push("/");
  }, [router]);

  const openCodeInWorkspace = useCallback((code: string, prompt?: string) => {
    setGeneratedCode(code);
    setCurrentPrompt(prompt || "");
    setCurrentPlatform("html");
    router.push("/workspace");
  }, [router]);

  const handleTemplateFromResources = useCallback(async (prompt: string) => {
    if (prompt.startsWith("READY:")) {
      const templateId = prompt.replace("READY:", "");
      setCurrentPrompt("Template: " + templateId);
      setCurrentPlatform("html");
      router.push("/workspace");
      setIsLoading(true);
      try {
        const res = await fetch(`/api/template?id=${templateId}`);
        if (!res.ok) throw new Error("Template nao encontrado");
        const rawHtml = await res.text();
        const html = optimizeHtml(rawHtml, { webhookUrl: webhookUrl || undefined });
        setGeneratedCode(html);
        addEntry({ id: crypto.randomUUID(), prompt: "Template: " + templateId, platform: "html", code: html, createdAt: Date.now() });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    handleGenerate({
      prompt,
      platform: "html",
      referenceUrl: "",
      brandReference: "",
      expectations: "",
      primaryColor: "#a78bfa",
      secondaryColor: "#6366f1",
      fontChoice: "sora",
      stylePreset: "dark-premium",
      images: [],
    });
  }, [handleGenerate, addEntry, router]);

  /* Manual compact — exposed via StorageToast */
  const handleManualCompact = useCallback(() => {
    const compact = compactStorage();
    const compacted = compact.bytesBefore - compact.bytesAfter;
    if (compacted < 100 * 1024) {
      const ok = window.confirm(
        "A limpeza leve liberou pouco espaço. Quer apagar o histórico de gerações e drafts antigos?\n\n" +
        "Seus projetos, componentes salvos e o draft atual ficam intactos."
      );
      if (!ok) {
        setStorageToast(`${formatBytes(compacted)} liberados.`);
        setTimeout(() => setStorageToast(null), 4000);
        return;
      }
      const aggressive = aggressiveCleanup(null);
      setStorageToast(`${formatBytes(compacted + aggressive.bytesFreed)} liberados (${aggressive.itemsRemoved} itens removidos).`);
      setTimeout(() => setStorageToast(null), 5000);
      return;
    }
    setStorageToast(`${formatBytes(compacted)} liberados em ${compact.keysShrunk} entradas.`);
    setTimeout(() => setStorageToast(null), 5000);
  }, []);

  const value = useMemo<AppContextValue>(() => ({
    projects, saveError, createProject, addPageToProject, updatePageCode,
    toggleStar, deleteProject, deletePageFromProject, updateCoverImage,
    generatedCode, isLoading, isRefining, error, currentPlatform, currentPrompt, activePageId,
    apiKey, aiProvider, aiModel, saveApiKey, clearApiKey,
    imageApiKey, imageProvider, imageModel, saveImageApiKey, clearImageApiKey,
    commandPaletteOpen, setCommandPaletteOpen,
    launchKits, activeLaunchKit, showLaunchWizard, setShowLaunchWizard,
    setActiveLaunchKit, saveLaunchKit, deleteLaunchKit,
    webhookUrl, setWebhookUrl,
    navigate,
    handleGenerate, handleRefine, handleBack,
    handleOpenProject, handleOpenPage, handleCreateProject, handleCreatePage,
    handleTemplateFromResources, openCodeInWorkspace,
  }), [
    projects, saveError, createProject, addPageToProject, updatePageCode,
    toggleStar, deleteProject, deletePageFromProject, updateCoverImage,
    generatedCode, isLoading, isRefining, error, currentPlatform, currentPrompt, activePageId,
    apiKey, aiProvider, aiModel, saveApiKey, clearApiKey,
    imageApiKey, imageProvider, imageModel, saveImageApiKey, clearImageApiKey,
    commandPaletteOpen, setCommandPaletteOpen,
    launchKits, activeLaunchKit, showLaunchWizard, setShowLaunchWizard, setActiveLaunchKit,
    saveLaunchKit, deleteLaunchKit,
    webhookUrl, setWebhookUrl,
    navigate,
    handleGenerate, handleRefine, handleBack,
    handleOpenProject, handleOpenPage, handleCreateProject, handleCreatePage,
    handleTemplateFromResources, openCodeInWorkspace,
  ]);

  const storageToastIsError = storageToast?.toLowerCase().includes("cheio") || storageToast?.toLowerCase().includes("erro");

  return (
    <AppContext.Provider value={value}>
      {children}
      <NewProjectModal
        open={newProjectModalOpen}
        onClose={() => setNewProjectModalOpen(false)}
        onConfirm={handleCreateProjectConfirm}
      />
      {storageToast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-3 rounded-xl border text-[12px] font-medium backdrop-blur-xl shadow-2xl animate-fade-in-delay max-w-md text-center flex items-center gap-3 ${
          storageToastIsError
            ? "bg-red-500/15 border-red-500/25 text-red-400"
            : "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
        }`}>
          <span>{storageToast}</span>
          {storageToastIsError && (
            <button
              onClick={handleManualCompact}
              className="px-2.5 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
            >
              Liberar espaço
            </button>
          )}
        </div>
      )}
    </AppContext.Provider>
  );
}
