import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { stripEditorScripts } from "../../lib/strip-editor-scripts";
import { rewriteResponsiveSelectors, cleanEditorArtifacts } from "../../lib/clean-editor-artifacts";
import { splitHtmlIntoBlocks } from "../../lib/split-html-blocks";
import { buildLeadCaptureSnippet } from "../../lib/lead-capture-snippet";
import { uploadImageToWebflow } from "../../lib/webflow-api";

export const maxDuration = 60;

const WEBFLOW_EMBED_LIMIT = 50000;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const CDN_BASE = `${SUPABASE_URL}/storage/v1/object/public/ai-images/webflow-exports`;

function extractBase64Images(html: string) {
  const pattern = /data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=]+)/g;
  const found: Array<{ mime: string; b64: string; full: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    if (!found.find((f) => f.b64 === m![2])) {
      found.push({ mime: m[1], b64: m[2], full: m[0] });
    }
  }
  return found;
}

function b64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, "base64");
}

function ext(mime: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mime] ?? "jpg";
}

function mimeFromExt(filePath: string) {
  const e = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    svg: "image/svg+xml",
  };
  return map[e] ?? "application/octet-stream";
}

// Find every img `src="/..."` pointing at a file under /public — those only
// resolve on WevyFlow's own domain, so once pasted into Webflow the images are
// broken. Upload each referenced file to Supabase Storage and rewrite the src
// to that public CDN URL instead.
function extractLocalImagePaths(html: string) {
  const pattern = /\ssrc="(\/(?!\/)[^"]*\.(?:jpg|jpeg|png|webp|gif|svg))"/gi;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) found.add(m[1]);
  return Array.from(found);
}

