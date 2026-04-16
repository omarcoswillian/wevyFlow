"use client";

import { useState, useEffect, useCallback } from "react";

export interface ProjectPage {
  id: string;
  name: string;
  code: string;
  platform: "html" | "elementor" | "webflow";
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  pages: ProjectPage[];
  thumbnail: string; // first 200 chars of first page code
  starred: boolean;
  createdBy: "me" | "shared";
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "wavyflow-projects";
const STORAGE_VERSION_KEY = "wavyflow-projects-version";

function load(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(projects: Project[]): boolean {
  try {
    const version = Date.now().toString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    localStorage.setItem(STORAGE_VERSION_KEY, version);
    return true;
  } catch (err) {
    const isQuota = err instanceof DOMException && (err.code === 22 || err.code === 1014 || err.name === "QuotaExceededError");
    console.error("[WavyFlow] Erro ao salvar projetos:", isQuota ? "Armazenamento cheio" : err);
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("wavyflow-storage-error", {
        detail: { type: isQuota ? "quota" : "unknown", message: isQuota ? "Armazenamento local cheio. Exclua projetos antigos para liberar espaço." : "Erro ao salvar dados localmente." },
      }));
    }
    return false;
  }
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => { setProjects(load()); }, []);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { setProjects(JSON.parse(e.newValue)); } catch {}
      }
    };
    const handleSaveError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSaveError(detail?.message || "Erro ao salvar");
      setTimeout(() => setSaveError(null), 5000);
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("wavyflow-storage-error", handleSaveError);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("wavyflow-storage-error", handleSaveError);
    };
  }, []);

  const createProject = useCallback((name: string, client: string): Project => {
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      client,
      pages: [],
      thumbnail: "",
      starred: false,
      createdBy: "me",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setProjects((prev) => {
      const next = [project, ...prev];
      save(next);
      return next;
    });
    return project;
  }, []);

  const addPageToProject = useCallback((projectId: string, page: Omit<ProjectPage, "id" | "createdAt" | "updatedAt">) => {
    setProjects((prev) => {
      const next = prev.map((p) => {
        if (p.id !== projectId) return p;
        const newPage: ProjectPage = {
          ...page,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const updated = {
          ...p,
          pages: [...p.pages, newPage],
          thumbnail: page.code.slice(0, 200),
          updatedAt: Date.now(),
        };
        return updated;
      });
      save(next);
      return next;
    });
  }, []);

  const updatePageCode = useCallback((projectId: string, pageId: string, code: string) => {
    setProjects((prev) => {
      const next = prev.map((p) => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          pages: p.pages.map((pg) => pg.id === pageId ? { ...pg, code, updatedAt: Date.now() } : pg),
          thumbnail: code.slice(0, 200),
          updatedAt: Date.now(),
        };
      });
      save(next);
      return next;
    });
  }, []);

  const toggleStar = useCallback((projectId: string) => {
    setProjects((prev) => {
      const next = prev.map((p) => p.id === projectId ? { ...p, starred: !p.starred } : p);
      save(next);
      return next;
    });
  }, []);

  const deleteProject = useCallback((projectId: string) => {
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== projectId);
      save(next);
      return next;
    });
  }, []);

  const deletePageFromProject = useCallback((projectId: string, pageId: string) => {
    setProjects((prev) => {
      const next = prev.map((p) => {
        if (p.id !== projectId) return p;
        return { ...p, pages: p.pages.filter((pg) => pg.id !== pageId), updatedAt: Date.now() };
      });
      save(next);
      return next;
    });
  }, []);

  return {
    projects,
    saveError,
    createProject,
    addPageToProject,
    updatePageCode,
    toggleStar,
    deleteProject,
    deletePageFromProject,
  };
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}
