import { readFileSync } from "fs";
import { join } from "path";
import { SECTIONS_BY_ID } from "./sections";
import { PRESETS_BY_ID } from "./presets";

const BASE = join(process.cwd(), "src/app/lib/ready-templates");

/** Load raw HTML for an atomic section by id. Server-side only. */
export function loadSectionHtml(id: string): string {
  const section = SECTIONS_BY_ID[id];
  if (!section) throw new Error(`Section not found in catalog: ${id}`);
  return readFileSync(join(BASE, section.file), "utf-8");
}

/** Load raw HTML for a full-page preset by id. Server-side only. */
export function loadPresetHtml(id: string): string {
  const preset = PRESETS_BY_ID[id];
  if (!preset) throw new Error(`Preset not found in catalog: ${id}`);
  return readFileSync(join(BASE, preset.file), "utf-8");
}

/**
 * Load and concatenate multiple section HTMLs in order.
 * Used by the assembler after the compose step picks section ids.
 */
export function assembleSections(ids: string[]): string {
  return ids.map(loadSectionHtml).join("\n\n");
}
