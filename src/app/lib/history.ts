"use client";

import { useState, useEffect, useCallback } from "react";
import { HistoryEntry } from "./types";

const STORAGE_KEY = "wavyflow-history";
const MAX_ENTRIES = 20;

function loadEntries(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveEntries(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    const isQuota = err instanceof DOMException && (err.code === 22 || err.code === 1014 || err.name === "QuotaExceededError");
    console.error("[WavyFlow] Erro ao salvar histórico:", isQuota ? "Armazenamento cheio" : err);
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("wavyflow-storage-error", {
        detail: { type: isQuota ? "quota" : "unknown", message: isQuota ? "Armazenamento local cheio. Limpe o histórico para liberar espaço." : "Erro ao salvar histórico." },
      }));
    }
  }
}

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  const addEntry = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => {
      const next = [entry, ...prev].slice(0, MAX_ENTRIES);
      saveEntries(next);
      return next;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveEntries(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setEntries([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { entries, addEntry, removeEntry, clearHistory };
}
