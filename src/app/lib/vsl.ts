// Shared utilities for the VSL VTurb block (snippet parsing + reveal-script generation).
// Used by InsertPanel (initial drag), VSLConfigDialog (gear → edit), and the export pipeline.

export type VTurbKind = "player" | "ab-test";

export interface VTurbIds {
  accountId: string;
  playerId: string;
  tagId: string;     // The actual id="..." from the tag (vid-XXX or ab-XXX)
  kind: VTurbKind;
}

export interface PitchEntry {
  /** Key matching the player tag id with `vid-` stripped. For A/B variants keeps the `ab-` prefix. */
  id: string;
  /** Delay in seconds until the pitch appears in the VSL. */
  delaySec: number;
}

export interface VSLConfig {
  /** Original VTurb snippet pasted by the user. Preserved as-is. */
  snippet: string;
  /** All known players + their pitch delays. First entry is auto-derived from snippet. */
  pitches: PitchEntry[];
  /** Whether to inject the preload <link> block for LCP optimization. */
  includePreload: boolean;
}

/** HTML attribute used to mark VSL placeholder/configured wrappers in the editor. */
export const VSL_BLOCK_ATTR = "data-wf-vsl-block";
/** State attribute on the wrapper: "empty" until first config saved, then "configured". */
export const VSL_STATE_ATTR = "data-wf-vsl-state";
/** Serialized config (JSON) lives in this attribute on the wrapper. */
export const VSL_CONFIG_ATTR = "data-wf-vsl-config";

/** Empty placeholder dropped via drag-and-drop. Gear button on hover opens the config dialog.
 *  No `.reveal` class — this element is an editor artifact and must be visible immediately,
 *  not gated by the IntersectionObserver in BASE_SCRIPT. */
export function buildPlaceholderHtml(): string {
  return (
    `<div ${VSL_BLOCK_ATTR} ${VSL_STATE_ATTR}="empty" ` +
    `style="aspect-ratio:16/9;max-width:600px;margin:24px auto;border:2px dashed rgba(168,85,247,0.5);border-radius:12px;background:rgba(168,85,247,0.05);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:rgba(168,85,247,0.9);font-family:system-ui;font-size:14px;text-align:center;padding:24px">` +
    `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>` +
    `<strong>VSL VTurb</strong>` +
    `<span style="font-size:12px;opacity:0.7">Passe o mouse e clique na engrenagem para configurar</span>` +
    `</div>`
  );
}

/** Parse the IDs (account UUID + player ID + tag id + kind) from a VTurb snippet. */
export function parseVTurbIds(snippet: string): VTurbIds | null {
  // Capture id="..." from the actual tag — handles both vid-XXX and ab-XXX prefixes.
  const tagMatch = snippet.match(/<vturb-smartplayer[^>]*\sid=["']([^"']+)["']/i);

  // Standard v4 player URL
  const std = snippet.match(/scripts\.converteai\.net\/([a-f0-9-]{36})\/players\/([a-f0-9]{24})\/v4\/player\.js/i);
  if (std) return {
    accountId: std[1],
    playerId: std[2],
    tagId: tagMatch ? tagMatch[1] : `vid-${std[2]}`,
    kind: "player",
  };

  // A/B test URL
  const ab = snippet.match(/scripts\.converteai\.net\/([a-f0-9-]{36})\/ab-test\/([a-f0-9]{24})\/player\.js/i);
  if (ab) return {
    accountId: ab[1],
    playerId: ab[2],
    tagId: tagMatch ? tagMatch[1] : `ab-${ab[2]}`,
    kind: "ab-test",
  };

  return null;
}

/** Parse a delay string ("30:10" or "1810") to seconds. Returns null on invalid input. */
export function parseDelay(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const mmss = v.match(/^(\d+):([0-5]?\d)$/);
  if (mmss) return parseInt(mmss[1], 10) * 60 + parseInt(mmss[2], 10);
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  return null;
}

