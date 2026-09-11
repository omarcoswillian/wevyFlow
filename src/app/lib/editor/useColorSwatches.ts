"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

/** Custom color swatches saved from the editor's ColorPicker — persisted to
 * `user_profiles.color_swatches` instead of the old "wevyflow-color-swatches"
 * localStorage key, which was lost on any browser switch/clear.
 *
 * Module-level cache + listener set (not per-component state): ColorPicker
 * mounts once per color-editable property in the inspector, so several
 * instances can be on screen at once. Loading independently per instance —
 * or worse, re-fetching on every color change while dragging, like the old
 * localStorage version's SwatchesRow effect did — would mean a network
 * round-trip per drag frame. One shared fetch, one shared optimistic write,
 * every instance re-renders from the same list. */
let cache: string[] | null = null;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function ensureLoaded() {
  if (cache !== null || inFlight) return inFlight;
  inFlight = (async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { cache = []; notify(); return; }
    const { data } = await supabase
      .from("user_profiles")
      .select("color_swatches")
      .eq("user_id", user.id)
      .maybeSingle();
    cache = data?.color_swatches ?? [];
    notify();
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export function useColorSwatches() {
  const [swatches, setSwatches] = useState<string[]>(cache ?? []);

  useEffect(() => {
    const listener = () => setSwatches(cache ?? []);
    listeners.add(listener);
    ensureLoaded();
    return () => { listeners.delete(listener); };
  }, []);

  const saveSwatch = useCallback(async (hex: string) => {
    const next = [hex, ...(cache ?? []).filter((c) => c !== hex)].slice(0, 16);
    cache = next;
    notify();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_profiles").upsert({ user_id: user.id, color_swatches: next }, { onConflict: "user_id" });
  }, []);

  return { swatches, saveSwatch };
}
