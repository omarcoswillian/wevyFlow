import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { stripEditorScripts } from "../../lib/strip-editor-scripts";
import { rewriteResponsiveSelectors, cleanEditorArtifacts } from "../../lib/clean-editor-artifacts";
import { inlineLocalImages } from "../../lib/inline-export-images";
import { buildLeadCaptureSnippet } from "../../lib/lead-capture-snippet";

export const maxDuration = 60;

// Produces the exact payload the "WevyFlow" WordPress plugin
// (plugins/wevyflow-wp/) expects to be pasted into its "Código WevyFlow"
// meta box: {"wf":1,"html":...,"title":...}. The plugin's template-full.php
// echoes `html` verbatim with no theme wrapper — full-bleed, same as a
// native page — so no CSS/JS splitting is needed here (unlike Webflow's
// 50k-char Embed limit).
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "não autenticado" }, { status: 401 });

    const { html: rawHtml, title, leadToken } = (await req.json()) as {
      html: string;
      title?: string;
      leadToken?: string;
    };
    if (!rawHtml) return Response.json({ error: "html obrigatório" }, { status: 400 });

    let html = stripEditorScripts(rawHtml);
    html = rewriteResponsiveSelectors(html);
    html = cleanEditorArtifacts(html);

    // The WordPress plugin's template has no size limit (unlike Webflow's
    // 50k-char Embed), so images are embedded directly as base64 — the
    // exported page is fully self-contained, no dependency on any server
    // WevyFlow controls.
    const { html: withImages, imagesProcessed } = inlineLocalImages(html);
    html = withImages;

    if (leadToken) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
      const scriptTag = buildLeadCaptureSnippet(leadToken, appUrl);
      html = html.includes("</body>") ? html.replace("</body>", () => `${scriptTag}\n</body>`) : html + scriptTag;
    }

    if (!html.includes("<!DOCTYPE") && !html.includes("<html")) {
      html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title || "WevyFlow Page"}</title></head><body>${html}</body></html>`;
    }

    const payload = { wf: 1, html, title: title || "WevyFlow Page" };

    return Response.json({
      code: JSON.stringify(payload),
      imagesProcessed,
      htmlChars: html.length,
    });
  } catch (e) {
    console.error("[export-wordpress]", e);
    return Response.json({ error: "erro interno" }, { status: 500 });
  }
}
