import { existsSync, readFileSync } from "fs";
import { join } from "path";

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
    const diskPath = join(process.cwd(), "public", localPath);
    if (!existsSync(diskPath)) continue;
    const buf = readFileSync(diskPath);
    const mime = mimeFromExt(localPath);
    const dataUri = `data:${mime};base64,${buf.toString("base64")}`;
    processed = processed.split(`"${localPath}"`).join(`"${dataUri}"`);
    imagesProcessed++;
  }

  return { html: processed, imagesProcessed };
}
