// Script to inject into the preview iframe for visual editing
export const IFRAME_VISUAL_EDIT_SCRIPT = `
<script>
(function() {
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
      const newEl = container.firstElementChild;
      if (!newEl) return;

      // Decide where to insert
      const CONTAINER_TAGS = ['DIV','SECTION','MAIN','HEADER','FOOTER','ARTICLE','ASIDE','NAV','UL','OL','FIGURE'];
      let target = selectedEl;
      if (target && CONTAINER_TAGS.indexOf(target.tagName) !== -1) {
        target.appendChild(newEl);
      } else if (target && target.parentElement) {
        target.parentElement.insertBefore(newEl, target.nextSibling);
      } else {
        document.body.appendChild(newEl);
      }

      // Also append any sibling nodes (e.g. HTML with script + div)
      let sibling = container.firstElementChild;
      while (sibling) {
        const next = sibling.nextElementSibling;
        if (sibling !== newEl) newEl.parentNode && newEl.parentNode.appendChild(sibling);
        sibling = next;
      }

      // Revive injected script elements so they actually execute (VTurb, pixels, etc.)
      reviveScripts(newEl);

      // Select the new element
      selectedEl = newEl;
      ensureId(newEl);
      positionOverlay(selectOverlay, newEl);
      selectLabel.textContent = getElementTag(newEl);
      newEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      postCodeUpdated();
      window.parent.postMessage({ type: 'wf-element-selected', id: ensureId(newEl), props: getComputedProps(newEl) }, '*');
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
    if (el === hoverOverlay || el === selectOverlay || el.id?.startsWith('__wf')) return;
    if (el !== hoverEl) {
      hoverEl = el;
      positionOverlay(hoverOverlay, el);
    }
  }, true);

  document.addEventListener('click', function(e) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.target;
    if (el.id?.startsWith('__wf')) return;
    selectedEl = el;
    const id = ensureId(el);
    positionOverlay(selectOverlay, el);
    selectLabel.textContent = getElementTag(el);
    hoverOverlay.style.display = 'none';
    window.parent.postMessage({ type: 'wf-element-selected', id, props: getComputedProps(el) }, '*');
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
    const newEl = container.firstElementChild;
    if (!newEl) return;

    if (dropPosition === 'inside') {
      dropTarget.appendChild(newEl);
    } else if (dropPosition === 'before') {
      dropTarget.parentElement && dropTarget.parentElement.insertBefore(newEl, dropTarget);
    } else {
      dropTarget.parentElement && dropTarget.parentElement.insertBefore(newEl, dropTarget.nextSibling);
    }

    // Append any remaining siblings from the container
    while (container.firstElementChild) {
      newEl.parentNode && newEl.parentNode.insertBefore(container.firstElementChild, newEl.nextSibling);
    }

    reviveScripts(newEl);

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
