figma.showUI(__html__, { width: 380, height: 440, title: "WevyFlow Export" });

/* ─── Helpers ───────────────────────────────────────────── */

function toHex2(n) {
  var h = Math.round(n).toString(16);
  return h.length < 2 ? "0" + h : h;
}
function rgbToHex(c, a) {
  var r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
  var alpha = (a != null) ? a : 1;
  if (alpha < 0.99) return "rgba(" + r + "," + g + "," + b + "," + alpha.toFixed(3) + ")";
  return "#" + toHex2(r) + toHex2(g) + toHex2(b);
}
function getFontWeight(style) {
  var s = (style || "").toLowerCase();
  if (s.indexOf("black") >= 0) return "900";
  if (s.indexOf("extrabold") >= 0) return "800";
  if (s.indexOf("semibold") >= 0 || s.indexOf("demi") >= 0) return "600";
  if (s.indexOf("bold") >= 0) return "700";
  if (s.indexOf("medium") >= 0) return "500";
  if (s.indexOf("extralight") >= 0) return "200";
  if (s.indexOf("thin") >= 0) return "100";
  if (s.indexOf("light") >= 0) return "300";
  return "400";
}
function extractTextFill(node, w, h) {
  var fills = node.fills;
  if (!fills || fills === figma.mixed || fills.length === 0) return "#ffffff";
  for (var i = fills.length - 1; i >= 0; i--) {
    var fi = fills[i];
    if (fi.visible === false) continue;
    if (fi.type === "SOLID") return rgbToHex(fi.color, (fi.opacity != null) ? fi.opacity : 1);
    if (fi.type === "GRADIENT_LINEAR") {
      var pos = fi.gradientHandlePositions;
      if (!pos || pos.length < 2) continue;
      var stops = (fi.gradientStops || []).map(function(s) {
        var c = s.color;
        return { offset: s.position, color: rgbToHex({ r: c.r, g: c.g, b: c.b }, c.a != null ? c.a : 1) };
      });
      return {
        type: "linear",
        coords: { x1: pos[0].x * w, y1: pos[0].y * h, x2: pos[1].x * w, y2: pos[1].y * h },
        colorStops: stops,
        gradientUnits: "pixels",
        offsetX: 0,
        offsetY: 0,
      };
    }
  }
  return "#ffffff";
}

function extractTextSegments(node, defaultFamily, defaultWeight, defaultFontSize) {
  try {
    var segs = node.getStyledTextSegments(['fontName', 'fontSize', 'fills']);
    if (!segs || segs.length <= 1) return null;
    var result = [];
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      var segFill = null;
      if (seg.fills && seg.fills !== figma.mixed && seg.fills.length > 0) {
        for (var f = seg.fills.length - 1; f >= 0; f--) {
          var sfi = seg.fills[f];
          if (sfi.visible !== false && sfi.type === "SOLID") {
            segFill = rgbToHex(sfi.color, sfi.opacity != null ? sfi.opacity : 1);
            break;
          }
        }
      }
      var segFamily = defaultFamily, segWeight = defaultWeight, segStyle = "normal", segSize = defaultFontSize;
      if (seg.fontName && seg.fontName !== figma.mixed) {
        segFamily = seg.fontName.family;
        segWeight = getFontWeight(seg.fontName.style);
        segStyle = seg.fontName.style.toLowerCase().indexOf("italic") >= 0 ? "italic" : "normal";
      }
      if (seg.fontSize != null && seg.fontSize !== figma.mixed) segSize = Math.round(seg.fontSize);
      result.push({ start: seg.start, end: seg.end, fontFamily: segFamily, fontWeight: segWeight, fontStyle: segStyle, fontSize: segSize, fill: segFill });
    }
    return result;
  } catch (e) { return null; }
}

function slugify(str) {
  return (str || "template").toLowerCase()
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "template";
}

