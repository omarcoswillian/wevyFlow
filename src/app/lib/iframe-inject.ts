// Script to inject into the preview iframe for visual editing
export const IFRAME_VISUAL_EDIT_SCRIPT = `
<script>
(function() {
  let selectedEl = null;
  let hoverEl = null;
  let editMode = false;

  // Create overlay elements
  const hoverOverlay = document.createElement('div');
  hoverOverlay.id = '__wf_hover';
  hoverOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:99998;border:2px solid rgba(99,102,241,0.5);border-radius:4px;transition:all .15s ease;display:none;';
  document.body.appendChild(hoverOverlay);

  const selectOverlay = document.createElement('div');
  selectOverlay.id = '__wf_select';
  selectOverlay.style.cssText = 'position:fixed;pointer-events:none;z-index:99999;border:2px solid #6366f1;border-radius:4px;display:none;';
  document.body.appendChild(selectOverlay);

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

  function getComputedProps(el) {
    const cs = window.getComputedStyle(el);
    return {
      tag: getElementTag(el),
      text: el.childNodes.length === 1 && el.childNodes[0].nodeType === 3 ? el.textContent : null,
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
        const { property, value } = e.data;
        selectedEl.style[property] = value;
        // Send updated code back
        window.parent.postMessage({ type: 'wf-code-updated', html: document.body.innerHTML }, '*');
        // Re-send props
        window.parent.postMessage({ type: 'wf-element-selected', id: ensureId(selectedEl), props: getComputedProps(selectedEl) }, '*');
      }
    }
    if (e.data.type === 'wf-apply-text') {
      if (selectedEl) {
        selectedEl.textContent = e.data.value;
        window.parent.postMessage({ type: 'wf-code-updated', html: document.body.innerHTML }, '*');
      }
    }
  });

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

  // Update overlays on scroll/resize
  function updateOverlays() {
    if (selectedEl) positionOverlay(selectOverlay, selectedEl);
    if (hoverEl && editMode) positionOverlay(hoverOverlay, hoverEl);
  }
  window.addEventListener('scroll', updateOverlays, true);
  window.addEventListener('resize', updateOverlays);
})();
</script>`;
