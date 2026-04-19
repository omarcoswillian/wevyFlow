// Compacts localStorage by stripping accumulated editor scripts from any stored
// HTML strings. Safe to run anytime — only removes BASE_SCRIPT / IFRAME_VISUAL_EDIT_SCRIPT
// signatures (detected via stripEditorScripts), never user content.
//
// Run on app load to silently shrink legacy entries that piled up before the
// id-based dedup landed. Can also be triggered manually from the storage-error toast.

import { stripEditorScripts } from "./strip-editor-scripts";

interface CompactionResult {
  bytesBefore: number;
  bytesAfter: number;
  keysProcessed: number;
  keysShrunk: number;
}

/**
 * Returns the byte size of a string as it would be stored in localStorage
 * (rough estimate — UTF-16 = 2 bytes per char).
 */
function byteSize(s: string): number {
  return s.length * 2;
}

/**
 * Tries to apply `mutate` to the parsed JSON value. If it shrinks, re-stores it.
 * Returns the bytes saved (0 if no change or parse failed).
 */
function shrinkJsonKey(key: string, mutate: (value: unknown) => unknown): number {
  const raw = localStorage.getItem(key);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw);
    const cleaned = mutate(parsed);
    const next = JSON.stringify(cleaned);
    if (next.length >= raw.length) return 0;
    localStorage.setItem(key, next);
    return byteSize(raw) - byteSize(next);
  } catch {
    return 0;
  }
}

/**
 * Tries to strip editor scripts from a raw string value (e.g. draft HTML).
 * Returns bytes saved.
 */
function shrinkStringKey(key: string): number {
  const raw = localStorage.getItem(key);
  if (!raw) return 0;
  const next = stripEditorScripts(raw);
  if (next.length >= raw.length) return 0;
  localStorage.setItem(key, next);
  return byteSize(raw) - byteSize(next);
}

export function compactStorage(): CompactionResult {
  const result: CompactionResult = {
    bytesBefore: 0,
    bytesAfter: 0,
    keysProcessed: 0,
    keysShrunk: 0,
  };

  if (typeof localStorage === "undefined") return result;

  // Snapshot keys first — we mutate as we go.
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) keys.push(k);
  }

  for (const key of keys) {
    const before = localStorage.getItem(key);
    if (!before) continue;
    result.bytesBefore += byteSize(before);
    result.keysProcessed += 1;
    let saved = 0;

    if (key.startsWith("wf:draft:")) {
      // Raw HTML draft string
      saved = shrinkStringKey(key);
    } else if (key === "wevyflow-projects") {
      // Array of projects, each has pages[] with code (HTML)
      saved = shrinkJsonKey(key, (v) => {
        if (!Array.isArray(v)) return v;
        return v.map((proj: Record<string, unknown>) => {
          if (!proj || !Array.isArray(proj.pages)) return proj;
          return {
            ...proj,
            pages: proj.pages.map((pg: Record<string, unknown>) => {
              if (typeof pg.code !== "string") return pg;
              return { ...pg, code: stripEditorScripts(pg.code) };
            }),
          };
        });
      });
    } else if (key === "wevyflow-history") {
      // Array of HistoryEntry { code: string }
      saved = shrinkJsonKey(key, (v) => {
        if (!Array.isArray(v)) return v;
        return v.map((entry: Record<string, unknown>) => {
          if (typeof entry.code !== "string") return entry;
          return { ...entry, code: stripEditorScripts(entry.code) };
        });
      });
    } else if (key === "wevyflow-components") {
      // Array of SavedComponent { html: string }
      saved = shrinkJsonKey(key, (v) => {
        if (!Array.isArray(v)) return v;
        return v.map((cmp: Record<string, unknown>) => {
          if (typeof cmp.html !== "string") return cmp;
          return { ...cmp, html: stripEditorScripts(cmp.html) };
        });
      });
    }

    if (saved > 0) result.keysShrunk += 1;
    const after = localStorage.getItem(key);
    if (after) result.bytesAfter += byteSize(after);
  }

  return result;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Aggressive cleanup for when compactStorage isn't enough:
 *  - Wipes wevyflow-history entirely (the user can regenerate templates)
 *  - Removes all wf:draft:* drafts EXCEPT the one matching `keepDraftKey`
 *
 * Does NOT touch wevyflow-projects (user's saved work) or wevyflow-components
 * (saved component library). Returns bytes freed.
 */
export function aggressiveCleanup(keepDraftKey: string | null): { bytesFreed: number; itemsRemoved: number } {
  if (typeof localStorage === "undefined") return { bytesFreed: 0, itemsRemoved: 0 };

  let bytesFreed = 0;
  let itemsRemoved = 0;

  // History: full wipe
  const histRaw = localStorage.getItem("wevyflow-history");
  if (histRaw) {
    bytesFreed += histRaw.length * 2;
    itemsRemoved += 1;
    localStorage.removeItem("wevyflow-history");
  }

  // Drafts: remove all except the active one
  const draftKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("wf:draft:") && k !== keepDraftKey) draftKeys.push(k);
  }
  for (const k of draftKeys) {
    const v = localStorage.getItem(k);
    if (v) bytesFreed += v.length * 2;
    localStorage.removeItem(k);
    itemsRemoved += 1;
  }

  return { bytesFreed, itemsRemoved };
}
