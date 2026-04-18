"use client";

import { useState, useEffect, useCallback } from "react";

export interface SavedComponent {
  id: string;
  name: string;
  html: string;
  tag: string;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "wevyflow-components";

function load(): SavedComponent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(items: SavedComponent[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error("[WevyFlow] Erro ao salvar componente:", err);
  }
}

function makeId() {
  return "cmp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Strip editor-only attributes before saving so instances start clean.
function cleanHtml(html: string): string {
  return html
    .replace(/\s+data-wf-id="[^"]*"/g, "")
    .replace(/\s+data-wf-name="[^"]*"/g, "")
    .replace(/\s+data-wf-hidden="[^"]*"/g, "")
    .replace(/\s+data-wf-prev-display="[^"]*"/g, "");
}

export function useComponents() {
  const [components, setComponents] = useState<SavedComponent[]>([]);

  useEffect(() => { setComponents(load()); }, []);

  const add = useCallback((name: string, html: string, tag: string): SavedComponent => {
    const now = Date.now();
    const item: SavedComponent = {
      id: makeId(),
      name: name.trim() || "Sem nome",
      html: cleanHtml(html),
      tag,
      createdAt: now,
      updatedAt: now,
    };
    setComponents((prev) => {
      const next = [item, ...prev];
      save(next);
      return next;
    });
    return item;
  }, []);

  const remove = useCallback((id: string) => {
    setComponents((prev) => {
      const next = prev.filter((c) => c.id !== id);
      save(next);
      return next;
    });
  }, []);

  const rename = useCallback((id: string, name: string) => {
    setComponents((prev) => {
      const next = prev.map((c) => c.id === id ? { ...c, name: name.trim() || c.name, updatedAt: Date.now() } : c);
      save(next);
      return next;
    });
  }, []);

  return { components, add, remove, rename };
}
