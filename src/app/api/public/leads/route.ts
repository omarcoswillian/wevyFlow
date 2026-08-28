import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { NextRequest } from "next/server";

export const maxDuration = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Bot signals collected client-side by lead-capture-snippet.ts: a honeypot
// field real visitors never see/fill, and how fast the form was submitted
// after the script rendered. Neither requires a captcha or user friction.
const MIN_HUMAN_FILL_MS = 300;

// Per-token+IP throttle. Deliberately a plain DB count (no Redis/Turnstile
// yet) — cheap enough for now and stops a leaked token from being hammered.
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_PER_WINDOW = 5;

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const {
      token,
      page_title,
      page_url,
      name,
      email,
      phone,
      extra,
      utm_source,
      utm_medium,
      utm_campaign,
      hp,
      elapsed_ms,
    } = body as Record<string, unknown>;

    if (typeof token !== "string" || !token) {
      return Response.json({ error: "token obrigatório" }, { status: 400, headers: CORS });
    }

    if ((!email || typeof email !== "string") && (!phone || typeof phone !== "string")) {
      return Response.json({ error: "email ou phone obrigatório" }, { status: 400, headers: CORS });
    }

    if (email && typeof email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "email inválido" }, { status: 400, headers: CORS });
    }

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    );

    // Resolve the owner from the opaque token — first against a page
    // published at /p/[slug], then against an export-time lead source.
    // Never trust a client-supplied slug/user_id for this.
    let user_id: string | null = null;
    let page_slug: string | null = null;

    const { data: page } = await supabase
      .from("published_pages")
      .select("user_id, slug")
      .eq("public_token", token)
      .maybeSingle();

    if (page) {
      user_id = page.user_id;
      page_slug = page.slug;
    } else {
      const { data: source } = await supabase
        .from("lead_sources")
        .select("user_id")
        .eq("token", token)
        .maybeSingle();
      if (source) user_id = source.user_id;
    }

    if (!user_id) {
      return Response.json({ error: "página não encontrada" }, { status: 404, headers: CORS });
    }

    // Honeypot filled or submitted faster than a human could type = bot.
    // Return a fake success so scripted submitters don't learn they were
    // blocked and keep retrying with the same payload.
    const isHoneypotFilled = typeof hp === "string" && hp.trim().length > 0;
    const isTooFast = typeof elapsed_ms === "number" && elapsed_ms >= 0 && elapsed_ms < MIN_HUMAN_FILL_MS;
    if (isHoneypotFilled || isTooFast) {
      return Response.json({ ok: true }, { headers: CORS });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const referrer = req.headers.get("referer") || null;

    if (ip) {
      const since = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("source_token", token)
        .eq("ip", ip)
        .gte("created_at", since);
      if ((count ?? 0) >= RATE_LIMIT_MAX_PER_WINDOW) {
        return Response.json({ ok: true }, { headers: CORS });
      }
    }

    // `extra` arrives as a real object (the client JSON.stringifies the whole
    // payload) — only parse it if it was somehow sent as a string.
    let extraValue: Record<string, string> | null = null;
    if (extra && typeof extra === "object") {
      extraValue = extra as Record<string, string>;
    } else if (typeof extra === "string" && extra.trim()) {
      try {
        extraValue = JSON.parse(extra);
      } catch {
        extraValue = null;
      }
    }

    const { error } = await supabase.from("leads").insert({
      user_id,
      page_slug,
      page_title: typeof page_title === "string" ? page_title : (typeof page_url === "string" ? page_url : null),
      name: typeof name === "string" ? name : null,
      email: typeof email === "string" ? email : null,
      phone: typeof phone === "string" ? phone : null,
      extra: extraValue,
      utm_source: typeof utm_source === "string" ? utm_source : null,
      utm_medium: typeof utm_medium === "string" ? utm_medium : null,
      utm_campaign: typeof utm_campaign === "string" ? utm_campaign : null,
      referrer,
      ip,
      source_token: token,
    });

    if (error) {
      console.error("[leads]", error.message);
      return Response.json({ error: "erro ao salvar lead" }, { status: 500, headers: CORS });
    }

    // Atomic page view increment — avoids read-then-write race condition
    if (page_slug) {
      supabase.rpc("increment_page_views", { p_slug: page_slug }).then(() => {});
    }

    return Response.json({ ok: true }, { headers: CORS });
  } catch (e) {
    console.error("[leads] unexpected:", e);
    return Response.json({ error: "erro interno" }, { status: 500, headers: CORS });
  }
}