var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function bytesToBase64(bytes) {
  var len = bytes.length, parts = [], CHUNK = 768;
  for (var off = 0; off < len; off += CHUNK) {
    var s = "", end = (off + CHUNK < len) ? off + CHUNK : len;
    for (var i = off; i < end; i += 3) {
      var b0 = bytes[i], b1 = (i + 1 < len) ? bytes[i + 1] : 0, b2 = (i + 2 < len) ? bytes[i + 2] : 0;
      s += B64[b0 >> 2];
      s += B64[((b0 & 3) << 4) | (b1 >> 4)];
      s += (i + 1 < len) ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
      s += (i + 2 < len) ? B64[b2 & 63] : "=";
    }
    parts.push(s);
  }
  return parts.join("");
}

async function exportNodePNG(node) {
  var bytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 1 } });
  return "data:image/png;base64," + bytesToBase64(bytes);
}

/* ─── Node classification helpers ───────────────────────── */

var VECTOR_TYPES = ["VECTOR", "STAR", "POLYGON", "BOOLEAN_OPERATION", "LINE"];
function isVectorType(t) { return VECTOR_TYPES.indexOf(t) >= 0; }

/* Check if a node has any TEXT descendant */
function hasTextDescendant(node) {
  if (node.type === "TEXT") return true;
  if (node.children) {
    for (var i = 0; i < node.children.length; i++)
      if (hasTextDescendant(node.children[i])) return true;
  }
  return false;
}

/* Collect ALL TEXT nodes within a subtree */
function collectTextDescendants(node, out) {
  if (!node || node.visible === false) return;
  if (node.type === "TEXT") { out.push(node); return; }
  if (node.children) {
    for (var i = 0; i < node.children.length; i++)
      collectTextDescendants(node.children[i], out);
  }
}

/* Check if node is a descendant of ancestor */
function isDescendantOf(node, ancestor) {
  var p = node.parent;
  while (p) {
    if (p === ancestor) return true;
    p = p.parent;
  }
  return false;
}

/* Collect containers (leaf frames with mixed icon+text content).
   Drills recursively: if a frame's direct children are sub-frames with mixed
   content (e.g. DATA E HORA → [Frame 28484 #1, Frame 28484 #2]), it collects
   the sub-frames individually and adds the parent to outParents (for hiding).
   outLeaves  → frames to export as WFGroup objects (icon + editable texts)
   outParents → intermediate wrapper frames to hide during background export */
function collectContainerNodes(node, fx, fy, outLeaves, outParents) {
  var children = node.children;
  if (!children) return;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (!child || child.visible === false) continue;
    if (child.type !== "GROUP" && child.type !== "FRAME" && child.type !== "COMPONENT") continue;
    if (!child.children || child.children.length === 0) continue;
    if (!child.absoluteTransform || !child.absoluteTransform[0]) continue;

    /* All-vector group → handled by collectVectors as icon */
    var allVec = true;
    for (var j = 0; j < child.children.length; j++) {
      if (!isVectorType(child.children[j].type)) { allVec = false; break; }
    }
    if (allVec) continue;

    /* Must have text somewhere inside */
    if (!hasTextDescendant(child)) continue;

    /* Check if any direct child is itself a sub-container with mixed text content.
       If yes → drill down (collect sub-containers individually). */
    var hasSubContainerWithText = false;
    for (var k = 0; k < child.children.length; k++) {
      var sub = child.children[k];
      if ((sub.type === "GROUP" || sub.type === "FRAME" || sub.type === "COMPONENT") &&
          sub.children && sub.children.length > 0 &&
          hasTextDescendant(sub)) {
        hasSubContainerWithText = true;
        break;
      }
    }

    if (hasSubContainerWithText) {
      /* Wrapper frame — hide it during background export but don't export as image */
      if (outParents) outParents.push(child);
      collectContainerNodes(child, fx, fy, outLeaves, outParents);
    } else {
      /* Leaf container — export as WFGroup */
      outLeaves.push({
        node: child,
        ax: child.absoluteTransform[0][2] - fx,
        ay: child.absoluteTransform[1][2] - fy,
      });
    }
  }
}

