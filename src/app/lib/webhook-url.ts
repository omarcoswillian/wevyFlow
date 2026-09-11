"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

/** The webhook URL (Zapier/Make/etc) leads captured in generated pages'
 * forms get POSTed to — persisted to `user_profiles.webhook_url` instead of
 * the old "wf_webhook_url" localStorage key, which was lost on any browser
 * switch/clear. Global per user, injected into every generated page's HTML
 * (see html-optimizer.ts). */
export function useWebhookUrl() {
  const supabase = useMemo(() => createClient(), []);
  const [webhookUrl, setWebhookUrlState] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("user_profiles")
        .select("webhook_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) setWebhookUrlState(data?.webhook_url ?? "");
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  const setWebhookUrl = useCallback(async (url: string) => {
    setWebhookUrlState(url);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_profiles").upsert({ user_id: user.id, webhook_url: url }, { onConflict: "user_id" });
  }, [supabase]);

  return { webhookUrl, setWebhookUrl };
}