export async function POST(req: NextRequest) {
  try {
    const { html: rawHtml, projectId, leadToken, webflowToken, webflowSiteId } = (await req.json()) as {
      html: string;
      projectId?: string;
      leadToken?: string;
      webflowToken?: string;
      webflowSiteId?: string;
    };
    if (!rawHtml) return Response.json({ error: "html obrigatório" }, { status: 400 });

    // Editor instrumentation (data-wf-id on every element, the responsive-rules
    // JSON sidecar) is internal to the WevyFlow workspace and massively inflates
    // the exported markup — strip it before anything else so Webflow's 50k-char
    // custom-code limit is measured against the real page, not editor bookkeeping.
    let html = stripEditorScripts(rawHtml);
    html = rewriteResponsiveSelectors(html);
    html = cleanEditorArtifacts(html);

    const prefix = projectId ?? `tmp-${Date.now()}`;
    const useWebflowAssets = Boolean(webflowToken && webflowSiteId);

    // 1. Extract and upload all base64 images
    const images = extractBase64Images(html);
    let processed = html;
    let imagesProcessed = 0;

    if (useWebflowAssets) {
      // Real fix: upload straight to the user's own Webflow Assets — the
      // image ends up on Webflow's CDN, owned by their site, with zero
      // dependency on WevyFlow's storage/database.
      for (let i = 0; i < images.length; i++) {
        const { mime, b64, full } = images[i];
        const filename = `wf-export-${Date.now()}-${i + 1}.${ext(mime)}`;
        try {
          const url = await uploadImageToWebflow(webflowToken!, webflowSiteId!, b64ToBuffer(b64), filename, mime);
          processed = processed.replaceAll(`url(${full})`, `url(${url})`);
          processed = processed.replaceAll(full, url);
          imagesProcessed++;
        } catch (e) {
          console.error("[export-webflow] webflow asset upload failed:", e instanceof Error ? e.message : e);
        }
      }
    } else {
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      for (let i = 0; i < images.length; i++) {
        const { mime, b64, full } = images[i];
        const filename = `${prefix}/img${String(i + 1).padStart(3, "0")}.${ext(mime)}`;
        const buf = b64ToBuffer(b64);

        const { error } = await supabase.storage
          .from("ai-images")
          .upload(`webflow-exports/${filename}`, buf, { contentType: mime, upsert: true });

        if (!error) {
          const url = `${CDN_BASE}/${filename}`;
          processed = processed.replaceAll(`url(${full})`, `url(${url})`);
          processed = processed.replaceAll(full, url);
          imagesProcessed++;
        }
      }
    }

    // 1b. Same for images referenced by local /public path (ready-made templates
    // use these instead of base64) — they only resolve on WevyFlow's own domain.
    const localPaths = extractLocalImagePaths(processed);
    if (useWebflowAssets) {
      for (const localPath of localPaths) {
        const diskPath = join(process.cwd(), "public", localPath);
        if (!existsSync(diskPath)) continue;
        const buf = readFileSync(diskPath);
        const mime = mimeFromExt(localPath);
        const filename = localPath.split("/").pop() || `asset-${Date.now()}`;
        try {
          const url = await uploadImageToWebflow(webflowToken!, webflowSiteId!, buf, filename, mime);
          processed = processed.split(`"${localPath}"`).join(`"${url}"`);
          imagesProcessed++;
        } catch (e) {
          console.error("[export-webflow] webflow asset upload failed:", e instanceof Error ? e.message : e);
        }
      }
    } else {
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      for (const localPath of localPaths) {
        const diskPath = join(process.cwd(), "public", localPath);
        if (!existsSync(diskPath)) continue;
        const buf = readFileSync(diskPath);
        const mime = mimeFromExt(localPath);
        const storagePath = `${prefix}/local${localPath}`;

        const { error } = await supabase.storage
          .from("ai-images")
          .upload(`webflow-exports/${storagePath}`, buf, { contentType: mime, upsert: true });

        if (!error) {
          const url = `${CDN_BASE}/${storagePath}`;
          processed = processed.split(`"${localPath}"`).join(`"${url}"`);
          imagesProcessed++;
        }
      }
    }

    // 2. Pull every <style> block and stylesheet <link> out into the "head" bucket.
    // The editor's serialized code isn't guaranteed to be a full document — after
    // the user edits per-breakpoint styles it comes back as a body-only fragment
    // (plus an appended `<style id="wf-responsive-styles">` block) with no <head>
    // wrapper at all. Scanning for style tags directly, instead of requiring a
    // literal <head>...</head>, handles both a full document and a bare fragment.
    const cssBlocks: string[] = [];
    let remainder = processed.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_m, c: string) => {
      if (c.trim()) cssBlocks.push(c.trim());
      return "";
    });
    const linkBlocks: string[] = [];
    remainder = remainder.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, (m) => {
      linkBlocks.push(m);
      return "";
    });

    let head = [...linkBlocks, cssBlocks.length ? `<style>\n${cssBlocks.join("\n")}\n</style>` : ""]
      .filter(Boolean)
      .join("\n")
      .trim();

    // Unwrap any leftover document shell (doctype/html/head/body tags) — only
    // their inner content is relevant for the Webflow Embed element.
    let body = remainder
      .replace(/<!DOCTYPE[^>]*>/i, "")
      .replace(/<\/?html[^>]*>/gi, "")
      .replace(/<head[^>]*>[\s\S]*?<\/head>/i, "")
      .replace(/<\/?body[^>]*>/gi, "")
      .trim();

    // 3. Extract <script> tags (Webflow modifies DOMContentLoaded in head custom
    // code, so every script is merged into one "before </body>" block instead)
    const scripts: string[] = [];
    body = body.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_m, c: string) => {
      if (c.trim()) scripts.push(c.trim());
      return "";
    }).trim();

    const allScripts = scripts.join("\n");
    const wfScript = allScripts
      ? `<script>\n(function(){\nvar _run=function(){\n${allScripts}\n};\nif(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',_run);}else{_run();}\n})();\n</script>`
      : "";

    // Webflow can't run our /p/[slug] server-side lead capture, so the
    // connector script (absolute URL, works from any domain) is appended
    // here instead — same mechanism used by the WordPress export.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const leadScript = leadToken ? buildLeadCaptureSnippet(leadToken, appUrl) : "";
    const script = [wfScript, leadScript].filter(Boolean).join("\n\n");

    // Webflow's Embed element hard-caps custom code at 50k chars. Pages whose
    // body exceeds that need multiple Embed elements pasted in order instead
    // of one block that gets silently truncated when pasted.
    const bodyBlocks = splitHtmlIntoBlocks(body, WEBFLOW_EMBED_LIMIT);

    return Response.json({
      head,
      bodyBlocks,
      script,
      imagesProcessed,
      usedWebflowAssets: useWebflowAssets,
      headChars: head.length,
      bodyChars: body.length,
      scriptChars: script.length,
    });
  } catch (e) {
    console.error("[export-webflow]", e);
    return Response.json({ error: "erro interno" }, { status: 500 });
  }
}