/* Collect top-level RECTANGLE/ELLIPSE children of the root frame
   that have a non-IMAGE fill (gradient/solid overlays like "Rectangle 2519").
   Returns items with fill metadata so they can be exported as native Fabric Rects. */
function collectTopLevelShapes(frame, fx, fy, out) {
  if (!frame.children) return;
  for (var i = 0; i < frame.children.length; i++) {
    var child = frame.children[i];
    if (!child || child.visible === false) continue;
    if (child.type !== "RECTANGLE" && child.type !== "ELLIPSE") continue;
    if (!child.absoluteTransform || !child.absoluteTransform[0]) continue;

    var hasNonImageFill = false;
    if (child.fills && child.fills !== figma.mixed) {
      for (var f = 0; f < child.fills.length; f++) {
        var fill = child.fills[f];
        if (fill.visible !== false && fill.type !== "IMAGE") { hasNonImageFill = true; break; }
      }
    }
    if (!hasNonImageFill) continue;

    out.push({
      node: child,
      ax: child.absoluteTransform[0][2] - fx,
      ay: child.absoluteTransform[1][2] - fy,
    });
  }
}

/* Build a native Fabric.js Rect JSON from a Figma shape node's fills.
   Returns null when the fill can't be represented natively (e.g. radial gradient),
   in which case the caller should fall back to a PNG export. */
function buildNativeRectObj(node, ax, ay) {
  var fills = node.fills;
  if (!fills || fills === figma.mixed || fills.length === 0) return null;

  var fill = null;
  for (var f = 0; f < fills.length; f++) {
    var fi = fills[f];
    if (fi.visible === false || fi.type === "IMAGE") continue;

    if (fi.type === "SOLID") {
      fill = rgbToHex(fi.color, (fi.opacity != null) ? fi.opacity : 1);
      break;
    }
    if (fi.type === "GRADIENT_LINEAR") {
      var pos = fi.gradientHandlePositions;
      if (!pos || pos.length < 2) return null;
      var w = Math.round(node.width), h = Math.round(node.height);
      var x1 = pos[0].x * w, y1 = pos[0].y * h;
      var x2 = pos[1].x * w, y2 = pos[1].y * h;
      var stops = (fi.gradientStops || []).map(function(s) {
        var c = s.color;
        return { offset: s.position, color: rgbToHex({ r: c.r, g: c.g, b: c.b }, c.a != null ? c.a : 1) };
      });
      fill = {
        type: "linear",
        coords: { x1: x1, y1: y1, x2: x2, y2: y2 },
        colorStops: stops,
        gradientUnits: "pixels",
        offsetX: 0,
        offsetY: 0,
      };
      break;
    }
    /* Other gradient types → can't represent natively */
    return null;
  }
  if (fill === null) return null;

  var rx = 0;
  try {
    if (node.cornerRadius !== figma.mixed && typeof node.cornerRadius === "number") rx = node.cornerRadius;
  } catch (e) {}

  var strokeColor = null, strokeWidth = 0;
  try {
    if (node.strokes && node.strokes !== figma.mixed && node.strokes.length > 0) {
      var st = node.strokes[0];
      if (st.visible !== false && st.type === "SOLID") {
        strokeColor = rgbToHex(st.color, st.opacity != null ? st.opacity : 1);
        strokeWidth = typeof node.strokeWeight === "number" ? node.strokeWeight : 1;
      }
    }
  } catch (e) {}

  return {
    type: "Rect",
    originX: "left", originY: "top",
    left: Math.round(ax),
    top: Math.round(ay),
    width: Math.round(node.width),
    height: Math.round(node.height),
    rx: rx, ry: rx,
    fill: fill,
    opacity: (node.opacity != null) ? node.opacity : 1,
    selectable: true,
    evented: true,
    name: node.name || "shape",
    stroke: strokeColor,
    strokeWidth: strokeWidth,
  };
}

/* Collect VECTOR / all-vector-group nodes.
   skipList: array of nodes to skip entirely (container nodes). */
