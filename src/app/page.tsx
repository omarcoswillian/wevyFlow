"use client";

import { useState, useCallback, useEffect } from "react";
import { Platform } from "./lib/types";
import { useHistory } from "./lib/history";
import { useProjects, Project, ProjectPage } from "./lib/projects";
import { HomeView, GenerateData } from "./components/HomeView";
import { WorkspaceView } from "./components/WorkspaceView";
import { CommandPalette } from "./components/CommandPalette";
import { ResourcesPage } from "./components/pages/ResourcesPage";
import { ProjectsPage } from "./components/pages/ProjectsPage";
import { ProjectDetailPage } from "./components/pages/ProjectDetailPage";

// Views the app can show
type AppView = "home" | "resources" | "projects-all" | "projects-starred" | "projects-mine" | "projects-shared" | "project-detail" | "workspace";

// Valid hash → view mapping (views that can be restored from URL)
const HASH_VIEW_MAP: Record<string, AppView> = {
  "": "home",
  "home": "home",
  "resources": "resources",
  "projects": "projects-all",
  "projects-all": "projects-all",
  "projects-starred": "projects-starred",
  "projects-mine": "projects-mine",
  "projects-shared": "projects-shared",
};

// View → hash (for URL updates)
const VIEW_HASH_MAP: Partial<Record<AppView, string>> = {
  "home": "",
  "resources": "resources",
  "projects-all": "projects",
  "projects-starred": "projects-starred",
  "projects-mine": "projects-mine",
  "projects-shared": "projects-shared",
};

function getViewFromHash(): AppView {
  if (typeof window === "undefined") return "home";
  const hash = window.location.hash.replace("#", "");
  return HASH_VIEW_MAP[hash] || "home";
}

