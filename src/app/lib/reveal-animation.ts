// Self-contained fade-in-on-scroll effect, shared by every place that ships
// it into HTML that isn't the live WorkspaceView editor iframe (which gets
// its own copy via BASE_CSS/BASE_SCRIPT in base-css.ts). Kept dependency-free
// (no window flag) so it works standalone in an exported/published document.
export const REVEAL_CSS = `<style>
.reveal{opacity:0;transform:translateY(24px);transition:opacity 0.6s cubic-bezier(0.16,1,0.3,1),transform 0.6s cubic-bezier(0.16,1,0.3,1)}
.reveal.is-visible{opacity:1;transform:translateY(0)}
</style>`;

// Safety nets beyond the plain "reveal on intersect" behavior, all aimed at
// the same failure mode: a .reveal element that can never legitimately
// become permanently invisible.
// 1. CSS containing-block gotcha: setting a `transform` on ANY element (even
//    translateY(0)) makes it the containing block for its position:fixed
//    descendants. Webflow's common "fixed decorative background banner"
//    pattern breaks completely if its wrapper ever gets .reveal's transform —
//    the banners collapse to zero size instead of covering the viewport. Any
//    reveal candidate containing (or itself being) position:fixed is skipped
//    entirely rather than risk that.
// 2. A zero-area element (e.g. a wrapper whose only in-flow contribution
//    collapses to 0 height) is revealed immediately instead of observed: it
//    has no meaningful "intersection" to wait for, and some browsers never
//    report an intersecting entry for a zero-area target.
// 3. A blanket timeout force-reveals anything still hidden after 6s, so any
//    other unforeseen case (polyfill quirks, an element that never quite
//    clears the rootMargin) can't leave content permanently invisible.
export const REVEAL_SCRIPT = `<script>(function(){
var els=document.querySelectorAll('.reveal');
var o=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-visible');o.unobserve(e.target);}})},{threshold:0.08,rootMargin:'0px 0px -40px 0px'});
function hasFixed(e){
  if(getComputedStyle(e).position==='fixed')return true;
  var all=e.querySelectorAll('*');
  for(var i=0;i<all.length;i++){if(getComputedStyle(all[i]).position==='fixed')return true;}
  return false;
}
els.forEach(function(e){
  if(hasFixed(e)){e.classList.remove('reveal');return;}
  var r=e.getBoundingClientRect();
  if(r.width===0||r.height===0){e.classList.add('is-visible');}
  else{o.observe(e);}
});
setTimeout(function(){els.forEach(function(e){e.classList.contains('is-visible')||e.classList.add('is-visible');});},6000);
})();</script>`;

// Webflow exports consistently use <section> for each major content block —
// tag every one so the page gets the same scroll-reveal feel as WevyFlow's
// own AI-generated templates, without needing a real DOM parser server-side.
export function addRevealToSections(html: string): string {
  return html.replace(/<section\b([^>]*)>/gi, (_match, attrs: string) => {
    const classMatch = attrs.match(/\sclass=(["'])([^"']*)\1/i);
    if (classMatch) {
      if (new RegExp(`(^|\\s)reveal(\\s|$)`).test(classMatch[2])) return `<section${attrs}>`;
      const newAttrs = attrs.replace(
        classMatch[0],
        () => ` class=${classMatch[1]}${classMatch[2]} reveal${classMatch[1]}`
      );
      return `<section${newAttrs}>`;
    }
    return `<section${attrs} class="reveal">`;
  });
}

// Inserts the CSS/JS pair right before </head> and </body> respectively.
// No-ops (returns html unchanged past that point) if those tags are missing.
export function injectRevealAssets(html: string): string {
  let out = html;
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, () => `${REVEAL_CSS}\n</head>`);
  }
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, () => `${REVEAL_SCRIPT}\n</body>`);
  }
  return out;
}