function collectVectors(node, frameNode, skipList, fx, fy, out) {
  try {
    if (!node || node.visible === false) return;

    for (var s = 0; s < skipList.length; s++) {
      if (node === skipList[s]) return;
    }

    if (node === frameNode) {
      if (node.children)
        for (var i = 0; i < node.children.length; i++)
          collectVectors(node.children[i], frameNode, skipList, fx, fy, out);
      return;
    }

    if (!node.absoluteTransform || !node.absoluteTransform[0]) return;

    if (isVectorType(node.type)) {
      out.push({ node: node, ax: node.absoluteTransform[0][2] - fx, ay: node.absoluteTransform[1][2] - fy });
      return;
    }

    if ((node.type === "GROUP" || node.type === "FRAME" || node.type === "COMPONENT") && node.children && node.children.length > 0) {
      var allVec = true;
      for (var j = 0; j < node.children.length; j++) {
        if (!isVectorType(node.children[j].type)) { allVec = false; break; }
      }
      if (allVec) {
        out.push({ node: node, ax: node.absoluteTransform[0][2] - fx, ay: node.absoluteTransform[1][2] - fy });
        return;
      }
      for (var k = 0; k < node.children.length; k++)
        collectVectors(node.children[k], frameNode, skipList, fx, fy, out);
    }
  } catch (e) {}
}

/* Collect ALL TEXT nodes recursively (including inside containers) */
function collectTexts(node, fx, fy, out) {
  try {
    if (!node || node.visible === false) return;
    if (!node.absoluteTransform || !node.absoluteTransform[0]) return;
    if (node.type === "TEXT") {
      out.push({ node: node, ax: node.absoluteTransform[0][2] - fx, ay: node.absoluteTransform[1][2] - fy });
    } else if (node.children) {
      for (var i = 0; i < node.children.length; i++) collectTexts(node.children[i], fx, fy, out);
    }
  } catch (e) {}
}

/* ─── TEXT → WFTextbox child object ─────────────────────── */

/* Build a text object for use inside a WFGroup (positions relative to container top-left) */
function makeTextChildObj(node, relLeft, relTop) {
  var family = "Montserrat", styleName = "Regular";
  if (node.fontName !== figma.mixed) { family = node.fontName.family; styleName = node.fontName.style; }
  var fontSize = (node.fontSize !== figma.mixed) ? Math.round(node.fontSize) : 16;
  var fontWeight = getFontWeight(styleName);
  var fillColor = extractTextFill(node, node.width, node.height);
  var segments = extractTextSegments(node, family, fontWeight, fontSize);
  var charSpacing = 0;
  if (node.letterSpacing !== figma.mixed) {
    var ls = node.letterSpacing;
    if (ls.unit === "PERCENT") charSpacing = Math.round(ls.value * 10);
    else if (ls.unit === "PIXELS") charSpacing = Math.round((ls.value / fontSize) * 1000);
  }
  var lineHeight = 1.2;
  if (node.lineHeight !== figma.mixed) {
    var lh = node.lineHeight;
    if (lh.unit === "PIXELS") lineHeight = Math.round((lh.value / fontSize) * 100) / 100;
    else if (lh.unit === "PERCENT") lineHeight = Math.round((lh.value / 100) * 100) / 100;
  }
  var textAlign = "left";
  if (node.textAlignHorizontal === "CENTER") textAlign = "center";
  else if (node.textAlignHorizontal === "RIGHT") textAlign = "right";
  else if (node.textAlignHorizontal === "JUSTIFIED") textAlign = "justify";
  var isItalic = styleName.toLowerCase().indexOf("italic") >= 0;
  var obj = {
    type: "WFTextbox",
    name: node.name || "text",
    left: Math.round(relLeft),
    top: Math.round(relTop),
    width: Math.round(node.width * 1.2),
    text: node.characters || "",
    fontSize: fontSize,
    fontFamily: family,
    fontWeight: fontWeight,
    fontStyle: isItalic ? "italic" : "normal",
    fill: fillColor,
    textAlign: textAlign,
    charSpacing: charSpacing,
    lineHeight: lineHeight,
    opacity: (node.opacity != null) ? node.opacity : 1,
  };
  if (segments) obj.segments = segments;
  return obj;
}