/** Format delay seconds back to "mm:ss" for the form. */
export function formatDelay(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Derive the listPitch key from a tag id (strip leading `vid-`, preserve `ab-`). */
export function pitchKeyFromTagId(tagId: string): string {
  return tagId.replace(/^vid-/, "");
}

/**
 * Build the inner HTML of a configured VSL block.
 * The wrapper element itself is NOT included — only the children
 * (style, optional preload links, snippet, optional reveal script).
 */
export function buildVSLInnerHtml(config: VSLConfig): string {
  const ids = parseVTurbIds(config.snippet);
  if (!ids) return "";
  const playerScriptUrl = ids.kind === "ab-test"
    ? `https://scripts.converteai.net/${ids.accountId}/ab-test/${ids.playerId}/player.js`
    : `https://scripts.converteai.net/${ids.accountId}/players/${ids.playerId}/v4/player.js`;

  const parts: string[] = [];

  // CSS for .esconder elements — always emit, deduped by id at insertion time
  parts.push(`<style ${VSL_BLOCK_ATTR}-style>.esconder{display:none}</style>`);

  if (config.includePreload) {
    parts.push(
      `<link rel="preload" href="${playerScriptUrl}" as="script">`,
      `<link rel="preload" href="https://scripts.converteai.net/lib/js/smartplayer-wc/v4/smartplayer.js" as="script">`,
      `<link rel="dns-prefetch" href="https://cdn.converteai.net">`,
      `<link rel="dns-prefetch" href="https://scripts.converteai.net">`,
      `<link rel="dns-prefetch" href="https://images.converteai.net">`,
      `<link rel="dns-prefetch" href="https://api.vturb.com.br">`,
    );
  }

  // The user's snippet, intact
  parts.push(config.snippet);

  // Reveal script — emitted only if at least one valid pitch exists
  const validPitches = config.pitches.filter(p => p.id.trim() && Number.isFinite(p.delaySec) && p.delaySec > 0);
  if (validPitches.length > 0) {
    const listPitchObj = validPitches
      .map(p => `${JSON.stringify(p.id.trim())}:{delay:${p.delaySec}}`)
      .join(",");
    // Scope to the player INSIDE this wrapper (document.currentScript.parentElement)
    // so multiple VSL blocks on the same page don't interfere.
    parts.push(
      `<script>` +
      `(function(){` +
      `var scope=(document.currentScript&&document.currentScript.parentElement)||document;` +
      `var listPitch={${listPitchObj}};` +
      `var player=scope.querySelector('vturb-smartplayer');` +
      `if(!player)return;` +
      `var observer=new MutationObserver(function(ms){ms.forEach(function(m){var el=m.target;if(el.style.display==='block')el.style.display='flex';});});` +
      `player.addEventListener('player:ready',function(){` +
      `var pid=(player.getAttribute('id')||player.getAttribute('original-id')||'').replace('vid-','');` +
      `var cfg=listPitch[pid];if(!cfg)return;` +
      `document.querySelectorAll('.esconder').forEach(function(el){observer.observe(el,{attributes:true,attributeFilter:['style']});});` +
      `player.displayHiddenElements(cfg.delay,['.esconder'],{persist:true});` +
      `});` +
      `})();` +
      `</script>`
    );
  }

  return parts.join("\n");
}

/** Serialize config to the JSON string stored in data-wf-vsl-config. */
export function serializeConfig(config: VSLConfig): string {
  return JSON.stringify(config);
}

/** Parse the JSON string from data-wf-vsl-config. Returns null if missing/invalid. */
export function deserializeConfig(raw: string | null | undefined): VSLConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.snippet !== "string") return null;
    if (!Array.isArray(parsed.pitches)) return null;
    return {
      snippet: parsed.snippet,
      pitches: (parsed.pitches as unknown[])
        .filter((p): p is { id: unknown; delaySec: unknown } =>
          typeof p === "object" && p !== null && "id" in p && "delaySec" in p)
        .map((p) => ({
          id: String(p.id),
          delaySec: Number(p.delaySec),
        })),
      includePreload: Boolean(parsed.includePreload),
    };
  } catch {
    return null;
  }
}

/** An empty config to seed a fresh dialog. */
export function emptyConfig(): VSLConfig {
  return { snippet: "", pitches: [], includePreload: false };
}
