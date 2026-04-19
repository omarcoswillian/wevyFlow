// Script to inject into the preview iframe for visual editing
export const IFRAME_VISUAL_EDIT_SCRIPT = `
<script id="__wf_edit_script">
(function() {
  // Idempotent guard: if a previous serialization left a copy of this script
  // in finalCode, multiple copies will execute on iframe load. Without this guard,
  // each copy attaches its own drop/message listeners, causing N inserts per drop.
  if (window.__wfEditScriptLoaded) return;
  window.__wfEditScriptLoaded = true;

  let selectedEl = null;
  let hoverEl = null;
  let editMode = false;

  // Drag-and-drop state
  let dragHtml = null;
  let dropTarget = null;
  let dropPosition = null; // 'before' | 'after' | 'inside'

  // Create overlay elements
  const hoverOverlay = document.createElement('div');
  hoverOverlay.id = '__wf_hover';
  hoverOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:99998;border:2px solid rgba(99,102,241,0.5);border-radius:4px;transition:all .15s ease;display:none;';
  document.body.appendChild(hoverOverlay);

  const selectOverlay = document.createElement('div');
  selectOverlay.id = '__wf_select';
  selectOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;border:2px solid #6366f1;border-radius:4px;display:none;';
  document.body.appendChild(selectOverlay);

  // Drop indicator (line for before/after, dashed border for inside)
  const dropLine = document.createElement('div');
  dropLine.id = '__wf_drop_line';
  dropLine.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;background:#a855f7;box-shadow:0 0 8px rgba(168,85,247,0.6);border-radius:2px;display:none;';
  document.body.appendChild(dropLine);

  const dropBox = document.createElement('div');
  dropBox.id = '__wf_drop_box';
  dropBox.style.cssText = 'position:fixed;pointer-events:none;z-index:99998;border:2px dashed #a855f7;border-radius:4px;background:rgba(168,85,247,0.08);display:none;';
  document.body.appendChild(dropBox);

  // Floating "configure VSL" gear button — appears on hover over [data-wf-vsl-block]
  const vslGear = document.createElement('button');
  vslGear.id = '__wf_vsl_gear';
  vslGear.type = 'button';
  vslGear.title = 'Configurar VSL VTurb';
  // pointer-events:none on children so the click target is always the button itself.
  // Without this, clicking the inner <span> bypasses our __wf detection in capture phase.
  vslGear.innerHTML = '<svg style="pointer-events:none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg><span style="margin-left:6px;pointer-events:none">Configurar</span>';
  vslGear.style.cssText = 'position:fixed;z-index:99999;display:none;align-items:center;justify-content:center;background:#a855f7;color:#fff;border:0;border-radius:8px;padding:6px 10px;font-family:system-ui,-apple-system,sans-serif;font-size:11px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(168,85,247,0.35);pointer-events:auto;transition:transform .12s ease, box-shadow .12s ease;';
  vslGear.onmouseenter = function() { vslGear.style.transform = 'scale(1.05)'; vslGear.style.boxShadow = '0 6px 18px rgba(168,85,247,0.55)'; };
  vslGear.onmouseleave = function() { vslGear.style.transform = ''; vslGear.style.boxShadow = '0 4px 12px rgba(168,85,247,0.35)'; };
  document.body.appendChild(vslGear);

  // Currently-hovered VSL wrapper (drives gear positioning)
  let currentVslWrapper = null;
  // Wrapper ID associated with the gear button (captured at click time)
  let gearTargetId = null;

  function positionGear(wrapper) {
    // Display first so offsetWidth is measurable, then position.
    vslGear.style.display = 'inline-flex';
    const r = wrapper.getBoundingClientRect();
    vslGear.style.top = Math.max(8, r.top + 8) + 'px';
    vslGear.style.left = Math.max(8, r.right - vslGear.offsetWidth - 8) + 'px';
  }

  // Newly inserted elements with .reveal would stay opacity:0 because the
  // IntersectionObserver in BASE_SCRIPT only observes elements present at load.
  // Mark them visible immediately so the user sees what they just added.
  function unhideRevealedSubtree(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.classList && root.classList.contains('reveal')) root.classList.add('is-visible');
    root.querySelectorAll && root.querySelectorAll('.reveal').forEach(function(n){ n.classList.add('is-visible'); });
  }

  function hideGear() {
    vslGear.style.display = 'none';
    currentVslWrapper = null;
  }

  vslGear.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!currentVslWrapper) return;
    gearTargetId = ensureId(currentVslWrapper);
    const cfg = currentVslWrapper.getAttribute('data-wf-vsl-config');
    window.parent.postMessage({
      type: 'wf-open-vsl-config',
      id: gearTargetId,
      config: cfg || null,
    }, '*');
  });

  // Label for selected element
  const selectLabel = document.createElement('div');
  selectLabel.style.cssText = 'position:absolute;top:-22px;left:-2px;background:#6366f1;color:#fff;font-size:10px;padding:2px 8px;border-radius:4px 4px 0 0;font-family:system-ui;white-space:nowrap;';
  selectOverlay.appendChild(selectLabel);

  function positionOverlay(overlay, el) {
    const r = el.getBoundingClientRect();
    overlay.style.left = r.left + 'px';
    overlay.style.top = r.top + 'px';
    overlay.style.width = r.width + 'px';
    overlay.style.height = r.height + 'px';
    overlay.style.display = 'block';
  }

  function getElementTag(el) {
    const tag = el.tagName.toLowerCase();
    const cls = el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(c => c && !c.startsWith('__')).slice(0,2).join('.') : '';
    return tag + cls;
  }

  // Find the longest non-whitespace text node inside an element.
  function findMainTextNode(root) {
    let best = null;
    function walk(node) {
      if (node.nodeType === 3) {
        const t = node.textContent || '';
        if (t.trim() && (!best || t.length > best.textContent.length)) best = node;
      } else if (node.nodeType === 1 && !node.id.startsWith('__wf')) {
        for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i]);
      }
    }
    walk(root);
    return best;
  }

  function getComputedProps(el) {
    const cs = window.getComputedStyle(el);
    const mainText = findMainTextNode(el);
    return {
      tag: getElementTag(el),
      tagName: el.tagName.toLowerCase(),
      text: mainText ? mainText.textContent : null,
      href: el.getAttribute ? (el.getAttribute('href') || '') : '',
      target: el.getAttribute ? (el.getAttribute('target') || '') : '',
      innerHTML: el.innerHTML,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle,
      fontFamily: cs.fontFamily,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      marginTop: cs.marginTop,
      marginRight: cs.marginRight,
      marginBottom: cs.marginBottom,
      marginLeft: cs.marginLeft,
      paddingTop: cs.paddingTop,
      paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom,
      paddingLeft: cs.paddingLeft,
      borderRadius: cs.borderRadius,
      textAlign: cs.textAlign,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      textTransform: cs.textTransform,
      textDecoration: cs.textDecorationLine || cs.textDecoration,
      display: cs.display,
      flexDirection: cs.flexDirection,
      flexWrap: cs.flexWrap,
      justifyContent: cs.justifyContent,
      alignItems: cs.alignItems,
      gap: cs.gap,
      width: el.style.width || cs.width,
      height: el.style.height || cs.height,
      opacity: cs.opacity,
      backgroundImage: cs.backgroundImage,
      backgroundSize: cs.backgroundSize,
      backgroundPosition: cs.backgroundPosition,
      filter: cs.filter,
    };
  }

  // Give each element a unique ID for targeting
  let idCounter = 0;
  function ensureId(el) {
    if (!el.dataset.wfId) {
      el.dataset.wfId = 'wf-' + (idCounter++);
    }
    return el.dataset.wfId;
  }

  // ── Per-breakpoint style isolation ───────────────────────────────────
  // Desktop edits apply as inline styles (the base). Tablet/mobile/ultrawide
  // edits get serialized into a single <style id="wf-responsive-styles"> tag,
  // wrapped in @media queries scoped by [data-wf-id="…"].
  // That matches what the published page sees: on a real 360px phone only the
  // mobile rules apply; the desktop base is preserved untouched.
  const VIEWPORT_MEDIA = {
    ultrawide: '@media (min-width: 1681px)',
    tablet: '@media (min-width: 481px) and (max-width: 1024px)',
    mobile: '@media (max-width: 480px)',
  };
  const responsiveRules = { ultrawide: {}, tablet: {}, mobile: {} };

  function camelToKebab(s) {
    return s.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
  }

  function regenResponsiveCss() {
    // <style> at the start of <body> so serializeBody() captures it on save
    var styleEl = document.getElementById('wf-responsive-styles');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'wf-responsive-styles';
      document.body.insertBefore(styleEl, document.body.firstChild);
    }
    // JSON sidecar — source of truth, survives reload/iframe re-render
    var dataEl = document.getElementById('wf-responsive-data');
    if (!dataEl) {
      dataEl = document.createElement('script');
      dataEl.setAttribute('type', 'application/json');
      dataEl.id = 'wf-responsive-data';
      document.body.insertBefore(dataEl, document.body.firstChild);
    }
    // Escape the close-tag sequence so a stray one in any value can't end
    // the wrapping tag when this body is later re-serialized into the iframe.
    dataEl.textContent = JSON.stringify(responsiveRules).replace(/<\\//g, '<\\\\/');

    var css = '';
    var viewports = ['mobile', 'tablet', 'ultrawide'];
    for (var i = 0; i < viewports.length; i++) {
      var vp = viewports[i];
      var rules = responsiveRules[vp];
      var ids = Object.keys(rules);
      if (ids.length === 0) continue;
      css += VIEWPORT_MEDIA[vp] + ' {\\n';
      for (var j = 0; j < ids.length; j++) {
        var id = ids[j];
        var props = rules[id];
        var propKeys = Object.keys(props);
        if (propKeys.length === 0) continue;
        css += '  [data-wf-id="' + id + '"] {\\n';
        for (var k = 0; k < propKeys.length; k++) {
          css += '    ' + propKeys[k] + ': ' + props[propKeys[k]] + ' !important;\\n';
        }
        css += '  }\\n';
      }
      css += '}\\n';
    }
    styleEl.textContent = css;
  }

  // On boot, restore rules from the JSON sidecar (if the page was previously edited)
  function loadResponsiveRules() {
    var dataEl = document.getElementById('wf-responsive-data');
    if (!dataEl || !dataEl.textContent) return;
    try {
      var loaded = JSON.parse(dataEl.textContent);
      if (loaded && typeof loaded === 'object') {
        if (loaded.mobile)    responsiveRules.mobile    = loaded.mobile;
        if (loaded.tablet)    responsiveRules.tablet    = loaded.tablet;
        if (loaded.ultrawide) responsiveRules.ultrawide = loaded.ultrawide;
        regenResponsiveCss();
      }
    } catch (e) { /* malformed sidecar — ignore */ }
  }

  function applyResponsiveStyle(el, viewport, property, value) {
    var id = ensureId(el);
    if (!responsiveRules[viewport]) return;
    if (!responsiveRules[viewport][id]) responsiveRules[viewport][id] = {};
    var cssProp = camelToKebab(property);
    if (value === '' || value === null || value === undefined) {
      delete responsiveRules[viewport][id][cssProp];
      if (Object.keys(responsiveRules[viewport][id]).length === 0) {
        delete responsiveRules[viewport][id];
      }
    } else {
      responsiveRules[viewport][id][cssProp] = value;
    }
    regenResponsiveCss();
  }

  // Build a light tree of the document for the Layers panel.
  function buildTree() {
    const SKIP_TAGS = { SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, NOSCRIPT: 1 };

    function nodeLabel(el) {
      if (el.dataset && el.dataset.wfName) return el.dataset.wfName;
      const tag = el.tagName.toLowerCase();
      if (el.id && el.id.indexOf('__wf') !== 0) return tag + '#' + el.id;
      const cls = (typeof el.className === 'string' && el.className) ? el.className.split(' ').filter(function(c){ return c && c.indexOf('__') !== 0 && c.indexOf('is-') !== 0 && c !== 'reveal'; }).slice(0,2).join('.') : '';
      if (cls) return tag + '.' + cls;
      if (el.children && el.children.length === 0) {
        const text = (el.textContent || '').trim();
        if (text) return tag + ' "' + text.slice(0, 24) + (text.length > 24 ? '…' : '') + '"';
      }
      return tag;
    }

    function visit(el) {
      if (!el || el.nodeType !== 1) return null;
      if (SKIP_TAGS[el.tagName]) return null;
      if (el.id && el.id.indexOf('__wf') === 0) return null;
      const id = ensureId(el);
      const hidden = !!(el.dataset && el.dataset.wfHidden === '1');
      const children = [];
      for (let i = 0; i < el.children.length; i++) {
        const child = visit(el.children[i]);
        if (child) children.push(child);
      }
      return { id: id, tag: el.tagName.toLowerCase(), label: nodeLabel(el), hidden: hidden, hasChildren: children.length > 0, children: children };
    }

    const out = [];
    for (let i = 0; i < document.body.children.length; i++) {
      const node = visit(document.body.children[i]);
      if (node) out.push(node);
    }
    return out;
  }

  function postCodeUpdated() {
    window.parent.postMessage({ type: 'wf-code-updated', html: serializeBody(), tree: buildTree() }, '*');
  }

  // Serialize body without editor overlays or wf-only attributes
  function serializeBody() {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('[id^="__wf"]').forEach(n => n.remove());
    // Defensive cleanup: strip any leftover BASE_SCRIPT / EDIT_SCRIPT copies
    // that may have accumulated in finalCode before the id-based dedupe was added.
    // Detection uses signatures unique to those scripts so we never touch user code.
    clone.querySelectorAll('script').forEach(function(s){
      const t = s.textContent || '';
      const isEditScript = t.indexOf('__wf_hover') !== -1 || t.indexOf('__wf_select') !== -1;
      const isBaseScript = t.indexOf("querySelectorAll('.reveal')") !== -1 && t.indexOf('IntersectionObserver') !== -1;
      if (isEditScript || isBaseScript) s.parentNode && s.parentNode.removeChild(s);
    });
    return clone.innerHTML;
  }

  // Scripts inserted via innerHTML do not execute. Revive them.
  function reviveScripts(root) {
    const scripts = root.querySelectorAll ? root.querySelectorAll('script') : [];
    scripts.forEach(function(old) {
      const s = document.createElement('script');
      for (let i = 0; i < old.attributes.length; i++) {
        const a = old.attributes[i];
        s.setAttribute(a.name, a.value);
      }
      s.text = old.textContent || '';
      old.parentNode.replaceChild(s, old);
    });
    if (root.tagName === 'SCRIPT') {
      const s = document.createElement('script');
      for (let i = 0; i < root.attributes.length; i++) {
        const a = root.attributes[i];
        s.setAttribute(a.name, a.value);
      }
      s.text = root.textContent || '';
      root.parentNode.replaceChild(s, root);
      return s;
    }
    return root;
  }

  window.addEventListener('message', function(e) {
    if (e.data.type === 'wf-enable-edit') {
      editMode = true;
      document.body.style.cursor = 'crosshair';
    }
    if (e.data.type === 'wf-disable-edit') {
      editMode = false;
      document.body.style.cursor = '';
      hoverOverlay.style.display = 'none';
      selectOverlay.style.display = 'none';
      selectedEl = null;
    }
    if (e.data.type === 'wf-apply-style') {
      if (selectedEl) {
        const { property, value, viewport } = e.data;
        var vp = viewport || 'desktop';
        if (vp === 'desktop') {
          // Base = inline style. Wins by default; @media overrides for other viewports.
          selectedEl.style[property] = value;
        } else {
          // Mobile / tablet / ultrawide = scoped CSS rule under @media query
          applyResponsiveStyle(selectedEl, vp, property, value);
        }
        // Send updated code back
        postCodeUpdated();
        // Re-send props
        window.parent.postMessage({ type: 'wf-element-selected', id: ensureId(selectedEl), props: getComputedProps(selectedEl) }, '*');
      }
    }
    if (e.data.type === 'wf-apply-text') {
      if (selectedEl) {
        const mainText = findMainTextNode(selectedEl);
        if (mainText) {
          mainText.textContent = e.data.value;
        } else {
          // No existing text — prepend a text node so we don't nuke children
          selectedEl.insertBefore(document.createTextNode(e.data.value), selectedEl.firstChild);
        }
        postCodeUpdated();
      }
    }
    if (e.data.type === 'wf-apply-attr' && typeof e.data.name === 'string') {
      if (!selectedEl) return;
      const name = e.data.name;
      const value = e.data.value;
      if (value === null || value === '' || value === undefined) {
        selectedEl.removeAttribute(name);
      } else {
        selectedEl.setAttribute(name, value);
      }
      // If toggling target=_blank, ensure rel=noopener for safety
      if (name === 'target') {
        if (value === '_blank') {
          selectedEl.setAttribute('rel', 'noopener');
        } else {
          selectedEl.removeAttribute('rel');
        }
      }
      postCodeUpdated();
      window.parent.postMessage({ type: 'wf-element-selected', id: ensureId(selectedEl), props: getComputedProps(selectedEl) }, '*');
    }
    if (e.data.type === 'wf-request-tree') {
      window.parent.postMessage({ type: 'wf-tree', tree: buildTree() }, '*');
    }
    if (e.data.type === 'wf-request-selected-html') {
      if (selectedEl) {
        const clone = selectedEl.cloneNode(true);
        clone.querySelectorAll && clone.querySelectorAll('[id^="__wf"]').forEach(n => n.remove());
        window.parent.postMessage({ type: 'wf-selected-html', html: clone.outerHTML, tagName: selectedEl.tagName.toLowerCase() }, '*');
      }
    }
    if (e.data.type === 'wf-select-by-id' && e.data.id) {
      const el = document.querySelector('[data-wf-id="' + e.data.id + '"]');
      if (el) {
        selectedEl = el;
        editMode = true;
        document.body.style.cursor = 'crosshair';
        positionOverlay(selectOverlay, el);
        selectLabel.textContent = getElementTag(el);
        el.scrollIntoView && el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.parent.postMessage({ type: 'wf-element-selected', id: e.data.id, props: getComputedProps(el) }, '*');
      }
    }
    if (e.data.type === 'wf-delete-by-id' && e.data.id) {
      const el = document.querySelector('[data-wf-id="' + e.data.id + '"]');
      if (!el || el === document.body) return;
      if (selectedEl === el) {
        const parent = el.parentElement;
        selectedEl = parent && parent !== document.body ? parent : null;
        if (selectedEl) {
          positionOverlay(selectOverlay, selectedEl);
          selectLabel.textContent = getElementTag(selectedEl);
          window.parent.postMessage({ type: 'wf-element-selected', id: ensureId(selectedEl), props: getComputedProps(selectedEl) }, '*');
        } else {
          selectOverlay.style.display = 'none';
          window.parent.postMessage({ type: 'wf-element-deselected' }, '*');
        }
      }
      el.remove();
      postCodeUpdated();
    }
    if (e.data.type === 'wf-toggle-hidden-by-id' && e.data.id) {
      const el = document.querySelector('[data-wf-id="' + e.data.id + '"]');
      if (!el) return;
      const isHidden = el.dataset.wfHidden === '1';
      if (isHidden) {
        el.dataset.wfHidden = '';
        el.removeAttribute('data-wf-hidden');
        el.style.display = el.dataset.wfPrevDisplay || '';
        el.dataset.wfPrevDisplay = '';
        el.removeAttribute('data-wf-prev-display');
      } else {
        el.dataset.wfPrevDisplay = el.style.display || '';
        el.dataset.wfHidden = '1';
        el.style.display = 'none';
      }
      if (selectedEl === el) positionOverlay(selectOverlay, el);
      postCodeUpdated();
    }
    if (e.data.type === 'wf-rename-by-id' && e.data.id) {
      const el = document.querySelector('[data-wf-id="' + e.data.id + '"]');
      if (!el) return;
      const name = (e.data.name || '').trim();
      if (name) el.dataset.wfName = name;
      else { el.dataset.wfName = ''; el.removeAttribute('data-wf-name'); }
      postCodeUpdated();
    }
    if (e.data.type === 'wf-delete-selected') {
      if (!selectedEl || selectedEl === document.body) return;
      const parent = selectedEl.parentElement;
      selectedEl.remove();
      selectedEl = parent && parent !== document.body ? parent : null;
      if (selectedEl) {
        positionOverlay(selectOverlay, selectedEl);
        selectLabel.textContent = getElementTag(selectedEl);
        window.parent.postMessage({ type: 'wf-element-selected', id: ensureId(selectedEl), props: getComputedProps(selectedEl) }, '*');
      } else {
        selectOverlay.style.display = 'none';
        window.parent.postMessage({ type: 'wf-element-deselected' }, '*');
      }
      postCodeUpdated();
    }
    if (e.data.type === 'wf-duplicate-selected') {
      if (!selectedEl || selectedEl === document.body) return;
      const clone = selectedEl.cloneNode(true);
      // Strip wf-id from clone (+ descendants) so a fresh one gets assigned on selection
      clone.removeAttribute && clone.removeAttribute('data-wf-id');
      clone.querySelectorAll && clone.querySelectorAll('[data-wf-id]').forEach(n => n.removeAttribute('data-wf-id'));
      selectedEl.parentNode && selectedEl.parentNode.insertBefore(clone, selectedEl.nextSibling);
      reviveScripts(clone);
      selectedEl = clone;
      ensureId(clone);
      positionOverlay(selectOverlay, clone);
      selectLabel.textContent = getElementTag(clone);
      clone.scrollIntoView && clone.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      postCodeUpdated();
      window.parent.postMessage({ type: 'wf-element-selected', id: ensureId(clone), props: getComputedProps(clone) }, '*');
    }
    if (e.data.type === 'wf-move-selected' && (e.data.dir === 'up' || e.data.dir === 'down')) {
      if (!selectedEl || !selectedEl.parentElement) return;
      const sibling = e.data.dir === 'up' ? selectedEl.previousElementSibling : selectedEl.nextElementSibling;
      if (!sibling) return;
      if (e.data.dir === 'up') {
        selectedEl.parentElement.insertBefore(selectedEl, sibling);
      } else {
        selectedEl.parentElement.insertBefore(sibling, selectedEl);
      }
      positionOverlay(selectOverlay, selectedEl);
      selectedEl.scrollIntoView && selectedEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      postCodeUpdated();
    }
    if (e.data.type === 'wf-drag-start' && typeof e.data.html === 'string') {
      dragHtml = e.data.html;
      editMode = true;
      document.body.style.cursor = 'copy';
    }
    if (e.data.type === 'wf-drag-end') {
      dragHtml = null;
      dropTarget = null;
      dropPosition = null;
      dropLine.style.display = 'none';
      dropBox.style.display = 'none';
      document.body.style.cursor = editMode ? 'crosshair' : '';
    }
    if (e.data.type === 'wf-insert-html' && typeof e.data.html === 'string') {
      const container = document.createElement('div');
      container.innerHTML = e.data.html.trim();
      // Snapshot all top-level inserted nodes BEFORE moving them around.
      const inserted = Array.prototype.slice.call(container.children);
      // Anchor element = first non-script/style/link/meta, falling back to first child.
      // Used for selection + positioning. Avoids selecting an invisible <style> or <link>.
      const NON_VISIBLE = { SCRIPT:1, STYLE:1, LINK:1, META:1 };
      let newEl = null;
      for (let i = 0; i < inserted.length; i++) {
        if (!NON_VISIBLE[inserted[i].tagName]) { newEl = inserted[i]; break; }
      }
      if (!newEl) newEl = inserted[0];
      if (!newEl) return;

      // Decide where to insert the anchor
      const CONTAINER_TAGS = ['DIV','SECTION','MAIN','HEADER','FOOTER','ARTICLE','ASIDE','NAV','UL','OL','FIGURE'];
      let target = selectedEl;
      if (target && CONTAINER_TAGS.indexOf(target.tagName) !== -1) {
        target.appendChild(newEl);
      } else if (target && target.parentElement) {
        target.parentElement.insertBefore(newEl, target.nextSibling);
      } else {
        document.body.appendChild(newEl);
      }

      // <style>/<link>/<meta> belong in <head> so they apply globally;
      // siblings (extra elements + scripts) follow the anchor.
      const HEAD_TAGS = { STYLE:1, LINK:1, META:1 };
      for (let i = 0; i < inserted.length; i++) {
        const node = inserted[i];
        if (node === newEl) continue;
        if (HEAD_TAGS[node.tagName]) {
          // Dedupe by id when present — avoids piling up identical <style>/<link> on re-insert
          if (node.id && document.getElementById(node.id)) { node.parentNode && node.parentNode.removeChild(node); continue; }
          document.head.appendChild(node);
        } else {
          newEl.parentNode && newEl.parentNode.appendChild(node);
        }
      }

      // Revive injected script elements so they actually execute (VTurb, pixels, etc.)
      // Must cover BOTH children-of-anchor and sibling top-level scripts.
      for (let i = 0; i < inserted.length; i++) {
        if (inserted[i].parentNode) reviveScripts(inserted[i]);
      }
      // Make .reveal elements visible immediately (IntersectionObserver doesn't see new elements)
      for (let i = 0; i < inserted.length; i++) unhideRevealedSubtree(inserted[i]);

      // Select the new element
      selectedEl = newEl;
      ensureId(newEl);
      positionOverlay(selectOverlay, newEl);
      selectLabel.textContent = getElementTag(newEl);
      newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      postCodeUpdated();
      window.parent.postMessage({ type: 'wf-element-selected', id: ensureId(newEl), props: getComputedProps(newEl) }, '*');
    }
    if (e.data.type === 'wf-update-vsl' && typeof e.data.id === 'string' && typeof e.data.html === 'string') {
      console.log('[VSL] wf-update-vsl received', { id: e.data.id, htmlLen: e.data.html.length });
      // Try lookup by data-wf-id first, then fall back to "any VSL block" if exactly one exists.
      // The fallback covers the case where the id mapping drifted across script reloads.
      let wrapper = document.querySelector('[data-wf-id="' + e.data.id + '"]');
      if (!wrapper) {
        const allBlocks = document.querySelectorAll('[data-wf-vsl-block]');
        if (allBlocks.length === 1) {
          wrapper = allBlocks[0];
          console.warn('[VSL] wrapper id "' + e.data.id + '" not found — falling back to the only VSL block on the page');
        } else {
          console.error('[VSL] wrapper not found for id', e.data.id, 'and', allBlocks.length, 'VSL blocks exist — cannot disambiguate');
          window.parent.postMessage({ type: 'wf-vsl-update-result', ok: false, reason: 'wrapper-not-found', id: e.data.id }, '*');
          return;
        }
      }
      console.log('[VSL] wrapper found, replacing innerHTML', wrapper);

      // Cleanup: remove any converteai.net <script> previously injected into <head>
      // by a prior config of THIS or any other VSL block. Safe because the smartplayer
      // component re-registers itself when the new <vturb-smartplayer> is parsed.
      document.querySelectorAll('head script[src*="converteai.net"]').forEach(function(s){ s.parentNode && s.parentNode.removeChild(s); });

      // Remove the old <vturb-smartplayer> instance from the DOM so the player library
      // re-initializes against the fresh tag (otherwise old state can leak across re-configs).
      const oldPlayers = wrapper.querySelectorAll('vturb-smartplayer');
      oldPlayers.forEach(function(p){ p.parentNode && p.parentNode.removeChild(p); });

      // Wipe wrapper contents and apply the new inner HTML
      wrapper.innerHTML = e.data.html;

      // Persist config + state on the wrapper itself (round-trips via export/import)
      if (typeof e.data.config === 'string') wrapper.setAttribute('data-wf-vsl-config', e.data.config);

      // Strip the placeholder visual styles ONLY on first config (empty → configured).
      // Re-config preserves whatever the author later set via the inspector.
      const wasEmpty = wrapper.getAttribute('data-wf-vsl-state') === 'empty';
      if (wasEmpty) wrapper.removeAttribute('style');
      wrapper.setAttribute('data-wf-vsl-state', 'configured');

      // Move <style>/<link> children to <head> (deduped by id) so they apply globally.
      // The reveal <script> stays inside the wrapper (uses document.currentScript scope).
      const HEAD_TAGS = { STYLE:1, LINK:1, META:1 };
      const wrapperChildren = Array.prototype.slice.call(wrapper.children);
      for (let i = 0; i < wrapperChildren.length; i++) {
        const child = wrapperChildren[i];
        if (HEAD_TAGS[child.tagName]) {
          if (child.id && document.getElementById(child.id)) { child.parentNode && child.parentNode.removeChild(child); continue; }
          // Use querySelector for style[data-wf-vsl-block-style] dedupe (no id, but unique attr)
          if (child.tagName === 'STYLE' && child.hasAttribute('data-wf-vsl-block-style') && document.querySelector('head style[data-wf-vsl-block-style]')) {
            child.parentNode && child.parentNode.removeChild(child);
            continue;
          }
          document.head.appendChild(child);
        }
      }

      // Revive scripts so the player + reveal script actually execute
      reviveScripts(wrapper);
      unhideRevealedSubtree(wrapper);

      postCodeUpdated();
      // Re-position the selection overlay since the wrapper's layout likely changed
      if (selectedEl === wrapper) positionOverlay(selectOverlay, wrapper);
      console.log('[VSL] update complete, wrapper now contains', wrapper.children.length, 'children');
      window.parent.postMessage({ type: 'wf-vsl-update-result', ok: true, id: e.data.id }, '*');
    }
    if (e.data.type === 'wf-load-font' && e.data.url) {
      const id = '__wf_font_' + (e.data.family || '').replace(/[^a-z0-9]/gi, '_');
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = e.data.url;
        document.head.appendChild(link);
      }
    }
    if (e.data.type === 'wf-restore-selection' && e.data.id) {
      const el = document.querySelector('[data-wf-id="' + e.data.id + '"]');
      if (el) {
        selectedEl = el;
        positionOverlay(selectOverlay, el);
        selectLabel.textContent = getElementTag(el);
        window.parent.postMessage({ type: 'wf-element-selected', id: e.data.id, props: getComputedProps(el) }, '*');
      }
    }
  });

  // ── Bind selection handlers FIRST ──────────────────────────────────────
  // Anything below could potentially throw on weird user content. Selection
  // must keep working regardless, so it gets attached before everything else.
  document.addEventListener('mousemove', function(e) {
    if (!editMode) return;
    const el = e.target;
    // Skip events when hovering ANY editor-internal element or its descendants
    // (e.g. SVG/span inside the gear button) — keep the gear visible.
    if (el.closest && el.closest('[id^="__wf"]')) return;
    if (el !== hoverEl) {
      hoverEl = el;
      positionOverlay(hoverOverlay, el);
    }
    // VSL gear: show when hovering inside a VSL block, hide otherwise
    const vsl = el.closest && el.closest('[data-wf-vsl-block]');
    if (vsl !== currentVslWrapper) {
      currentVslWrapper = vsl;
      if (vsl) positionGear(vsl); else hideGear();
    } else if (vsl) {
      // Re-position in case the wrapper was scrolled or resized
      positionGear(vsl);
    }
  }, true);

  // Hide gear when mouse leaves the document entirely
  document.addEventListener('mouseleave', function() { hideGear(); });

  document.addEventListener('click', function(e) {
    if (!editMode) return;
    let el = e.target;
    // Click landed on an editor-internal element (gear, overlay, drop indicator)
    // or any descendant — let the native click handler (e.g. gear button) run.
    if (el.closest && el.closest('[id^="__wf"]')) return;
    e.preventDefault();
    e.stopPropagation();
    // VSL blocks: snap selection to the wrapper, not the inner svg/strong/span.
    // Also signals the parent to open the lateral config panel.
    const vslWrapper = el.closest && el.closest('[data-wf-vsl-block]');
    if (vslWrapper) el = vslWrapper;
    selectedEl = el;
    const id = ensureId(el);
    positionOverlay(selectOverlay, el);
    selectLabel.textContent = getElementTag(el);
    hoverOverlay.style.display = 'none';
    window.parent.postMessage({ type: 'wf-element-selected', id, props: getComputedProps(el) }, '*');
    if (vslWrapper) {
      window.parent.postMessage({
        type: 'wf-open-vsl-config',
        id,
        config: vslWrapper.getAttribute('data-wf-vsl-config') || null,
      }, '*');
    }
  }, true);

  // Restore per-breakpoint rules from the JSON sidecar (if the doc was edited before).
  // Wrapped: a malformed sidecar must NEVER block the click handlers above from binding.
  try { loadResponsiveRules(); } catch (e) { /* swallow — selection comes first */ }

  // Notify parent when iframe is ready so selection/edit mode can be restored
  try {
    window.parent.postMessage({ type: 'wf-ready', tree: buildTree() }, '*');
  } catch (e) {
    // Even if buildTree() chokes on user content, post a bare ready signal
    try { window.parent.postMessage({ type: 'wf-ready', tree: [] }, '*'); } catch (_) {}
  }

  const CONTAINER_TAGS = ['DIV','SECTION','MAIN','HEADER','FOOTER','ARTICLE','ASIDE','NAV','UL','OL','FIGURE','BODY'];

  function computeDropZone(el, clientY) {
    const rect = el.getBoundingClientRect();
    const ratio = (clientY - rect.top) / rect.height;
    const isContainer = CONTAINER_TAGS.indexOf(el.tagName) !== -1;
    // Inside zone is the middle 60% for containers
    if (isContainer && ratio > 0.2 && ratio < 0.8) return { pos: 'inside', rect };
    return { pos: ratio < 0.5 ? 'before' : 'after', rect };
  }

  function showDropIndicator(el, pos, rect) {
    if (pos === 'inside') {
      dropLine.style.display = 'none';
      dropBox.style.left = rect.left + 'px';
      dropBox.style.top = rect.top + 'px';
      dropBox.style.width = rect.width + 'px';
      dropBox.style.height = rect.height + 'px';
      dropBox.style.display = 'block';
    } else {
      dropBox.style.display = 'none';
      dropLine.style.left = rect.left + 'px';
      dropLine.style.width = rect.width + 'px';
      dropLine.style.height = '3px';
      dropLine.style.top = (pos === 'before' ? rect.top - 1 : rect.bottom - 2) + 'px';
      dropLine.style.display = 'block';
    }
  }

  document.addEventListener('dragover', function(e) {
    if (!dragHtml) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el.id && el.id.indexOf('__wf') === 0) return;
    const zone = computeDropZone(el, e.clientY);
    dropTarget = el;
    dropPosition = zone.pos;
    showDropIndicator(el, zone.pos, zone.rect);
  });

  document.addEventListener('dragleave', function(e) {
    // Only clear when leaving the window entirely
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      dropLine.style.display = 'none';
      dropBox.style.display = 'none';
    }
  });

  document.addEventListener('drop', function(e) {
    if (!dragHtml || !dropTarget) return;
    e.preventDefault();

    const container = document.createElement('div');
    container.innerHTML = dragHtml.trim();
    const inserted = Array.prototype.slice.call(container.children);
    const NON_VISIBLE = { SCRIPT:1, STYLE:1, LINK:1, META:1 };
    let newEl = null;
    for (let i = 0; i < inserted.length; i++) {
      if (!NON_VISIBLE[inserted[i].tagName]) { newEl = inserted[i]; break; }
    }
    if (!newEl) newEl = inserted[0];
    if (!newEl) return;

    if (dropPosition === 'inside') {
      dropTarget.appendChild(newEl);
    } else if (dropPosition === 'before') {
      dropTarget.parentElement && dropTarget.parentElement.insertBefore(newEl, dropTarget);
    } else {
      dropTarget.parentElement && dropTarget.parentElement.insertBefore(newEl, dropTarget.nextSibling);
    }

    const HEAD_TAGS = { STYLE:1, LINK:1, META:1 };
    for (let i = 0; i < inserted.length; i++) {
      const node = inserted[i];
      if (node === newEl) continue;
      if (HEAD_TAGS[node.tagName]) {
        if (node.id && document.getElementById(node.id)) { node.parentNode && node.parentNode.removeChild(node); continue; }
        document.head.appendChild(node);
      } else {
        newEl.parentNode && newEl.parentNode.insertBefore(node, newEl.nextSibling);
      }
    }

    for (let i = 0; i < inserted.length; i++) {
      if (inserted[i].parentNode) reviveScripts(inserted[i]);
    }
    for (let i = 0; i < inserted.length; i++) unhideRevealedSubtree(inserted[i]);

    selectedEl = newEl;
    ensureId(newEl);
    positionOverlay(selectOverlay, newEl);
    selectLabel.textContent = getElementTag(newEl);
    dropLine.style.display = 'none';
    dropBox.style.display = 'none';

    postCodeUpdated();
    window.parent.postMessage({ type: 'wf-element-selected', id: ensureId(newEl), props: getComputedProps(newEl) }, '*');

    dragHtml = null;
    dropTarget = null;
    dropPosition = null;
  });

  // Update overlays on scroll/resize
  function updateOverlays() {
    if (selectedEl) positionOverlay(selectOverlay, selectedEl);
    if (hoverEl && editMode) positionOverlay(hoverOverlay, hoverEl);
  }
  window.addEventListener('scroll', updateOverlays, true);
  window.addEventListener('resize', updateOverlays);
})();
</script>`;
