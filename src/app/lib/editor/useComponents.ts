"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

export interface SavedComponent {
  id: string;
  name: string;
  html: string;
  tag: string;
  createdAt: number;
  updatedAt: number;
}

type Row = Database["public"]["Tables"]["saved_components"]["Row"];

function mapRow(row: Row): SavedComponent {
  return {
    id: row.id,
    name: row.name,
    html: row.html,
    tag: row.tag,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// Strip editor-only attributes before saving so instances start clean.
function cleanHtml(html: string): string {
  return html
    .replace(/\s+data-wf-id="[^"]*"/g, "")
    .replace(/\s+data-wf-name="[^"]*"/g, "")
    .replace(/\s+data-wf-hidden="[^"]*"/g, "")
    .replace(/\s+data-wf-prev-display="[^"]*"/g, "");
}

/** Reusable HTML blocks the user saves from the Workspace editor's Library
 * panel — persisted to Supabase (`saved_components`) instead of the old
 * "wevyflow-components" localStorage key, which was lost on any browser
 * switch/clear. Global per user, like the editor's color swatches. */
export function useComponents() {
  const supabase = useMemo(() => createClient(), []);
  const [components, setComponents] = useState<SavedComponent[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("saved_components")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setComponents(data.map(mapRow));
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const add = useCallback(async (name: string, html: string, tag: string): Promise<SavedComponent | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("saved_components")
      .insert({ user_id: user.id, name: name.trim() || "Sem nome", html: cleanHtml(html), tag })
      .select()
      .single();
    if (error || !data) return null;
    const item = mapRow(data);
    setComponents((prev) => [item, ...prev]);
    return item;
  }, [supabase]);

  const remove = useCallback(async (id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
    await supabase.from("saved_components").delete().eq("id", id);
  }, [supabase]);

  const rename = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setComponents((prev) => prev.map((c) => c.id === id ? { ...c, name: trimmed, updatedAt: Date.now() } : c));
    await supabase.from("saved_components").update({ name: trimmed }).eq("id", id);
  }, [supabase]);

  return { components, add, remove, rename };
}
