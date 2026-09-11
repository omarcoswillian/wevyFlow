import { existsSync, readFileSync } from "fs";
import { resolve, sep } from "path";

// A html `src="/../../../etc/passwd"`-style path would otherwise let
// resolve(cwd, "public", localPath) escape the public/ directory entirely —
// resolve it and reject anything that lands outside publicRoot.
const PUBLIC_ROOT = resolve(process.cwd(), "public");
function safePublicPath(localPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(localPath);
  } catch {
    return null;
  }
  const resolved = resolve(PUBLIC_ROOT, `.${decoded}`);
  if (resolved !== PUBLIC_ROOT && !resolved.startsWith(PUBLIC_ROOT + sep)) return null;
  return resolved;
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

function extractLocalImagePaths(html: string) {
  const pattern = /\ssrc="(\/(?!\/)[^"]*\.(?:jpg|jpeg|png|webp|gif|svg))"/gi;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) found.add(m[1]);
  return Array.from(found);
}

// Embeds every /public-relative image (ready-made templates use these)
// directly as a base64 data URI. No upload, no external URL, no dependency
// on WevyFlow's storage/database — the exported HTML is fully self-contained.
// Images already inlined as base64 by the editor are left untouched; they're
// self-contained already.
export function inlineLocalImages(html: string): { html: string; imagesProcessed: number } {
  let processed = html;
  let imagesProcessed = 0;

  for (const localPath of extractLocalImagePaths(processed)) {
    const diskPath = safePublicPath(localPath);
    if (!diskPath || !existsSync(diskPath)) continue;
    const buf = readFileSync(diskPath);
    const mime = mimeFromExt(localPath);
    const dataUri = `data:${mime};base64,${buf.toString("base64")}`;
    processed = processed.split(`"${localPath}"`).join(`"${dataUri}"`);
    imagesProcessed++;
  }

  return { html: processed, imagesProcessed };
}
