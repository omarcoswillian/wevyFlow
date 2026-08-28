// Splits a flat HTML fragment (a sequence of sibling elements/text, no shared
// wrapper) into chunks that each stay under a char limit — used for Webflow's
// Embed element, which hard-caps custom code at 50,000 chars per block.
// Splits only happen between top-level siblings, never inside a tag, so each
// chunk stays valid, self-contained HTML that can be pasted into its own
// Embed element and rendered in order.

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

const TOKEN_RE = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>|[^<]+/g;

/** Break `html` into its top-level sibling elements (each including its full subtree). */
function splitTopLevelElements(html: string): string[] {
  const elements: string[] = [];
  let current = "";
  let depth = 0;

  const tokens = html.match(TOKEN_RE) ?? [];
  for (const token of tokens) {
    if (token.startsWith("<!--")) {
      current += token;
      if (depth === 0) { elements.push(current); current = ""; }
      continue;
    }

    const isClosing = token.startsWith("</");
    const tagMatch = token.match(/^<\/?([a-zA-Z][a-zA-Z0-9-]*)/);
    const tagName = tagMatch ? tagMatch[1].toLowerCase() : null;
    const isSelfClosing = /\/\s*>$/.test(token) || (tagName ? VOID_ELEMENTS.has(tagName) : false);

    current += token;

    if (!tagName) {
      // Plain text run between tags.
      if (depth === 0) { elements.push(current); current = ""; }
    } else if (isClosing) {
      depth = Math.max(0, depth - 1);
      if (depth === 0) { elements.push(current); current = ""; }
    } else if (isSelfClosing) {
      if (depth === 0) { elements.push(current); current = ""; }
    } else {
      depth++;
    }
  }
  if (current) elements.push(current);
  return elements.filter((e) => e.length > 0);
}

/**
 * Greedily pack top-level elements into chunks no larger than `limit` chars.
 * A single element larger than `limit` becomes its own oversized chunk
 * (can't be split further without breaking markup) — caller should surface that.
 */
export function splitHtmlIntoBlocks(html: string, limit: number): string[] {
  if (html.length <= limit) return html ? [html] : [];

  const elements = splitTopLevelElements(html);
  const blocks: string[] = [];
  let current = "";

  for (const el of elements) {
    if (current && current.length + el.length > limit) {
      blocks.push(current);
      current = el;
    } else {
      current += el;
    }
  }
  if (current) blocks.push(current);
  return blocks;
}
