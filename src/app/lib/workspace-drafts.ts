"use client";

import { useCallback, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Persists the Workspace's "Salvar" checkpoint (code edited from a prompt
 * generated outside any project) to Supabase instead of localStorage — the
 * old `wf:draft:${hash(prompt)}` key collided between different prompts
 * that hashed the same, and could be wiped at any time by the automatic
 * storage cleanup (aggressiveCleanup in storage-compact.ts) when the
 * browser's localStorage filled up. Keyed by the exact prompt text per
 * user (no hash, no collisions) — global, not tied to a project/launch,
 * since the Workspace generates outside of either until "Publicar". */
export function useWorkspaceDrafts() {
  const supabase = useMemo(() => createClient(), []);
  const [saveError, setSaveError] = useState<string | null>(null);

  const getDraft = useCallback(async (prompt: string): Promise<string | null> => {
    if (!prompt) return null;
    const { data, error } = await supabase
      .from("workspace_drafts")
      .select("code")
      .eq("prompt", prompt)
      .maybeSingle();
    if (error || !data) return null;
    return data.code;
  }, [supabase]);

  const saveDraft = useCallback(async (prompt: string, code: string): Promise<void> => {
    if (!prompt || !code) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSaveError("Sessão expirada — faça login novamente.");
      throw new Error("not authenticated");
    }
    const { error } = await supabase
      .from("workspace_drafts")
      .upsert({ user_id: user.id, prompt, code }, { onConflict: "user_id,prompt" });
    if (error) {
      setSaveError(error.message);
      throw error;
    }
    setSaveError(null);
  }, [supabase]);

  const deleteDraft = useCallback(async (prompt: string): Promise<void> => {
    if (!prompt) return;
    await supabase.from("workspace_drafts").delete().eq("prompt", prompt);
  }, [supabase]);

  return { getDraft, saveDraft, deleteDraft, saveError };
}
