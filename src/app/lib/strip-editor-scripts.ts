// Strips inline <script> blocks belonging to the editor itself (BASE_SCRIPT and
// IFRAME_VISUAL_EDIT_SCRIPT) from a serialized body string.
//
// Why this exists:
//   serializeBody initially captured the appended editor scripts back into finalCode.
//   That meant each iframe rebuild loaded multiple IIFEs of the same script, each
//   with its OWN closure state (idCounter, dragHtml, etc). Result: drops fired N times,
//   data-wf-id collisions across element boundaries, broken wf-update-vsl lookups.
//
//   Adding `id="__wf_..."` to the appended scripts only fixes FUTURE serializations.
//   Legacy finalCode in users' localStorage still contains un-id'd copies. This util
//   removes them defensively at the parent level so the iframe loads with exactly
//   ONE copy of each editor script.
//
// Detection is by signature, not regex on tag names — so user scripts are never touched.

const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;

export function stripEditorScripts(html: string): string {
  return html.replace(SCRIPT_RE, (match) => {
    // Preserve the appended ones (they have the __wf_ id) — only strip un-id'd copies
    // that may have leaked into body via legacy serializeBody behavior.
    if (/id=["']__wf_(?:base|edit)_script["']/.test(match)) return "";
    // Edit script signature: __wf_hover / __wf_select are unique to OUR overlay ids.
    if (match.indexOf("__wf_hover") !== -1 || match.indexOf("__wf_select") !== -1) return "";
    // Base script signature: requires ALL THREE markers together to avoid false-positives
    // on user templates that also use IntersectionObserver + reveal-style classes.
    if (
      match.indexOf("IntersectionObserver") !== -1 &&
      match.indexOf("querySelectorAll('.reveal')") !== -1 &&
      match.indexOf("'is-visible'") !== -1
    ) return "";
    return match;
  });
}
