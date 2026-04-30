/**
 * PageSpeed optimizer — pure HTML string transformation.
 * Runs client-side after every generation. No AI, no network calls.
 *
 * Targets: Google Fonts blocking, image lazy-load, script defer,
 * fetchpriority on LCP element, viewport meta.
 */

interface OptimizeOptions {
  webhookUrl?: string;
}

export function optimizeHtml(html: string, options: OptimizeOptions = {}): string {
  if (!html || html.trim().length < 200) return html;
  html = consolidateFonts(html);
  html = optimizeImages(html);
  html = deferScripts(html);
  html = ensureMetaTags(html);
  if (options.webhookUrl) html = injectWebhookHandler(html, options.webhookUrl);
  return html;
}

/* ── 1. Google Fonts → non-blocking pattern ────────────────── */
function consolidateFonts(html: string): string {
  // Match every <link> pointing to fonts.googleapis.com
  const fontLinkRe = /<link\b[^>]*href=["']https?:\/\/fonts\.googleapis\.com\/css2?\?[^"']*["'][^>]*\/?>/gi;
  const found = html.match(fontLinkRe);
  if (!found || found.length === 0) return html;

  // Extract href values
  const hrefRe = /href=["'](https?:\/\/fonts\.googleapis\.com\/[^"']+)["']/i;
  const allFamilies: string[] = [];
  const seenFamilies = new Set<string>();

  for (const tag of found) {
    const hrefM = hrefRe.exec(tag);
    if (!hrefM) continue;
    const url = hrefM[1];
    // Extract each family=... param
    const familyRe = /family=([^&\s]+)/g;
    let m: RegExpExecArray | null;
    while ((m = familyRe.exec(url)) !== null) {
      const raw = decodeURIComponent(m[1]);
      if (!seenFamilies.has(raw)) {
        seenFamilies.add(raw);
        allFamilies.push(m[1]); // keep URL-encoded for the output URL
      }
    }
  }

  // Remove all existing font link tags
  html = html.replace(fontLinkRe, "");

  if (allFamilies.length === 0) return html;

  const mergedUrl =
    "https://fonts.googleapis.com/css2?" +
    allFamilies.map((f) => `family=${f}`).join("&") +
    "&display=swap";

  // Non-blocking font loading (web.dev recommended pattern)
  const fontBlock = [
    `<link rel="preconnect" href="https://fonts.googleapis.com">`,
    `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
    `<link rel="preload" href="${mergedUrl}" as="style" onload="this.onload=null;this.rel='stylesheet'">`,
    `<noscript><link rel="stylesheet" href="${mergedUrl}"></noscript>`,
  ].join("\n");

  // Insert right after <head> (or <head ...>)
  if (/<head\b/i.test(html)) {
    html = html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${fontBlock}`);
  } else {
    // Bare fragment — prepend
    html = fontBlock + "\n" + html;
  }

  return html;
}

/* ── 2. Images: lazy-load + fetchpriority on LCP ───────────── */
function optimizeImages(html: string): string {
  let heroFound = false;

  // Process each <img tag
  return html.replace(/<img\b([^>]*?)(\/?|>)/gi, (_fullMatch, attrs: string, closing: string) => {
    // Skip if already has explicit loading attribute
    const hasLoading = /\bloading\s*=/i.test(attrs);
    const hasFetchPriority = /\bfetchpriority\s*=/i.test(attrs);
    const hasDecoding = /\bdecoding\s*=/i.test(attrs);

    let newAttrs = attrs;

    if (!heroFound) {
      // First image = LCP candidate → eager + high priority
      heroFound = true;
      if (!hasLoading) newAttrs += ' loading="eager"';
      if (!hasFetchPriority) newAttrs += ' fetchpriority="high"';
    } else {
      // Subsequent images → lazy + async decode
      if (!hasLoading) newAttrs += ' loading="lazy"';
      if (!hasDecoding) newAttrs += ' decoding="async"';
    }

    return `<img${newAttrs}${closing}`;
  });
}

/* ── 3. Script defer ───────────────────────────────────────── */
function deferScripts(html: string): string {
  // Only process external scripts without async/defer already set
  return html.replace(
    /<script\b([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi,
    (_full, before: string, src: string, after: string) => {
      const combined = (before + after).toLowerCase();
      // Skip if already deferred/async, or if it's a data: or inline source
      if (/\bdefer\b/.test(combined) || /\basync\b/.test(combined)) {
        return _full;
      }
      if (src.startsWith("data:")) return _full;
      // Add defer
      return `<script${before}src="${src}"${after} defer>`;
    }
  );
}

/* ── 4. Ensure critical meta tags ──────────────────────────── */
function ensureMetaTags(html: string): string {
  const hasCharset = /<meta\b[^>]*charset/i.test(html);
  const hasViewport = /<meta\b[^>]*name=["']viewport["']/i.test(html);

  if (hasCharset && hasViewport) return html;

  const missing: string[] = [];
  if (!hasCharset) missing.push('<meta charset="UTF-8">');
  if (!hasViewport)
    missing.push(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
    );

  if (missing.length === 0) return html;

  const inject = missing.join("\n");

  if (/<head\b/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (m) => `${m}\n${inject}`);
  }
  // No head — try inserting before first <link or <style or <script
  if (/<link\b|<style\b|<script\b/i.test(html)) {
    return html.replace(/(<link\b|<style\b|<script\b)/i, `${inject}\n$1`);
  }
  return inject + "\n" + html;
}

/* ── 5. Webhook form handler injection ─────────────────────── */
function injectWebhookHandler(html: string, webhookUrl: string): string {
  if (!webhookUrl || !/<form\b/i.test(html)) return html;

  const script = `
<script>
(function(){
  var WH="${webhookUrl.replace(/"/g, '\\"')}";
  if(!WH)return;
  document.addEventListener("submit",function(e){
    var form=e.target;
    if(!(form instanceof HTMLFormElement))return;
    e.preventDefault();
    var data={};
    new FormData(form).forEach(function(v,k){data[k]=v;});
    fetch(WH,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)})
      .then(function(){
        form.innerHTML='<div style="text-align:center;padding:48px 24px;color:#22c55e;font-size:18px;font-weight:600;font-family:inherit">Cadastrado com sucesso!<br><span style="font-size:13px;color:#6b7280;font-weight:400;display:block;margin-top:8px">Em breve entraremos em contato.</span></div>';
      })
      .catch(function(){
        var btn=form.querySelector('[type=submit]');
        if(btn)btn.removeAttribute('disabled');
      });
    var btn=form.querySelector('[type=submit]');
    if(btn)btn.setAttribute('disabled','');
  });
})();
</script>`.trim();

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${script}\n</body>`);
  }
  return html + "\n" + script;
}
