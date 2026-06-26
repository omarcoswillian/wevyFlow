import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";

export const maxDuration = 60;

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

export async function POST(req: NextRequest) {
  try {
    const { html, projectId } = (await req.json()) as { html: string; projectId?: string };
    if (!html) return Response.json({ error: "html obrigatório" }, { status: 400 });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const prefix = projectId ?? `tmp-${Date.now()}`;

    // 1. Extract and upload all base64 images
    const images = extractBase64Images(html);
    let processed = html;

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
      }
    }

    // 2. Split head / body
    const headMatch = processed.match(/<head>([\s\S]*?)<\/head>/i);
    const bodyMatch = processed.match(/<body>([\s\S]*?)<\/body>/i);

    let head = headMatch ? headMatch[1].trim() : "";
    let body = bodyMatch ? bodyMatch[1].trim() : processed;

    // 3. Extract <script> tags from head (Webflow modifies DOMContentLoaded in head custom code)
    const scriptInHead: string[] = [];
    head = head.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_m, c: string) => {
      if (c.trim()) scriptInHead.push(c.trim());
      return "";
    }).trim();

    // 4. Extract <script> tags from body
    const scriptInBody: string[] = [];
    body = body.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, (_m, c: string) => {
      if (c.trim()) scriptInBody.push(c.trim());
      return "";
    }).trim();

    // 5. Merge all scripts → one block for "Before </body> tag" (reliable in Webflow)
    const allScripts = [...scriptInHead, ...scriptInBody].join("\n");
    const script = allScripts
      ? `<script>\n(function(){\nvar _run=function(){\n${allScripts}\n};\nif(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',_run);}else{_run();}\n})();\n</script>`
      : "";

    return Response.json({
      head,
      body,
      script,
      imagesProcessed: images.length,
      headChars: head.length,
      bodyChars: body.length,
      scriptChars: script.length,
    });
  } catch (e) {
    console.error("[export-webflow]", e);
    return Response.json({ error: "erro interno" }, { status: 500 });
  }
}
