"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  startTransition,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Platform } from "../lib/types";
import { useHistory } from "../lib/history";
import { useProjects, Project, ProjectPage } from "../lib/projects";
import {
  compactStorage,
  aggressiveCleanup,
  formatBytes,
} from "../lib/storage-compact";
import { GenerateData } from "../components/HomeView";
import {
  AIProvider,
  DEFAULT_MODELS,
  STORAGE_KEY_KEY,
  STORAGE_PROVIDER_KEY,
  STORAGE_MODEL_KEY,
} from "../lib/ai-provider";
import {
  ImageProvider,
  DEFAULT_IMAGE_MODELS,
  IMAGE_STORAGE_KEY,
  IMAGE_STORAGE_PROVIDER,
  IMAGE_STORAGE_MODEL,
} from "../lib/image-ai-provider";
import { NewProjectModal } from "../components/NewProjectModal";
import type { LaunchKit } from "../lib/types-kit";
import { emptyBriefing, mergeBriefing, type LaunchBriefing } from "../lib/launch-briefing";
import { optimizeHtml } from "../lib/html-optimizer";

/* ───────────────────────────────────────────────────────────
   View / Path mapping
   (sidebar/palette use activeNav strings, router uses paths)
   ─────────────────────────────────────────────────────────── */
export type AppView =
  | "home"
  | "resources"
  | "criativos"
  | "carrossel"
  | "ensaio"
  | "lancamentos"
  | "emails"
  | "leads"
  | "paginas"
  | "marca"
  | "projects-all"
  | "projects-starred"
  | "projects-mine"
  | "projects-shared"
  | "project-detail"
  | "workspace";

