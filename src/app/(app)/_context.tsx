"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
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
import type { LaunchKit } from "../lib/types-kit";
import { emptyBriefing, mergeBriefing, type LaunchBriefing } from "../lib/launch-briefing";

/* ───────────────────────────────────────────────────────────
   View / Path mapping
   (sidebar/palette use activeNav strings, router uses paths)
   ─────────────────────────────────────────────────────────── */
export type AppView =
  | "home"
  | "criativos"
  | "carrossel"
  | "ensaio"
  | "lancamentos"
  | "copy"
  | "emails"
  | "anuncios"
  | "marca";

export function viewToPath(view: AppView, projectId?: string): string {
  switch (view) {
    case "home":
      return "/";
    case "criativos":
      return "/criativos";
    case "carrossel":
      return "/carrossel";
    case "ensaio":
      return "/ensaio";
    case "lancamentos":
      return projectId ? `/lancamentos?projectId=${projectId}` : "/lancamentos";
    case "copy":
      return "/copy";
    case "marca":
      return projectId ? `/marca?projectId=${projectId}` : "/marca";
    case "emails":
      return "/emails";
    case "anuncios":
      return "/anuncios";
  }
}

/* ───────────────────────────────────────────────────────────
   Context
   ─────────────────────────────────────────────────────────── */
interface AppContextValue {
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

  navigate: (view: AppView, projectId?: string) => void;
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

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // launch kits — persisted server-side (projects + launch_kits in Supabase,
  // see src/lib/launches/server.ts). The legacy "wf_launch_kits" localStorage
  // key is intentionally left untouched on disk (never read as source of
  // truth, never migrated) — see project P0 scope notes.
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
    return launch as LaunchKit;
  }, [upsertLaunchKit]);

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
    useState<ImageProvider>("openai");
  const [imageModel, setImageModelState] = useState<string>(
    DEFAULT_IMAGE_MODELS.openai,
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
        "openai",
    );
    setImageModelState(
      localStorage.getItem(IMAGE_STORAGE_MODEL) ?? DEFAULT_IMAGE_MODELS.openai,
    );
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
    setImageProviderState("openai");
    setImageModelState(DEFAULT_IMAGE_MODELS.openai);
  }, []);

  /* Local dev only — the fixed dev session (see /api/dev/auto-signin) expires
   * hourly like any real Supabase session, and there's no working login form
   * in dev to re-trigger it (src/app/login/page.tsx bounces straight to "/").
   * Patching window.fetch here — once, for the whole app — means every API
   * call anywhere (Criativos, exports, emails, etc.) recovers
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
      router.push(viewToPath(view, projectId));
    },
    [router],
  );

  const value = useMemo<AppContextValue>(
    () => ({
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
      navigate,
    }),
    [
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
      launchKits,
      launchKitsLoading,
      launchKitsError,
      reloadLaunchKits,
      activeLaunchKit,
      showLaunchWizard,
      launchWizardProjectId,
      openLaunchByProjectId,
      saveLaunchKit,
      deleteLaunchKit,
      openLaunchWizardForDraft,
      resumeLaunchWizard,
      persistLaunch,
      navigate,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
