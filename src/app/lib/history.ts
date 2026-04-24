"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { HistoryEntry } from "./types";

const MAX_ENTRIES = 20;

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase
      .from("generation_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(MAX_ENTRIES)
      .then(({ data }) => {
        if (!data) return;
        setEntries(
          data.map((row) => ({
            id: row.id,
            prompt: row.prompt,
            platform: row.platform,
            code: row.code,
            createdAt: new Date(row.created_at).getTime(),
          }))
        );
      });
  }, [supabase]);

  const addEntry = useCallback(
    async (entry: HistoryEntry) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));

      await supabase.from("generation_history").insert({
        id: entry.id,
        user_id: user.id,
        prompt: entry.prompt,
        platform: entry.platform,
        code: entry.code,
        created_at: new Date(entry.createdAt).toISOString(),
      });
    },
    [supabase]
  );

  const removeEntry = useCallback(
    async (id: string) => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
      await supabase.from("generation_history").delete().eq("id", id);
    },
    [supabase]
  );

  const clearHistory = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setEntries([]);
    await supabase.from("generation_history").delete().eq("user_id", user.id);
  }, [supabase]);

  return { entries, addEntry, removeEntry, clearHistory };
}