/* ─── TEXT → Fabric Textbox (top-level) ─────────────────── */

function makeTextObj(item, frameWidth) {
  var node = item.node;
  var family = "Montserrat", styleName = "Regular";
  if (node.fontName !== figma.mixed) { family = node.fontName.family; styleName = node.fontName.style; }
  var fontSize = (node.fontSize !== figma.mixed) ? Math.round(node.fontSize) : 16;
  var fontWeight = getFontWeight(styleName);
  var fillColor = extractTextFill(node, node.width, node.height);
  var segments = extractTextSegments(node, family, fontWeight, fontSize);
  var charSpacing = 0;
  if (node.letterSpacing !== figma.mixed) {
    var ls = node.letterSpacing;
    if (ls.unit === "PERCENT") charSpacing = Math.round(ls.value * 10);
    else if (ls.unit === "PIXELS") charSpacing = Math.round((ls.value / fontSize) * 1000);
  }
  var lineHeight = 1.2;
  if (node.lineHeight !== figma.mixed) {
    var lh = node.lineHeight;
    if (lh.unit === "PIXELS") lineHeight = Math.round((lh.value / fontSize) * 100) / 100;
    else if (lh.unit === "PERCENT") lineHeight = Math.round((lh.value / 100) * 100) / 100;
  }
  var textAlign = "left";
  if (node.textAlignHorizontal === "CENTER") textAlign = "center";
  else if (node.textAlignHorizontal === "RIGHT") textAlign = "right";
  else if (node.textAlignHorizontal === "JUSTIFIED") textAlign = "justify";
  var isItalic = styleName.toLowerCase().indexOf("italic") >= 0;
  var boxWidth = Math.round(node.width * 1.2);
  var obj = {
    type: "Textbox", originX: "left", originY: "top",
    left: Math.round(item.ax), top: Math.round(item.ay),
    width: boxWidth, text: node.characters || "",
    fontSize: fontSize, fontFamily: family,
    fontWeight: fontWeight,
    fontStyle: isItalic ? "italic" : "normal",
    fill: fillColor, textAlign: textAlign,
    charSpacing: charSpacing, lineHeight: lineHeight,
    opacity: (node.opacity != null) ? node.opacity : 1,
    editable: true, selectable: true,
    name: node.name || "text",
  };
  if (segments) obj.segments = segments;
  return obj;
}

/* ─── Export container as WFGroup ───────────────────────── */

/* Determine if a child node inside a container has an IMAGE fill (photo) */
function hasImageFill(node) {
  if (!node.fills || node.fills === figma.mixed) return false;
  for (var i = 0; i < node.fills.length; i++) {
    if (node.fills[i].visible !== false && node.fills[i].type === "IMAGE") return true;
  }
  return false;
}

/* Recursively export a container node as a WFGroup JSON object.
   cx, cy = frame-relative position of the container's top-left corner (used for WFGroup.left/top).
   Child positions are computed relative to the container's own absolute transform. */
