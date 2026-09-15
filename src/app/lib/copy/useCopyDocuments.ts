"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import type { AdCopyOption } from "./generate-ads";

type Row = Database["public"]["Tables"]["copy_documents"]["Row"];

export interface CopyDocument {
  id: string;
  projectId: string | null;
  type: "ads";
  title: string;
  status: "draft" | "approved";
  context: Record<string, unknown>;
  options: AdCopyOption[];
  selected: { headline: string; cta: string } | null;
  model: string | null;
  createdAt: number;
  updatedAt: number;
}

function mapRow(row: Row): CopyDocument {
  return {
    id: row.id,
    projectId: row.project_id,
    type: "ads",
    title: row.title,
    status: row.status === "approved" ? "approved" : "draft",
    context: row.context ?? {},
    options: (row.options as unknown as AdCopyOption[]) ?? [],
    selected: (row.selected as { headline: string; cta: string } | null) ?? null,
    model: row.model,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

/** Copy documents (headline+CTA options, and future carrossel/página copy)
 * persisted to Supabase so a generation survives closing the tab — see
 * memória project-copy-vs-design-architecture. Global per user, optionally
 * scoped to a launch (projectId). */
export function useCopyDocuments(projectId?: string) {
  const supabase = useMemo(() => createClient(), []);
  const [documents, setDocuments] = useState<CopyDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const runQuery = () => {
      let query = supabase.from("copy_documents").select("*").order("updated_at", { ascending: false });
      if (projectId) query = query.eq("project_id", projectId);
      return query;
    };
    let { data, error } = await runQuery();
    if (error) {
      // The local dev session occasionally hiccups on an expired/refreshing
      // token (AuthRetryableFetchError) under memory pressure — one retry
      // after a short delay self-heals without surfacing a scary empty list.
      console.error("[useCopyDocuments] load() failed, retrying once:", error);
      await new Promise((r) => setTimeout(r, 500));
      ({ data, error } = await runQuery());
      if (error) console.error("[useCopyDocuments] load() retry also failed:", error);
    }
    if (data) setDocuments(data.map(mapRow));
    setLoading(false);
  }, [supabase, projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const save = useCallback(async (input: {
    title: string;
    context: Record<string, unknown>;
    options: AdCopyOption[];
    selected?: { headline: string; cta: string } | null;
    model?: string;
    projectId?: string | null;
  }): Promise<CopyDocument | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("copy_documents")
      .insert({
        user_id: user.id,
        project_id: input.projectId ?? projectId ?? null,
        type: "ads",
        title: input.title,
        context: input.context,
        options: input.options as unknown as Record<string, unknown>[],
        selected: (input.selected ?? null) as Record<string, unknown> | null,
        model: input.model ?? null,
      })
      .select("*")
      .single();
    if (error || !data) return null;
    const doc = mapRow(data);
    setDocuments((prev) => [doc, ...prev]);
    return doc;
  }, [supabase, projectId]);

  const update = useCallback(async (id: string, patch: Partial<{
    title: string;
    status: "draft" | "approved";
    selected: { headline: string; cta: string } | null;
  }>): Promise<boolean> => {
    const { error } = await supabase
      .from("copy_documents")
      .update({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.selected !== undefined ? { selected: patch.selected } : {}),
      })
      .eq("id", id);
    if (error) return false;
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: Date.now() } : d)));
    return true;
  }, [supabase]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("copy_documents").delete().eq("id", id);
    if (error) return false;
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    return true;
  }, [supabase]);

  return { documents, loading, reload: load, save, update, remove };
}