export default function App() {
  const [view, setView] = useState<AppView>("home");
  const [generatedCode, setGeneratedCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [error, setError] = useState("");
  const [currentPlatform, setCurrentPlatform] = useState<Platform>("html");
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [currentDesignContext, setCurrentDesignContext] = useState<{ primaryColor?: string; secondaryColor?: string; fontChoice?: string; stylePreset?: string } | null>(null);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);

  const [storageToast, setStorageToast] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { addEntry } = useHistory();
  const {
    projects, saveError, createProject, addPageToProject, updatePageCode,
    toggleStar, deleteProject, deletePageFromProject,
  } = useProjects();

  // Sync view from URL hash on mount
  useEffect(() => {
    setView(getViewFromHash());
  }, []);

  // Listen to browser back/forward (popstate)
  useEffect(() => {
    const onPopState = () => {
      const hashView = getViewFromHash();
      setView(hashView);
      if (hashView === "home") {
        setGeneratedCode("");
        setError("");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Show toast on storage errors
  useEffect(() => {
    if (saveError) {
      setStorageToast(saveError);
      const timer = setTimeout(() => setStorageToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [saveError]);

  // Global Cmd+K shortcut for command palette
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

  const handleGenerate = useCallback(
    async (data: GenerateData) => {
      if (isLoading) return;
      setIsLoading(true);
      setCurrentPlatform(data.platform);
      setCurrentPrompt(data.prompt);
      setCurrentDesignContext({ primaryColor: data.primaryColor, secondaryColor: data.secondaryColor, fontChoice: data.fontChoice, stylePreset: data.stylePreset });
      setView("workspace");

      try {
        // Templates prontos — carrega direto sem IA
        if (data.prompt.startsWith("READY:")) {
          const templateId = data.prompt.replace("READY:", "");
          const res = await fetch(`/api/template?id=${templateId}`);
          if (!res.ok) throw new Error("Template nao encontrado");
          const html = await res.text();
          setGeneratedCode(html);
          addEntry({ id: crypto.randomUUID(), prompt: "Template: " + templateId, platform: data.platform, code: html, createdAt: Date.now() });
          if (activeProject) {
            addPageToProject(activeProject.id, { name: "Template: " + templateId, code: html, platform: data.platform });
          }
          return;
        }

        // Geração com IA (usado apenas para refine e prompts personalizados de templates)
        const code = await streamFromAPI("/api/generate", data);
        if (code) {
          addEntry({ id: crypto.randomUUID(), prompt: data.prompt, platform: data.platform, code, createdAt: Date.now() });
          if (activeProject) {
            addPageToProject(activeProject.id, { name: data.prompt.slice(0, 50), code, platform: data.platform });
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, streamFromAPI, addEntry, activeProject, addPageToProject]
  );

  const handleRefine = useCallback(
    async (refinementRequest: string, images?: { name: string; base64: string }[]) => {
      if (!generatedCode || isRefining) return;
      setIsRefining(true);
      try {
        const code = await streamFromAPI("/api/refine", {
          originalCode: generatedCode, refinementRequest, platform: currentPlatform, images: images || [],
          designContext: currentDesignContext,
        });
        if (code) {
          addEntry({ id: crypto.randomUUID(), prompt: `Refinamento: ${refinementRequest}`, platform: currentPlatform, code, createdAt: Date.now() });
          if (activeProject && activePageId) {
            updatePageCode(activeProject.id, activePageId, code);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setIsRefining(false);
      }
    },
    [generatedCode, isRefining, currentPlatform, currentDesignContext, streamFromAPI, addEntry, activeProject, activePageId, updatePageCode]
  );

  const handleBack = useCallback(() => {
    setView("home");
    setGeneratedCode("");
    setError("");
    setActivePageId(null);
    window.history.pushState(null, "", window.location.pathname);
  }, []);

  // Navigation handler — passed to sidebar in HomeView
  const handleNavigate = useCallback((target: AppView) => {
    setView(target);
    // Sync URL hash for bookmarkable navigation + browser back/forward
    const hash = VIEW_HASH_MAP[target];
    if (hash !== undefined) {
      window.history.pushState(null, "", hash ? `#${hash}` : window.location.pathname);
    }
    if (target === "home") {
      setGeneratedCode("");
      setError("");
    }
  }, []);

  // Open a project detail
  const handleOpenProject = useCallback((project: Project) => {
    setActiveProject(project);
    setView("project-detail");
  }, []);

  // Open a page from a project in the workspace
  const handleOpenPage = useCallback((page: ProjectPage) => {
    setGeneratedCode(page.code);
    setCurrentPlatform(page.platform);
    setCurrentPrompt(page.name);
    setActivePageId(page.id);
    setView("workspace");
  }, []);

  // Create new project (modal could be added later, for now use prompt)
  const handleCreateProject = useCallback(() => {
    const name = window.prompt("Nome do projeto:");
    if (!name) return;
    const client = window.prompt("Nome do cliente:") || "Sem cliente";
    const project = createProject(name, client);
    setActiveProject(project);
    setView("project-detail");
  }, [createProject]);

  // Create new page inside project → go to home to build
  const handleCreatePage = useCallback(() => {
    setView("home");
  }, []);

  // Template selected from resources
  const handleTemplateFromResources = useCallback(async (prompt: string) => {
    // Check if it's a ready-made template (starts with "ready-")
    if (prompt.startsWith("READY:")) {
      const templateId = prompt.replace("READY:", "");
      setCurrentPrompt("Template: " + templateId);
      setCurrentPlatform("html");
      setView("workspace");
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

    // Normal AI generation
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
  }, [handleGenerate, addEntry]);

  // Determine which content to render
  const renderMainContent = () => {
    switch (view) {
      case "resources":
        return <ResourcesPage onSelectTemplate={handleTemplateFromResources} />;
      case "projects-all":
        return <ProjectsPage projects={projects} filter="all" onOpenProject={handleOpenProject} onCreateProject={handleCreateProject} onToggleStar={toggleStar} onDeleteProject={deleteProject} />;
      case "projects-starred":
        return <ProjectsPage projects={projects} filter="starred" onOpenProject={handleOpenProject} onCreateProject={handleCreateProject} onToggleStar={toggleStar} onDeleteProject={deleteProject} />;
      case "projects-mine":
        return <ProjectsPage projects={projects} filter="mine" onOpenProject={handleOpenProject} onCreateProject={handleCreateProject} onToggleStar={toggleStar} onDeleteProject={deleteProject} />;
      case "projects-shared":
        return <ProjectsPage projects={projects} filter="shared" onOpenProject={handleOpenProject} onCreateProject={handleCreateProject} onToggleStar={toggleStar} onDeleteProject={deleteProject} />;
      case "project-detail":
        if (!activeProject) return null;
        // Re-fetch project from state to get latest
        const proj = projects.find((p) => p.id === activeProject.id) || activeProject;
        return <ProjectDetailPage project={proj} onBack={() => setView("projects-all")} onOpenPage={handleOpenPage} onCreatePage={handleCreatePage} onDeletePage={(pageId) => deletePageFromProject(proj.id, pageId)} />;
      default:
        return null;
    }
  };

  const commandPaletteEl = (
    <CommandPalette
      open={commandPaletteOpen}
      onClose={() => setCommandPaletteOpen(false)}
      projects={projects}
      onNavigate={handleNavigate}
      onOpenProject={handleOpenProject}
      onCreateProject={handleCreateProject}
      onSelectTemplate={handleTemplateFromResources}
    />
  );

  const storageToastEl = storageToast ? (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-[12px] font-medium backdrop-blur-xl shadow-2xl animate-fade-in-delay max-w-md text-center">
      {storageToast}
    </div>
  ) : null;

  // Workspace view
  if (view === "workspace") {
    return (
      <div className="h-screen overflow-hidden">
        {commandPaletteEl}
        {storageToastEl}
        <WorkspaceView
          code={generatedCode} isLoading={isLoading} isRefining={isRefining}
          platform={currentPlatform} prompt={currentPrompt} error={error}
          onRefine={handleRefine} onBack={handleBack}
        />
      </div>
    );
  }

  // Home view (with sidebar) or content pages
  if (view === "home") {
    return (
      <div className="h-screen overflow-hidden">
        {commandPaletteEl}
        {storageToastEl}
        <HomeView onGenerate={handleGenerate} isLoading={isLoading} onNavigate={handleNavigate} onOpenSearch={() => setCommandPaletteOpen(true)} />
      </div>
    );
  }

  // Content pages with sidebar-like layout
  return (
    <div className="h-screen overflow-hidden">
      {commandPaletteEl}
      {storageToastEl}
      <HomeView onGenerate={handleGenerate} isLoading={isLoading} onNavigate={handleNavigate} onOpenSearch={() => setCommandPaletteOpen(true)} contentOverride={renderMainContent()} activeNav={view} />
    </div>
  );
}
