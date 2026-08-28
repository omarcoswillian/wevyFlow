import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { buildLeadCaptureSnippet } from "@/app/lib/lead-capture-snippet";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function notFoundPage(message: string) {
  return new Response(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:80px;color:#6b7280"><h2>${message}</h2></body></html>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const supabase = await createClient();

  // RLS only allows this anon-key client to see non-expired pages — a slug
  // that exists but expired resolves to no rows here, same as one that
  // never existed. Told apart below via a service-role lookup so the
  // visitor gets an accurate message instead of a generic 404.
  const { data: page, error: qErr } = await supabase
    .from("published_pages")
    .select("html, title, slug, public_token")
    .eq("slug", slug)
    .maybeSingle();

  console.log("[/p/slug] slug:", slug, "| found:", !!page, "| error:", qErr?.message);

  if (!page) {
    const service = createServiceClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const { data: expired } = await service
      .from("published_pages")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();

    return notFoundPage(
      expired
        ? "Este link de preview expirou. Peça um novo link a quem criou a página."
        : "Página não encontrada"
    );
  }

  // Fire-and-forget view increment via the same atomic RPC leads use —
  // this used to be `.update({ views: 0 })`, which reset the counter to
  // zero on every single page load instead of incrementing it.
  supabase.rpc("increment_page_views", { p_slug: slug }).then(() => {});

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const scriptTag = buildLeadCaptureSnippet(page.public_token, appUrl);

  // /p/[slug] is a temporary preview/approval link, not production hosting —
  // keep it out of search results regardless of what the page's own SEO
  // settings say (those apply to the real export destination instead).
  const noindexTag = `<meta name="robots" content="noindex, nofollow">`;
  let html = page.html.includes("</head>")
    ? page.html.replace("</head>", `${noindexTag}\n</head>`)
    : `${noindexTag}\n${page.html}`;
  html = html.includes("</body>") ? html.replace("</body>", `${scriptTag}\n</body>`) : html + scriptTag;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
