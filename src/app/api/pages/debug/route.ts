import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Dev-only: GET /api/pages/debug?slug=xxx — returns HTML size + first 500 chars
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  const supabase = await createClient();
  const query = supabase
    .from("published_pages")
    .select("id, slug, title, page_type, created_at, html");

  const { data, error } = slug
    ? await query.eq("slug", slug).maybeSingle()
    : await query.order("created_at", { ascending: false }).limit(5);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "nenhuma pagina encontrada" }, { status: 404 });

  const summarize = (row: { id: string; slug: string; title: string | null; page_type: string | null; created_at: string; html: string }) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    page_type: row.page_type,
    created_at: row.created_at,
    html_bytes: Buffer.byteLength(row.html || "", "utf8"),
    html_kb: (Buffer.byteLength(row.html || "", "utf8") / 1024).toFixed(1),
    has_wfimg: (row.html || "").includes("wfimg"),
    has_base64: (row.html || "").includes("data:image"),
    has_body_tag: (row.html || "").includes("</body>"),
    html_preview: (row.html || "").slice(0, 600),
  });

  const result = Array.isArray(data) ? data.map(summarize) : summarize(data as Parameters<typeof summarize>[0]);
  return Response.json(result);
}
