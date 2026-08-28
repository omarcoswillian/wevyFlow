import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import JSZip from "jszip";
import { NextRequest } from "next/server";

export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const CDN_BASE = `${SUPABASE_URL}/storage/v1/object/public/ai-images/page-imports`;

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

function buildSlug(s: string) {
  return (
    (s || "pagina")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pagina"
  );
}

function dirname(path: string) {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i + 1);
}

function resolveRelative(base: string, rel: string) {
  const parts = (base + rel).split("/");
  const out: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

function isExternal(url: string) {
  return /^(https?:|data:|mailto:|tel:|#)/i.test(url);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return Response.json({ error: "nao autenticado" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    const nameField = form.get("name");
    const pageField = form.get("page"); // optional: which .html to import when the zip has several
    if (!(file instanceof Blob))
      return Response.json({ error: "arquivo zip ausente" }, { status: 400 });

    const zip = await JSZip.loadAsync(await file.arrayBuffer());

    const entries = Object.values(zip.files).filter((f) => !f.dir);
    const htmlEntries = entries.filter((f) => /\.html?$/i.test(f.name)).sort((a, b) => a.name.localeCompare(b.name));
    if (htmlEntries.length === 0)
      return Response.json({ error: "nenhum arquivo .html encontrado no zip" }, { status: 400 });

    // Webflow's "Export Code" bundles every page of the site as its own .html
    // file — pick the requested one, else index.html, else the first found.
    const indexEntry =
      (pageField && htmlEntries.find((f) => f.name === pageField)) ||
      htmlEntries.find((f) => /(^|\/)index\.html$/i.test(f.name)) ||
      htmlEntries[0];

    const root = dirname(indexEntry.name);
    let html = await indexEntry.async("string");

    const entryByPath = new Map(entries.map((f) => [f.name, f]));

    // Inline every linked stylesheet, not just the first — Webflow's export
    // always ships 3 (normalize.css, webflow.css, <site>.css); a page missing
    // two of them looks broken even though "the import worked". Attribute
    // order isn't guaranteed (Webflow emits href before rel), so match the
    // whole <link> tag and inspect it rather than requiring rel before href.
    for (const m of [...html.matchAll(/<link\b[^>]*>/gi)]) {
      const tag = m[0];
      if (!/rel=["']stylesheet["']/i.test(tag)) continue;
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      if (!hrefMatch || isExternal(hrefMatch[1])) continue;
      const cssEntry = entryByPath.get(resolveRelative(root, hrefMatch[1]));
      if (cssEntry) {
        const css = await cssEntry.async("string");
        html = html.replace(tag, `<style>\n${css}\n</style>`);
      }
    }

    const jsSrcMatches = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi)];
    for (const m of jsSrcMatches) {
      const src = m[1];
      if (isExternal(src)) continue;
      const jsEntry = entryByPath.get(resolveRelative(root, src));
      if (jsEntry) {
        const js = await jsEntry.async("string");
        html = html.replace(m[0], `<script>\n${js}\n</script>`);
      }
    }

    // Upload remaining binary assets and rewrite their paths to CDN URLs —
    // both HTML src="" attributes AND CSS url(...) references (background
    // images, now inlined into <style> blocks above) need this.
    const storage = createServiceClient(SUPABASE_URL, SERVICE_KEY);
    const slug = buildSlug((nameField as string) || "pagina") + "-" + Date.now().toString(36);

    const assetRefs = new Set<string>();
    for (const m of html.matchAll(/\ssrc=["']([^"']+)["']/gi)) {
      if (!isExternal(m[1])) assetRefs.add(m[1]);
    }
    for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
      if (!isExternal(m[1])) assetRefs.add(m[1]);
    }

    for (const ref of assetRefs) {
      const resolved = resolveRelative(root, ref);
      const entry = entryByPath.get(resolved);
      if (!entry) continue;
      const ext = resolved.split(".").pop()?.toLowerCase() ?? "bin";
      const buf = await entry.async("nodebuffer");
      const storagePath = `page-imports/${slug}/${resolved}`;
      const { error: uploadError } = await storage.storage
        .from("ai-images")
        .upload(storagePath, buf, {
          contentType: EXT_MIME[ext] ?? "application/octet-stream",
          upsert: true,
        });
      if (!uploadError) {
        const url = `${SUPABASE_URL}/storage/v1/object/public/ai-images/${storagePath}`;
        html = html.replaceAll(`"${ref}"`, `"${url}"`).replaceAll(`'${ref}'`, `'${url}'`).replaceAll(`(${ref})`, `(${url})`);
      }
    }

    const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    const title = (nameField as string) || titleMatch?.[1]?.trim() || "Pagina importada";

    const { data, error } = await supabase
      .from("published_pages")
      .insert({
        user_id: user.id,
        slug,
        title,
        html,
        page_type: "zip",
      })
      .select("id, slug")
      .single();

    if (error) {
      console.error("[zip-import] supabase error:", error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      id: data.id,
      slug: data.slug,
      importedPage: indexEntry.name,
      // Lets the UI offer "importar outra página" when the zip (a full
      // Webflow site export) bundles more than one .html file.
      availablePages: htmlEntries.length > 1 ? htmlEntries.map((f) => f.name) : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[zip-import] erro inesperado:", msg);
    return Response.json({ error: "erro interno: " + msg }, { status: 500 });
  }
}