async function exportContainerAsGroup(cNode, cx, cy) {
  var children = [];
  var nodeChildren = cNode.children;
  if (!nodeChildren) return null;

  /* Use the container node's own absolute position as the reference for child offsets.
     This avoids the bug where cx (frame-relative) is subtracted from an absolute coordinate. */
  var containerAbsX = cNode.absoluteTransform[0][2];
  var containerAbsY = cNode.absoluteTransform[1][2];

  for (var i = 0; i < nodeChildren.length; i++) {
    var child = nodeChildren[i];
    if (!child || child.visible === false) continue;
    if (!child.absoluteTransform || !child.absoluteTransform[0]) continue;

    var relLeft = child.absoluteTransform[0][2] - containerAbsX;
    var relTop = child.absoluteTransform[1][2] - containerAbsY;

    try {
      /* TEXT node → WFTextbox */
      if (child.type === "TEXT") {
        children.push(makeTextChildObj(child, relLeft, relTop));
        continue;
      }

      /* All-vector group or individual vector → WFImage */
      if (isVectorType(child.type)) {
        var vb64 = await exportNodePNG(child);
        children.push({
          type: "WFImage",
          name: child.name || "icon",
          src: vb64,
          left: Math.round(relLeft),
          top: Math.round(relTop),
          width: Math.round(child.width),
          height: Math.round(child.height),
        });
        continue;
      }

      if ((child.type === "GROUP" || child.type === "FRAME" || child.type === "COMPONENT") && child.children) {
        /* All-vector group → WFImage */
        var allVec2 = true;
        for (var j2 = 0; j2 < child.children.length; j2++) {
          if (!isVectorType(child.children[j2].type)) { allVec2 = false; break; }
        }
        if (allVec2) {
          var vgb64 = await exportNodePNG(child);
          children.push({
            type: "WFImage",
            name: child.name || "icon",
            src: vgb64,
            left: Math.round(relLeft),
            top: Math.round(relTop),
            width: Math.round(child.width),
            height: Math.round(child.height),
          });
          continue;
        }

        /* Sub-container with text → recurse into nested WFGroup */
        if (hasTextDescendant(child)) {
          var nestedGroup = await exportContainerAsGroup(
            child,
            child.absoluteTransform[0][2],
            child.absoluteTransform[1][2]
          );
          if (nestedGroup) {
            /* Override the group's left/top to be relative to parent container */
            nestedGroup.left = Math.round(relLeft);
            nestedGroup.top = Math.round(relTop);
            children.push(nestedGroup);
          }
          continue;
        }
      }

      /* RECTANGLE or ELLIPSE with IMAGE fill → WFImage */
      if ((child.type === "RECTANGLE" || child.type === "ELLIPSE") && hasImageFill(child)) {
        var imgb64 = await exportNodePNG(child);
        children.push({
          type: "WFImage",
          name: child.name || "image",
          src: imgb64,
          left: Math.round(relLeft),
          top: Math.round(relTop),
          width: Math.round(child.width),
          height: Math.round(child.height),
        });
        continue;
      }

      /* RECTANGLE or ELLIPSE with non-IMAGE fill → WFRect */
      if (child.type === "RECTANGLE" || child.type === "ELLIPSE") {
        var nativeRect = buildNativeRectObj(child, relLeft, relTop);
        if (nativeRect) {
          /* Rename to WFRect so the canvas loader handles it correctly */
          nativeRect.type = "WFRect";
          children.push(nativeRect);
        } else {
          /* Radial gradient etc. → fallback PNG */
          var rb64 = await exportNodePNG(child);
          children.push({
            type: "WFImage",
            name: child.name || "shape",
            src: rb64,
            left: Math.round(relLeft),
            top: Math.round(relTop),
            width: Math.round(child.width),
            height: Math.round(child.height),
          });
        }
        continue;
      }

      /* Anything else (e.g. star/polygon at root of container) → PNG */
      var eb64 = await exportNodePNG(child);
      children.push({
        type: "WFImage",
        name: child.name || "element",
        src: eb64,
        left: Math.round(relLeft),
        top: Math.round(relTop),
        width: Math.round(child.width),
        height: Math.round(child.height),
      });

    } catch (childErr) {
      /* Skip failed children silently */
    }
  }

  if (children.length === 0) return null;

  var layoutDir = "none";
  try {
    if (cNode.layoutMode === "HORIZONTAL") layoutDir = "horizontal";
    else if (cNode.layoutMode === "VERTICAL") layoutDir = "vertical";
  } catch (e) {}
  var layoutGap = 0;
  try {
    if (typeof cNode.itemSpacing === "number") layoutGap = Math.round(cNode.itemSpacing);
  } catch (e) {}

  return {
    type: "WFGroup",
    name: cNode.name || "group",
    left: Math.round(cx),
    top: Math.round(cy),
    width: Math.round(cNode.width),
    height: Math.round(cNode.height),
    opacity: (cNode.opacity != null) ? cNode.opacity : 1,
    layoutDir: layoutDir,
    layoutGap: layoutGap,
    children: children,
  };
}