export function viewToPath(view: AppView, projectId?: string): string {
  switch (view) {
    case "home":
      return "/";
    case "resources":
      return "/resources";
    case "criativos":
      return "/criativos";
    case "carrossel":
      return "/carrossel";
    case "ensaio":
      return "/ensaio";
    case "lancamentos":
      return projectId ? `/lancamentos?projectId=${projectId}` : "/lancamentos";
    case "marca":
      return projectId ? `/marca?projectId=${projectId}` : "/marca";
    case "emails":
      return "/emails";
    case "leads":
      return "/leads";
    case "paginas":
      return "/paginas";
    case "projects-all":
      return "/projects";
    case "projects-starred":
      return "/projects/starred";
    case "projects-mine":
      return "/projects/mine";
    case "projects-shared":
      return "/projects/shared";
    case "project-detail":
      return projectId ? `/projects/${projectId}` : "/projects";
    case "workspace":
      return "/workspace";
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
  addPageToProject: (
    projectId: string,
    page: Omit<ProjectPage, "id" | "createdAt" | "updatedAt">,
  ) => void;
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
  limitReached: boolean;
  clearLimitReached: () => void;
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
  saveImageApiKey: (
    key: string,
    provider: ImageProvider,
    model: string,
  ) => void;
  clearImageApiKey: () => void;

  // command palette
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // launch kits — persisted server-side via /api/launches (see src/lib/launches/server.ts)
  launchKits: LaunchKit[];
  launchKitsLoading: boolean;
  launchKitsError: string | null;
  reloadLaunchKits: () => Promise<void>;
  activeLaunchKit: LaunchKit | null;
  showLaunchWizard: boolean;
  setShowLaunchWizard: (open: boolean) => void;
  setActiveLaunchKit: (kit: LaunchKit | null) => void;
  openLaunchByProjectId: (projectId: string) => Promise<LaunchKit | null>;
  /** Full-kit save (briefing/strategy/status/assets/brandIdentity/emailSequences) — throws on failure, callers must handle. */
  saveLaunchKit: (kit: LaunchKit) => Promise<LaunchKit>;
  deleteLaunchKit: (projectId: string) => Promise<void>;
  /** Persists a draft launch first (server round-trip), then opens the wizard scoped to it. */
  launchWizardProjectId: string | null;
  openLaunchWizardForDraft: (patch: Partial<LaunchBriefing>) => Promise<LaunchKit>;
  /** Resumes the wizard for an already-persisted draft — no network call, the wizard loads it from `launchKits`. */
  resumeLaunchWizard: (projectId: string) => void;
  /** Low-level create-or-update, no wizard UI side effects — used by Onboarding directly. */
  persistLaunch: (input: {
    projectId?: string | null;
    clientToken?: string;
    briefing: LaunchBriefing;
    strategyId?: LaunchKit["strategyId"];
    status: "draft" | "active";
  }) => Promise<LaunchKit>;

  // integrations
  webhookUrl: string;
  setWebhookUrl: (url: string) => void;

  // actions
  navigate: (view: AppView, projectId?: string) => void;
  handleGenerate: (data: GenerateData) => Promise<void>;
  handleRefine: (
    refinementRequest: string,
    images?: { name: string; base64: string }[],
  ) => Promise<void>;
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
  const [limitReached, setLimitReached] = useState(false);
  const clearLimitReached = useCallback(() => setLimitReached(false), []);
  const [currentPlatform, setCurrentPlatform] = useState<Platform>("html");
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [currentDesignContext, setCurrentDesignContext] =
    useState<DesignContext>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [storageToast, setStorageToast] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [newProjectModalOpen, setNewProjectModalOpen] = useState(false);

  // integrations
  const [webhookUrl, setWebhookUrlState] = useState("");
  const setWebhookUrl = useCallback((url: string) => {
    try {
      localStorage.setItem("wf_webhook_url", url);
    } catch {}
    setWebhookUrlState(url);
  }, []);

  // launch kits — persisted server-side (projects + launch_kits in Supabase,
  // see src/lib/launches/server.ts). The legacy "wf_launch_kits" localStorage
  // key is intentionally left untouched on disk (never read as source of
  // truth, never migrated) — see project P0 scope notes.
  const {
    projects,
    saveError,
    loadProjects,
    createProject,
    addPageToProject,
    updatePageCode,
    toggleStar,
    deleteProject,
    deletePageFromProject,
    updateCoverImage,
  } = useProjects();

  const [launchKits, setLaunchKits] = useState<LaunchKit[]>([]);
  const [launchKitsLoading, setLaunchKitsLoading] = useState(true);
  const [launchKitsError, setLaunchKitsError] = useState<string | null>(null);
  const [activeLaunchKit, setActiveLaunchKit] = useState<LaunchKit | null>(
    null,
  );
  const [showLaunchWizard, setShowLaunchWizard] = useState(false);
  const [launchWizardProjectId, setLaunchWizardProjectId] = useState<string | null>(null);

  const upsertLaunchKit = useCallback((kit: LaunchKit) => {
    setLaunchKits((prev) => {
      const idx = prev.findIndex((k) => k.id === kit.id);
      return idx >= 0
        ? [...prev.slice(0, idx), kit, ...prev.slice(idx + 1)]
        : [kit, ...prev];
    });
  }, []);

  const reloadLaunchKits = useCallback(async () => {
    setLaunchKitsLoading(true);
    try {
      const res = await fetch("/api/launches");
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao carregar lançamentos." }));
        setLaunchKitsError(err.error || "Erro ao carregar lançamentos.");
        return;
      }
      const { launches } = await res.json();
      setLaunchKits((launches as LaunchKit[]) ?? []);
      setLaunchKitsError(null);
    } catch {
      setLaunchKitsError("Erro de conexão ao carregar lançamentos.");
    } finally {
      setLaunchKitsLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadLaunchKits();
  }, [reloadLaunchKits]);

  // Tracks the most recently *dispatched* call by a monotonic id, not by
  // projectId — A→B→A means two in-flight calls share the same projectId
  // ("A"), and comparing by id value alone would let the FIRST call's stale
  // response pass the "still current" check once the user navigates back to
  // A (its projectId coincidentally matches the ref again). Only the call
  // that actually dispatched last is allowed to touch state (see launches
  // review item 2 / A→B→A race).
  const openRequestIdRef = useRef(0);
  const openLaunchByProjectId = useCallback(async (projectId: string): Promise<LaunchKit | null> => {
    const myRequestId = ++openRequestIdRef.current;
    const res = await fetch(`/api/launches/${projectId}`);
    const stillCurrent = openRequestIdRef.current === myRequestId;
    if (!res.ok) {
      if (stillCurrent) setActiveLaunchKit(null);
      return null;
    }
    const { launch } = await res.json();
    if (openRequestIdRef.current !== myRequestId) return launch as LaunchKit;
    upsertLaunchKit(launch);
    setActiveLaunchKit(launch);
    return launch as LaunchKit;
  }, [upsertLaunchKit]);

  /** Full-kit save — used by LaunchHub/BrandIdentityStudio/EmailSequencePanel
   * call sites that already hold a complete, locally-mutated LaunchKit
   * object. Throws on failure; callers decide how to surface that (this
   * function never silently swallows a remote error).
   *
   * Calls are serialized through a single queue (per app instance, not per
   * kit) so an older in-flight save can never resolve after — and clobber
   * — a newer one; LaunchHub fires several of these without awaiting each
   * other (generating → done/error, identity, emails), which raced before
   * this fix (see launches review item 7). */
  const saveLaunchQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  // Bumped at enqueue time (not when the queued network call actually
  // starts) — lets a call detect that a newer save was already dispatched
  // after it, so it can skip applying its own (about-to-be-stale) response
  // to shared state instead of transiently overwriting a more recent
  // optimistic edit the newer call already carries (see launches review
  // item G). The queue above still guarantees writes reach the server in
  // order; this only guards which response gets applied to React state.
  //
  // Keyed by projectId — a single global counter would let a save for kit Y
  // mark an in-flight save for a *different* kit X as stale, discarding a
  // perfectly valid response for X just because Y happened to be saved
  // afterwards (see launches review pendency 6).
  const saveLaunchKitSeqRef = useRef<Map<string, number>>(new Map());
  const saveLaunchKit = useCallback((kit: LaunchKit): Promise<LaunchKit> => {
    const seqMap = saveLaunchKitSeqRef.current;
    const mySeq = (seqMap.get(kit.projectId) ?? 0) + 1;
    seqMap.set(kit.projectId, mySeq);
    const run = async (): Promise<LaunchKit> => {
      const res = await fetch(`/api/launches/${kit.projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefing: kit.briefing,
          strategyId: kit.strategyId,
          status: kit.status,
          assets: kit.assets,
          brandIdentity: kit.brandIdentity ?? null,
          emailSequences: kit.emailSequences ?? null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao salvar lançamento." }));
        throw new Error(err.error || "Erro ao salvar lançamento.");
      }
      const { launch } = await res.json();
      if (mySeq === seqMap.get(kit.projectId)) {
        upsertLaunchKit(launch);
        setActiveLaunchKit((prev) => (prev?.projectId === launch.projectId ? launch : prev));
      }
      return launch as LaunchKit;
    };
    const chained = saveLaunchQueueRef.current.catch(() => {}).then(run);
    // Swallow here too — this ref only tracks "when is the queue free next",
    // the real result/error still flows to this call's own caller via `chained`.
    saveLaunchQueueRef.current = chained.catch(() => {});
    return chained;
  }, [upsertLaunchKit]);

  const deleteLaunchKit = useCallback(async (projectId: string): Promise<void> => {
    const res = await fetch(`/api/launches/${projectId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao excluir lançamento." }));
      throw new Error(err.error || "Erro ao excluir lançamento.");
    }
    setLaunchKits((prev) => prev.filter((k) => k.projectId !== projectId));
    setActiveLaunchKit((prev) => (prev?.projectId === projectId ? null : prev));
  }, []);

  /** Create-or-update a launch: POST (create, deduped by clientToken) when
   * no projectId is known yet, PATCH once one exists. No UI side effects —
   * used directly by both the Home/LaunchWizard flow and Onboarding. */
  const persistLaunch = useCallback(async (input: {
    projectId?: string | null;
    clientToken?: string;
    briefing: LaunchBriefing;
    strategyId?: LaunchKit["strategyId"];
    status: "draft" | "active";
  }): Promise<LaunchKit> => {
    const res = input.projectId
      ? await fetch(`/api/launches/${input.projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ briefing: input.briefing, strategyId: input.strategyId, status: input.status }),
        })
      : await fetch("/api/launches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientToken: input.clientToken,
            briefing: input.briefing,
            strategyId: input.strategyId,
            status: input.status,
          }),
        });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Erro ao salvar lançamento." }));
      throw new Error(err.error || "Erro ao salvar lançamento.");
    }
    const { launch } = await res.json();
    upsertLaunchKit(launch);
    // A new projectId means save_launch just created the project half of
    // the pair — refresh the projects list so it shows up without a reload.
    if (!input.projectId) loadProjects();
    return launch as LaunchKit;
  }, [upsertLaunchKit, loadProjects]);

  /** Persists a draft before opening the wizard — the wizard is scoped to a
   * real, already-persisted projectId from the moment it opens, never to
   * in-memory-only prefill data. */
  // Only alive between the start of one create-draft attempt and its first
  // successful response — reused across retries of THAT attempt (so a
  // double-click or a retry-after-network-error dedupes into one row), then
  // cleared. A later call (a genuinely new launch) always mints a fresh
  // token, so it can never be mistaken by save_launch for an update to a
  // launch that was already created — and possibly already activated —
  // by a previous call. See launches review item 1.
  const draftClientTokenRef = useRef<string>("");
  const openLaunchWizardForDraft = useCallback(async (patch: Partial<LaunchBriefing>): Promise<LaunchKit> => {
    if (!draftClientTokenRef.current) {
      draftClientTokenRef.current = crypto.randomUUID();
    }
    const token = draftClientTokenRef.current;
    const briefing = mergeBriefing(emptyBriefing(), patch);
    const launch = await persistLaunch({ clientToken: token, briefing, status: "draft" });
    if (draftClientTokenRef.current === token) draftClientTokenRef.current = "";
    setLaunchWizardProjectId(launch.projectId);
    setShowLaunchWizard(true);
    return launch;
  }, [persistLaunch]);

  const resumeLaunchWizard = useCallback((projectId: string) => {
    setLaunchWizardProjectId(projectId);
    setShowLaunchWizard(true);
  }, []);

  // BYOK — text AI (provider + key + model stored in localStorage)
  const [apiKey, setApiKeyState] = useState<string>("");
  const [aiProvider, setAiProviderState] = useState<AIProvider>("anthropic");
  const [aiModel, setAiModelState] = useState<string>("claude-sonnet-4-6");

  // BYOK — image AI
  const [imageApiKey, setImageApiKeyState] = useState<string>("");
  const [imageProvider, setImageProviderState] =
    useState<ImageProvider>("gemini");
  const [imageModel, setImageModelState] = useState<string>(
    "gemini-3-pro-image-preview",
  );

  useEffect(() => {
    setApiKeyState(localStorage.getItem(STORAGE_KEY_KEY) ?? "");
    setAiProviderState(
      (localStorage.getItem(STORAGE_PROVIDER_KEY) as AIProvider) ?? "anthropic",
    );
    setAiModelState(
      localStorage.getItem(STORAGE_MODEL_KEY) ?? "claude-sonnet-4-6",
    );
    setImageApiKeyState(localStorage.getItem(IMAGE_STORAGE_KEY) ?? "");
    setImageProviderState(
      (localStorage.getItem(IMAGE_STORAGE_PROVIDER) as ImageProvider) ??
        "gemini",
    );
    setImageModelState(
      localStorage.getItem(IMAGE_STORAGE_MODEL) ?? "gemini-3-pro-image-preview",
    );
    setWebhookUrlState(localStorage.getItem("wf_webhook_url") ?? "");
  }, []);

  const saveApiKey = useCallback(
    (key: string, provider: AIProvider, model: string) => {
      localStorage.setItem(STORAGE_KEY_KEY, key);
      localStorage.setItem(STORAGE_PROVIDER_KEY, provider);
      localStorage.setItem(
        STORAGE_MODEL_KEY,
        model || DEFAULT_MODELS[provider],
      );
      setApiKeyState(key);
      setAiProviderState(provider);
      setAiModelState(model || DEFAULT_MODELS[provider]);
    },
    [],
  );

  const clearApiKey = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_KEY);
    localStorage.removeItem(STORAGE_PROVIDER_KEY);
    localStorage.removeItem(STORAGE_MODEL_KEY);
    setApiKeyState("");
    setAiProviderState("anthropic");
    setAiModelState("claude-sonnet-4-6");
  }, []);

  const saveImageApiKey = useCallback(
    (key: string, provider: ImageProvider, model: string) => {
      localStorage.setItem(IMAGE_STORAGE_KEY, key);
      localStorage.setItem(IMAGE_STORAGE_PROVIDER, provider);
      localStorage.setItem(
        IMAGE_STORAGE_MODEL,
        model || DEFAULT_IMAGE_MODELS[provider],
      );
      setImageApiKeyState(key);
      setImageProviderState(provider);
      setImageModelState(model || DEFAULT_IMAGE_MODELS[provider]);
    },
    [],
  );

  const clearImageApiKey = useCallback(() => {
    localStorage.removeItem(IMAGE_STORAGE_KEY);
    localStorage.removeItem(IMAGE_STORAGE_PROVIDER);
    localStorage.removeItem(IMAGE_STORAGE_MODEL);
    setImageApiKeyState("");
    setImageProviderState("gemini");
    setImageModelState("gemini-3-pro-image-preview");
  }, []);

  const { addEntry } = useHistory();

  /* storage error toast */
  useEffect(() => {
    if (saveError) {
      setStorageToast(saveError);
      const timer = setTimeout(() => setStorageToast(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [saveError]);

  /* Local dev only — the fixed dev session (see /api/dev/auto-signin) expires
   * hourly like any real Supabase session, and there's no working login form
   * in dev to re-trigger it (src/app/login/page.tsx bounces straight to "/").
   * Patching window.fetch here — once, for the whole app — means every API
   * call anywhere (Criativos, exports, landing pages, emails, etc.) recovers
   * from an expired session automatically instead of only whichever single
   * call site happens to have its own retry wrapper. Never runs outside
   * NODE_ENV=development, so production sessions are handled normally. */
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const originalFetch = window.fetch.bind(window);
    let reauthInFlight: Promise<void> | null = null;
    function ensureDevReauth(): Promise<void> {
      if (!reauthInFlight) {
        reauthInFlight = originalFetch("/api/dev/auto-signin")
          .then(() => {})
          .catch(() => {})
          .finally(() => { reauthInFlight = null; });
      }
      return reauthInFlight;
    }
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      let res = await originalFetch(...args);
      if (res.status === 401) {
        const input = args[0];
        const url = typeof input === "string" ? input
          : input instanceof URL ? input.pathname
          : (input as Request).url;
        // Only same-origin API calls — never retry a third-party request
        // that legitimately returns 401 (an external API, a BYOK key check).
        if (url.startsWith("/api/") || url.startsWith(window.location.origin + "/api/")) {
          await ensureDevReauth();
          res = await originalFetch(...args);
        }
      }
      return res;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  /* silent auto-compaction on mount */
  useEffect(() => {
    const result = compactStorage();
    const saved = result.bytesBefore - result.bytesAfter;
    if (saved > 50 * 1024) {
      setStorageToast(
        `Espaço liberado: ${formatBytes(saved)} (${result.keysShrunk} entradas otimizadas)`,
      );
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
  const navigate = useCallback(
    (view: AppView, projectId?: string) => {
      if (view === "home") {
        setGeneratedCode("");
        setError("");
      }
      router.push(viewToPath(view, projectId));
    },
    [router],
  );

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
        let limitReached = false;
        try {
          const data = await res.json();
          msg = data.error || msg;
          limitReached = !!data.limitReached;
        } catch {}
        const err = new Error(msg);
        if (limitReached)
          (err as Error & { limitReached: boolean }).limitReached = true;
        throw err;
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
          setError(
            "Geração parcial — a IA demorou mais que o esperado. O conteúdo foi salvo. Refine via chat ou regenere.",
          );
          return fullCode;
        }
        throw new Error(
          "A geração falhou antes de produzir conteúdo suficiente. Tente novamente.",
        );
      }
      // Final flush
      startTransition(() => setGeneratedCode(fullCode));
      return fullCode;
    },
    [],
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
          const html = optimizeHtml(rawHtml, {
            webhookUrl: webhookUrl || undefined,
          });
          setGeneratedCode(html);
          addEntry({
            id: crypto.randomUUID(),
            prompt: "Template: " + templateId,
            platform: data.platform,
            code: html,
            createdAt: Date.now(),
          });
          if (activeProjectId) {
            addPageToProject(activeProjectId, {
              name: "Template: " + templateId,
              code: html,
              platform: data.platform,
            });
          }
          return;
        }

        const rawCode = await streamFromAPI("/api/generate", {
          ...data,
          copyDocument: data.copyDocument || undefined,
        });
        // rawCode may be partial (stream aborted but content was salvaged)
        if (rawCode && rawCode.length > 100) {
          const code = optimizeHtml(rawCode, {
            webhookUrl: webhookUrl || undefined,
          });
          if (code !== rawCode) startTransition(() => setGeneratedCode(code));
          addEntry({
            id: crypto.randomUUID(),
            prompt: data.prompt,
            platform: data.platform,
            code,
            createdAt: Date.now(),
          });
          if (activeProjectId) {
            addPageToProject(activeProjectId, {
              name: data.prompt.slice(0, 50),
              code,
              platform: data.platform,
            });
          }
        }
      } catch (err) {
        const e = err as Error & { limitReached?: boolean };
        if (e.limitReached) {
          setLimitReached(true);
          setError(e.message || "Limite atingido");
        } else {
          setError(e.message || "Erro desconhecido");
        }
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isLoading,
      streamFromAPI,
      addEntry,
      activeProjectId,
      addPageToProject,
      router,
    ],
  );

  const handleRefine = useCallback(
    async (
      refinementRequest: string,
      images?: { name: string; base64: string }[],
    ) => {
      if (!generatedCode || isRefining) return;
      setIsRefining(true);
      try {
        const rawCode = await streamFromAPI("/api/refine", {
          originalCode: generatedCode,
          refinementRequest,
          platform: currentPlatform,
          images: images || [],
          designContext: currentDesignContext,
        });
        if (rawCode) {
          const code = optimizeHtml(rawCode, {
            webhookUrl: webhookUrl || undefined,
          });
          if (code !== rawCode) startTransition(() => setGeneratedCode(code));
          addEntry({
            id: crypto.randomUUID(),
            prompt: `Refinamento: ${refinementRequest}`,
            platform: currentPlatform,
            code,
            createdAt: Date.now(),
          });
          if (activeProjectId && activePageId) {
            updatePageCode(activeProjectId, activePageId, code);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro desconhecido";
        setError(
          msg === "Failed to fetch"
            ? "Erro de conexao com a IA. O template pode ser muito grande — tente um pedido mais simples."
            : msg,
        );
      } finally {
        setIsRefining(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      generatedCode,
      isRefining,
      currentPlatform,
      currentDesignContext,
      streamFromAPI,
      addEntry,
      activeProjectId,
      activePageId,
      updatePageCode,
    ],
  );

  const handleBack = useCallback(() => {
    setGeneratedCode("");
    setError("");
    setActivePageId(null);
    router.push("/");
  }, [router]);

  const handleOpenProject = useCallback(
    (project: Project) => {
      setActiveProjectId(project.id);
      router.push(`/projects/${project.id}`);
    },
    [router],
  );

  const handleOpenPage = useCallback(
    (page: ProjectPage) => {
      setGeneratedCode(page.code);
      setCurrentPlatform(page.platform);
      setCurrentPrompt(page.name);
      setActivePageId(page.id);
      router.push("/workspace");
    },
    [router],
  );

  const handleCreateProject = useCallback(() => {
    setNewProjectModalOpen(true);
  }, []);

  const handleCreateProjectConfirm = useCallback(
    async (name: string, client: string) => {
      const project = await createProject(name, client);
      setActiveProjectId(project.id);
      router.push(`/projects/${project.id}`);
    },
    [createProject, router],
  );

  const handleCreatePage = useCallback(() => {
    router.push("/");
  }, [router]);

  const openCodeInWorkspace = useCallback(
    (code: string, prompt?: string) => {
      setGeneratedCode(code);
      setCurrentPrompt(prompt || "");
      setCurrentPlatform("html");
      router.push("/workspace");
    },
    [router],
  );

  const handleTemplateFromResources = useCallback(
    async (prompt: string) => {
      if (prompt.startsWith("READY:")) {
        const templateId = prompt.replace("READY:", "");
        const templatePrompt = "Template: " + templateId;
        setCurrentPrompt(templatePrompt);
        setCurrentPlatform("html");
        router.push("/workspace");
        setIsLoading(true);

        // Explicitly picking a template from the gallery means "give me the
        // real thing" — a stale localStorage draft from a previous (possibly
        // broken/outdated) load of this same template must not silently win
        // over the freshly-fetched content (WorkspaceView prefers any draft
        // saved under this exact prompt's key).
        try {
          let h = 0;
          for (let i = 0; i < templatePrompt.length; i++) h = ((h << 5) - h + templatePrompt.charCodeAt(i)) | 0;
          localStorage.removeItem(`wf:draft:${h}`);
        } catch { /* storage unavailable */ }

        try {
          const res = await fetch(`/api/template?id=${templateId}`);
          if (!res.ok) throw new Error("Template nao encontrado");
          const rawHtml = await res.text();
          const html = optimizeHtml(rawHtml, {
            webhookUrl: webhookUrl || undefined,
          });
          setGeneratedCode(html);
          addEntry({
            id: crypto.randomUUID(),
            prompt: "Template: " + templateId,
            platform: "html",
            code: html,
            createdAt: Date.now(),
          });
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [handleGenerate, addEntry, router],
  );

  /* Manual compact — exposed via StorageToast */
  const handleManualCompact = useCallback(() => {
    const compact = compactStorage();
    const compacted = compact.bytesBefore - compact.bytesAfter;
    if (compacted < 100 * 1024) {
      const ok = window.confirm(
        "A limpeza leve liberou pouco espaço. Quer apagar o histórico de gerações e drafts antigos?\n\n" +
          "Seus projetos, componentes salvos e o draft atual ficam intactos.",
      );
      if (!ok) {
        setStorageToast(`${formatBytes(compacted)} liberados.`);
        setTimeout(() => setStorageToast(null), 4000);
        return;
      }
      const aggressive = aggressiveCleanup(null);
      setStorageToast(
        `${formatBytes(compacted + aggressive.bytesFreed)} liberados (${aggressive.itemsRemoved} itens removidos).`,
      );
      setTimeout(() => setStorageToast(null), 5000);
      return;
    }
    setStorageToast(
      `${formatBytes(compacted)} liberados em ${compact.keysShrunk} entradas.`,
    );
    setTimeout(() => setStorageToast(null), 5000);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      projects,
      saveError,
      createProject,
      addPageToProject,
      updatePageCode,
      toggleStar,
      deleteProject,
      deletePageFromProject,
      updateCoverImage,
      generatedCode,
      isLoading,
      isRefining,
      error,
      limitReached,
      clearLimitReached,
      currentPlatform,
      currentPrompt,
      activePageId,
      apiKey,
      aiProvider,
      aiModel,
      saveApiKey,
      clearApiKey,
      imageApiKey,
      imageProvider,
      imageModel,
      saveImageApiKey,
      clearImageApiKey,
      commandPaletteOpen,
      setCommandPaletteOpen,
      launchKits,
      launchKitsLoading,
      launchKitsError,
      reloadLaunchKits,
      activeLaunchKit,
      showLaunchWizard,
      setShowLaunchWizard,
      setActiveLaunchKit,
      openLaunchByProjectId,
      saveLaunchKit,
      deleteLaunchKit,
      launchWizardProjectId,
      openLaunchWizardForDraft,
      resumeLaunchWizard,
      persistLaunch,
      webhookUrl,
      setWebhookUrl,
      navigate,
      handleGenerate,
      handleRefine,
      handleBack,
      handleOpenProject,
      handleOpenPage,
      handleCreateProject,
      handleCreatePage,
      handleTemplateFromResources,
      openCodeInWorkspace,
    }),
    [
      projects,
      saveError,
      createProject,
      addPageToProject,
      updatePageCode,
      toggleStar,
      deleteProject,
      deletePageFromProject,
      updateCoverImage,
      generatedCode,
      isLoading,
      isRefining,
      error,
      limitReached,
      clearLimitReached,
      currentPlatform,
      currentPrompt,
      activePageId,
      apiKey,
      aiProvider,
      aiModel,
      saveApiKey,
      clearApiKey,
      imageApiKey,
      imageProvider,
      imageModel,
      saveImageApiKey,
      clearImageApiKey,
      commandPaletteOpen,
      setCommandPaletteOpen,
      launchKits,
      launchKitsLoading,
      launchKitsError,
      reloadLaunchKits,
      activeLaunchKit,
      showLaunchWizard,
      setShowLaunchWizard,
      setActiveLaunchKit,
      openLaunchByProjectId,
      saveLaunchKit,
      deleteLaunchKit,
      launchWizardProjectId,
      openLaunchWizardForDraft,
      resumeLaunchWizard,
      persistLaunch,
      webhookUrl,
      setWebhookUrl,
      navigate,
      handleGenerate,
      handleRefine,
      handleBack,
      handleOpenProject,
      handleOpenPage,
      handleCreateProject,
      handleCreatePage,
      handleTemplateFromResources,
      openCodeInWorkspace,
    ],
  );

  const storageToastIsError =
    storageToast?.toLowerCase().includes("cheio") ||
    storageToast?.toLowerCase().includes("erro");

  return (
    <AppContext.Provider value={value}>
      {children}
      <NewProjectModal
        open={newProjectModalOpen}
        onClose={() => setNewProjectModalOpen(false)}
        onConfirm={handleCreateProjectConfirm}
      />
      {storageToast && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] px-4 py-3 rounded-xl border text-[12px] font-medium backdrop-blur-xl shadow-2xl animate-fade-in-delay max-w-md text-center flex items-center gap-3 ${
            storageToastIsError
              ? "bg-red-500/15 border-red-500/25 text-red-400"
              : "bg-emerald-500/15 border-emerald-500/25 text-emerald-400"
          }`}
        >
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
