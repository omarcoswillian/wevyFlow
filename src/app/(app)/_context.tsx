"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Platform } from "../lib/types";
import { useHistory } from "../lib/history";
import { useProjects, Project, ProjectPage } from "../lib/projects";
import { compactStorage, aggressiveCleanup, formatBytes } from "../lib/storage-compact";
import { GenerateData } from "../components/HomeView";
import { AIProvider, DEFAULT_MODELS, STORAGE_KEY_KEY, STORAGE_PROVIDER_KEY, STORAGE_MODEL_KEY } from "../lib/ai-provider";

/* ───────────────────────────────────────────────────────────
   View / Path mapping
   (sidebar/palette use activeNav strings, router uses paths)
   ─────────────────────────────────────────────────────────── */
export type AppView =
  | "home"
  | "resources"
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
  createProject: (name: string, client: string) => Project;
  addPageToProject: (projectId: string, page: Omit<ProjectPage, "id" | "createdAt" | "updatedAt">) => void;
  updatePageCode: (projectId: string, pageId: string, code: string) => void;
  toggleStar: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  deletePageFromProject: (projectId: string, pageId: string) => void;

  // generation state
  generatedCode: string;
  isLoading: boolean;
  isRefining: boolean;
  error: string;
  currentPlatform: Platform;
  currentPrompt: string;
  activePageId: string | null;

  // BYOK
  apiKey: string;
  aiProvider: AIProvider;
  aiModel: string;
  saveApiKey: (key: string, provider: AIProvider, model: string) => void;
  clearApiKey: () => void;

  // command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

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

  // BYOK — provider + key + model stored in localStorage
  const [apiKey, setApiKeyState] = useState<string>("");
  const [aiProvider, setAiProviderState] = useState<AIProvider>("anthropic");
  const [aiModel, setAiModelState] = useState<string>("claude-sonnet-4-6");

  useEffect(() => {
    setApiKeyState(localStorage.getItem(STORAGE_KEY_KEY) ?? "");
    setAiProviderState((localStorage.getItem(STORAGE_PROVIDER_KEY) as AIProvider) ?? "anthropic");
    setAiModelState(localStorage.getItem(STORAGE_MODEL_KEY) ?? "claude-sonnet-4-6");
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

  const { addEntry } = useHistory();
  const {
    projects, saveError, createProject, addPageToProject, updatePageCode,
    toggleStar, deleteProject, deletePageFromProject,
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
        signal: AbortSignal.timeout(120000),
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
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullCode += decoder.decode(value, { stream: true });
        setGeneratedCode(fullCode);
      }
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
          const html = await res.text();
          setGeneratedCode(html);
          addEntry({ id: crypto.randomUUID(), prompt: "Template: " + templateId, platform: data.platform, code: html, createdAt: Date.now() });
          if (activeProjectId) {
            addPageToProject(activeProjectId, { name: "Template: " + templateId, code: html, platform: data.platform });
          }
          return;
        }

        const code = await streamFromAPI("/api/generate", {
          ...data,
          apiKey: apiKey || undefined,
          aiProvider: apiKey ? aiProvider : undefined,
          aiModel: apiKey ? aiModel : undefined,
        });
        if (code) {
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
        const code = await streamFromAPI("/api/refine", {
          originalCode: generatedCode,
          refinementRequest,
          platform: currentPlatform,
          images: images || [],
          designContext: currentDesignContext,
          apiKey: apiKey || undefined,
          aiProvider: apiKey ? aiProvider : undefined,
          aiModel: apiKey ? aiModel : undefined,
        });
        if (code) {
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
    const name = window.prompt("Nome do projeto:");
    if (!name) return;
    const client = window.prompt("Nome do cliente:") || "Sem cliente";
    const project = createProject(name, client);
    setActiveProjectId(project.id);
    router.push(`/projects/${project.id}`);
  }, [createProject, router]);

  const handleCreatePage = useCallback(() => {
    router.push("/");
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
        const html = await res.text();
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
    toggleStar, deleteProject, deletePageFromProject,
    generatedCode, isLoading, isRefining, error, currentPlatform, currentPrompt, activePageId,
    apiKey, aiProvider, aiModel, saveApiKey, clearApiKey,
    commandPaletteOpen, setCommandPaletteOpen,
    navigate,
    handleGenerate, handleRefine, handleBack,
    handleOpenProject, handleOpenPage, handleCreateProject, handleCreatePage,
    handleTemplateFromResources,
  }), [
    projects, saveError, createProject, addPageToProject, updatePageCode,
    toggleStar, deleteProject, deletePageFromProject,
    generatedCode, isLoading, isRefining, error, currentPlatform, currentPrompt, activePageId,
    apiKey, aiProvider, aiModel, saveApiKey, clearApiKey,
    commandPaletteOpen,
    navigate,
    handleGenerate, handleRefine, handleBack,
    handleOpenProject, handleOpenPage, handleCreateProject, handleCreatePage,
    handleTemplateFromResources,
  ]);

  const storageToastIsError = storageToast?.toLowerCase().includes("cheio") || storageToast?.toLowerCase().includes("erro");

  return (
    <AppContext.Provider value={value}>
      {children}
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