/* ─── Main ──────────────────────────────────────────────── */

figma.ui.onmessage = async function(msg) {
  if (msg.type !== "export") return;

  var sel = figma.currentPage.selection;
  if (!sel || sel.length === 0) {
    figma.ui.postMessage({ type: "error", text: "Selecione um Frame primeiro." });
    return;
  }
  var frame = sel[0];
  if (["FRAME","COMPONENT","COMPONENT_SET"].indexOf(frame.type) < 0) {
    figma.ui.postMessage({ type: "error", text: "Selecione um Frame ou Componente." });
    return;
  }

  figma.ui.postMessage({ type: "loading" });
  var stage = "start";

  try {
    stage = "transform";
    var fx = frame.absoluteTransform[0][2];
    var fy = frame.absoluteTransform[1][2];
    var fw = Math.round(frame.width);

    /* ── 1. Classify elements ─────────────────────────── */
    stage = "classify";

    /* Leaf containers (each exported as WFGroup) */
    var containerItems = [];
    var containerParents = []; /* wrapper frames to hide during bg export */
    collectContainerNodes(frame, fx, fy, containerItems, containerParents);

    /* All texts (including inside containers) */
    var textItems = [];
    collectTexts(frame, fx, fy, textItems);

    /* Top-level shapes with non-image fills (gradient/solid rectangles) */
    var shapeItems = [];
    collectTopLevelShapes(frame, fx, fy, shapeItems);

    /* Vectors NOT inside containers */
    var vectorItems = [];
    var containerNodes = containerItems.map(function(c) { return c.node; });
    collectVectors(frame, frame, containerNodes, fx, fy, vectorItems);

    /* ── 2. Export background (photo clean) ──────────── */
    stage = "hideForBg";

    /* Only hide top-level text nodes that are NOT inside any container */
    var topLevelTextNodes = textItems
      .map(function(t) { return t.node; })
      .filter(function(n) {
        for (var i = 0; i < containerItems.length; i++) {
          if (isDescendantOf(n, containerItems[i].node)) return false;
        }
        for (var i = 0; i < containerParents.length; i++) {
          if (isDescendantOf(n, containerParents[i])) return false;
        }
        return true;
      });

    /* Hide: all container nodes (which contain both icons and texts),
       container parents, top-level standalone texts,
       top-level shapes, and standalone vector icons */
    var allHide = containerItems.map(function(c) { return c.node; })
      .concat(containerParents)
      .concat(topLevelTextNodes)
      .concat(shapeItems.map(function(s) { return s.node; }))
      .concat(vectorItems.map(function(v) { return v.node; }));

    for (var i = 0; i < allHide.length; i++) allHide[i].visible = false;

    var bgBase64 = null;
    try {
      stage = "exportBg";
      var bgBytes = await frame.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: 1 } });
      bgBase64 = "data:image/png;base64," + bytesToBase64(bgBytes);
    } finally {
      for (var j = 0; j < allHide.length; j++) allHide[j].visible = true;
    }

    /* ── 3. Export shapes (gradient/solid rects) as native Fabric Rects ── */
    stage = "exportShapes";
    var shapeObjs = [];
    for (var s = 0; s < shapeItems.length; s++) {
      try {
        var sItem = shapeItems[s];
        var nativeRect = buildNativeRectObj(sItem.node, sItem.ax, sItem.ay);
        if (nativeRect) {
          shapeObjs.push(nativeRect);
        } else {
          var sBase64 = await exportNodePNG(sItem.node);
          shapeObjs.push({
            type: "Image", originX: "left", originY: "top",
            src: sBase64,
            left: Math.round(sItem.ax), top: Math.round(sItem.ay),
            width: Math.round(sItem.node.width), height: Math.round(sItem.node.height),
            scaleX: 1, scaleY: 1, selectable: true, evented: true,
            name: sItem.node.name || "shape",
          });
        }
      } catch (se) {}
    }

    /* ── 4. Export each leaf container as WFGroup ─────── */
    stage = "exportContainers";
    var containerObjs = [];
    for (var c = 0; c < containerItems.length; c++) {
      try {
        var cItem = containerItems[c];
        var groupObj = await exportContainerAsGroup(
          cItem.node,
          cItem.ax,  /* already relative to frame origin */
          cItem.ay
        );
        if (groupObj) containerObjs.push(groupObj);
      } catch (ce) {}
    }

    /* ── 5. Export standalone vectors (icons NOT inside containers) ── */
    stage = "exportVectors";
    var vectorObjs = [];
    for (var v = 0; v < vectorItems.length; v++) {
      try {
        var vItem = vectorItems[v];
        var vBase64 = await exportNodePNG(vItem.node);
        vectorObjs.push({
          type: "Image", originX: "left", originY: "top",
          src: vBase64,
          left: Math.round(vItem.ax), top: Math.round(vItem.ay),
          width: Math.round(vItem.node.width), height: Math.round(vItem.node.height),
          scaleX: 1, scaleY: 1, selectable: true, evented: true,
          name: vItem.node.name || "icon",
        });
      } catch (ve) {}
    }

    /* ── 6. Build top-level Textbox objects (only texts NOT inside containers) ── */
    stage = "makeTextObjs";
    var textObjs = [];
    for (var k = 0; k < textItems.length; k++) {
      try {
        var tItem = textItems[k];
        var tNode = tItem.node;
        /* Skip texts that live inside a container (they're part of WFGroup.children) */
        var insideContainer = false;
        for (var ci = 0; ci < containerItems.length; ci++) {
          if (isDescendantOf(tNode, containerItems[ci].node)) { insideContainer = true; break; }
        }
        if (insideContainer) continue;
        /* Also skip texts inside container parent wrappers */
        for (var pi = 0; pi < containerParents.length; pi++) {
          if (isDescendantOf(tNode, containerParents[pi])) { insideContainer = true; break; }
        }
        if (insideContainer) continue;
        textObjs.push(makeTextObj(tItem, fw));
      } catch (e2) {}
    }

    /* ── 7. Assemble final objects ─────────────────────
       Z-order (bottom → top):
         background photo (locked Image)
         top-level shapes (native Fabric Rects — editable fill/gradient)
         WFGroup containers (each a self-contained group)
         standalone vectors (Image)
         top-level texts (Textbox — only texts NOT inside any container)  */
    stage = "buildObjects";
    var objects = [];
    if (bgBase64) {
      objects.push({
        type: "Image", originX: "left", originY: "top",
        src: bgBase64,
        left: 0, top: 0,
        width: Math.round(frame.width), height: Math.round(frame.height),
        scaleX: 1, scaleY: 1,
        selectable: false, evented: false,
        lockMovementX: true, lockMovementY: true,
        lockScalingX: true, lockScalingY: true,
        name: "__background__",
      });
    }
    for (var m = 0; m < shapeObjs.length; m++) objects.push(shapeObjs[m]);
    for (var m2 = 0; m2 < containerObjs.length; m2++) objects.push(containerObjs[m2]);
    for (var m3 = 0; m3 < vectorObjs.length; m3++) objects.push(vectorObjs[m3]);
    for (var n = 0; n < textObjs.length; n++) objects.push(textObjs[n]);

    stage = "buildResult";
    var result = {
      wevyflow: "1.0",
      id: slugify(frame.name),
      name: frame.name,
      w: Math.round(frame.width),
      h: Math.round(frame.height),
      bgColor: "#000000",
      canvas: { version: "6.0.0", background: "#000000", objects: objects },
    };

    figma.ui.postMessage({ type: "done", json: JSON.stringify(result), name: frame.name });

  } catch (e) {
    figma.ui.postMessage({ type: "error", text: "Falhou em [" + stage + "]: " + String(e) });
  }
};
