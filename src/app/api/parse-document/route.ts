import { NextRequest } from "next/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TEXT_CHARS = 20_000;

/* ── Google Docs URL helpers ──────────────────────────────────── */
function extractGoogleDocsId(url: string): string | null {
  const m = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function isGoogleDocsUrl(url: string): boolean {
  return /docs\.google\.com\/document\/d\//.test(url);
}

function googleDocsExportUrl(docId: string): string {
  return `https://docs.google.com/document/d/${docId}/export?format=txt`;
}

/* ── Plain-text extractor for HTML pages (Notion, etc.) ────────── */
function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ── POST handler ────────────────────────────────────────────────
   Accepts two shapes:
   1. multipart/form-data  { file: File }               → parse .docx / .pdf
   2. application/json     { url: string }              → fetch Google Docs / URL
*/
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  /* ── Branch: URL ── */
  if (contentType.includes("application/json")) {
    let url: string;
    try {
      ({ url } = await request.json());
    } catch {
      return Response.json({ error: "JSON inválido" }, { status: 400 });
    }

    if (!url || typeof url !== "string") {
      return Response.json({ error: "URL não informada" }, { status: 400 });
    }

    let fetchUrl = url.trim();

    // Convert Google Docs share/edit URL → plain-text export
    if (isGoogleDocsUrl(fetchUrl)) {
      const docId = extractGoogleDocsId(fetchUrl);
      if (!docId) return Response.json({ error: "URL do Google Docs inválida" }, { status: 400 });
      fetchUrl = googleDocsExportUrl(docId);
    }

    // Basic URL validation (block private ranges)
    try {
      const parsed = new URL(fetchUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return Response.json({ error: "Apenas URLs http/https são suportadas" }, { status: 400 });
      }
      const host = parsed.hostname.toLowerCase();
      if (/^(localhost|127\.|0\.0\.0\.0|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(host)) {
        return Response.json({ error: "URL não permitida" }, { status: 400 });
      }
    } catch {
      return Response.json({ error: "URL inválida" }, { status: 400 });
    }

    try {
      const res = await fetch(fetchUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "Mozilla/5.0", Accept: "text/plain,text/html,*/*" },
      });

      if (res.status === 403 || res.status === 401) {
        return Response.json({
          error: "Documento não público. No Google Docs: Compartilhar → Qualquer pessoa com o link → Leitor.",
        }, { status: 403 });
      }
      if (!res.ok) {
        return Response.json({ error: `Erro ao acessar URL (status ${res.status})` }, { status: 422 });
      }

      const rawText = await res.text();
      const mimeType = res.headers.get("content-type") ?? "";
      const text = mimeType.includes("text/html") ? stripHtmlToText(rawText) : rawText.trim();

      if (!text) return Response.json({ error: "Documento sem conteúdo de texto" }, { status: 422 });

      const trimmed = text.slice(0, MAX_TEXT_CHARS);
      const fileName = isGoogleDocsUrl(url) ? "Google Docs" : new URL(url).hostname;
      return Response.json({ text: trimmed, fileName, chars: trimmed.length });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "TimeoutError") {
        return Response.json({ error: "Tempo limite excedido ao acessar a URL" }, { status: 408 });
      }
      console.error("[parse-document/url]", err);
      return Response.json({ error: "Não foi possível acessar a URL" }, { status: 500 });
    }
  }

  /* ── Branch: File upload ── */
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Requisição inválida" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "Arquivo não enviado" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return Response.json({ error: "Arquivo muito grande (máx 10MB)" }, { status: 400 });

  const ext = file.name.toLowerCase().split(".").pop();
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (ext === "docx") {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value.trim();
      if (!text) return Response.json({ error: "Documento vazio ou sem texto extraível" }, { status: 422 });
      return Response.json({ text: text.slice(0, MAX_TEXT_CHARS), fileName: file.name, chars: Math.min(text.length, MAX_TEXT_CHARS) });
    }

    if (ext === "pdf") {
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js" as string)).default as (buf: Buffer) => Promise<{ text: string }>;
      const data = await pdfParse(buffer);
      const text = data.text.trim();
      if (!text) return Response.json({ error: "PDF sem texto extraível (pode ser imagem escaneada)" }, { status: 422 });
      return Response.json({ text: text.slice(0, MAX_TEXT_CHARS), fileName: file.name, chars: Math.min(text.length, MAX_TEXT_CHARS) });
    }

    return Response.json({ error: "Formato não suportado. Use .docx ou .pdf" }, { status: 400 });
  } catch (err) {
    console.error("[parse-document/file]", err);
    return Response.json({ error: "Erro ao processar arquivo. Verifique se não está corrompido." }, { status: 500 });
  }
}
