import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { NextRequest } from "next/server";

export const maxDuration = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const {
      page_slug,
      page_title,
      name,
      email,
      phone,
      extra,
      utm_source,
      utm_medium,
      utm_campaign,
    } = body as Record<string, string>;

    if (!email && !phone) {
      return Response.json({ error: "email ou phone obrigatório" }, { status: 400, headers: CORS });
    }

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    );

    // Resolve user_id from page_slug
    let user_id: string | null = null;
    if (page_slug) {
      const { data: page } = await supabase
        .from("published_pages")
        .select("user_id")
        .eq("slug", page_slug)
        .maybeSingle();
      if (page) user_id = page.user_id;
    }

    if (!user_id) {
      return Response.json({ error: "página não encontrada" }, { status: 404, headers: CORS });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const referrer = req.headers.get("referer") || null;

    const { error } = await supabase.from("leads").insert({
      user_id,
      page_slug: page_slug || null,
      page_title: page_title || null,
      name: name || null,
      email: email || null,
      phone: phone || null,
      extra: extra ? JSON.parse(String(extra)) : null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      referrer,
      ip,
    });

    if (error) {
      console.error("[leads]", error.message);
      return Response.json({ error: "erro ao salvar lead" }, { status: 500, headers: CORS });
    }

    // Increment page views (best-effort, ignore errors)
    if (page_slug) {
      supabase.from("published_pages")
        .select("views")
        .eq("slug", page_slug)
        .maybeSingle()
        .then(({ data: p }) => {
          if (p) supabase.from("published_pages").update({ views: (p.views ?? 0) + 1 }).eq("slug", page_slug).then(() => {});
        });
    }

    return Response.json({ ok: true }, { headers: CORS });
  } catch (e) {
    console.error("[leads] unexpected:", e);
    return Response.json({ error: "erro interno" }, { status: 500, headers: CORS });
  }
}
