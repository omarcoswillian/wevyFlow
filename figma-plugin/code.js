figma.showUI(__html__, { width: 380, height: 440, title: "WevyFlow Export" });

/* ─── Pure ES5 helpers ──────────────────────────────────── */

function toHex2(n) {
  var h = Math.round(n).toString(16);
  return h.length < 2 ? "0" + h : h;
}

function rgbToHex(c, a) {
  var r = Math.round(c.r * 255);
  var g = Math.round(c.g * 255);
  var b = Math.round(c.b * 255);
  var alpha = (a != null) ? a : 1;
  if (alpha < 0.99) {
    return "rgba(" + r + "," + g + "," + b + "," + alpha.toFixed(3) + ")";
  }
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

function slugify(str) {
  return (str || "template")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "template";
}

/* Pure-JS base64 — btoa() is not available in the Figma plugin sandbox */
var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function bytesToBase64(bytes) {
  var len = bytes.length;
  var parts = [];
  var CHUNK = 768;
  for (var off = 0; off < len; off += CHUNK) {
    var s = "";
    var end = (off + CHUNK < len) ? off + CHUNK : len;
    for (var i = off; i < end; i += 3) {
      var b0 = bytes[i];
      var b1 = (i + 1 < len) ? bytes[i + 1] : 0;
      var b2 = (i + 2 < len) ? bytes[i + 2] : 0;
      s += B64[b0 >> 2];
      s += B64[((b0 & 3) << 4) | (b1 >> 4)];
      s += (i + 1 < len) ? B64[((b1 & 15) << 2) | (b2 >> 6)] : "=";
      s += (i + 2 < len) ? B64[b2 & 63] : "=";
    }
    parts.push(s);
  }
  return parts.join("");
}

/* ─── Collect TEXT nodes ────────────────────────────────── */

function collectTexts(node, fx, fy, out) {
  try {
    if (node.visible === false) return;
    if (!node.absoluteTransform || !node.absoluteTransform[0]) return;

    if (node.type === "TEXT") {
      out.push({
        node: node,
        ax: node.absoluteTransform[0][2] - fx,
        ay: node.absoluteTransform[1][2] - fy,
      });
    } else if (node.children) {
      for (var i = 0; i < node.children.length; i++) {
        collectTexts(node.children[i], fx, fy, out);
      }
    }
  } catch (e) {}
}

/* ─── Collect VECTOR/ICON nodes ─────────────────────────── */

var VECTOR_TYPES = ["VECTOR", "STAR", "POLYGON", "BOOLEAN_OPERATION", "LINE"];

function isVectorType(t) {
  return VECTOR_TYPES.indexOf(t) >= 0;
}

function collectVectors(node, frameNode, fx, fy, out) {
  try {
    if (node.visible === false) return;
    if (node === frameNode) {
      if (node.children) {
        for (var i = 0; i < node.children.length; i++) {
          collectVectors(node.children[i], frameNode, fx, fy, out);
        }
      }
      return;
    }
    if (!node.absoluteTransform || !node.absoluteTransform[0]) return;

    if (isVectorType(node.type)) {
      out.push({
        node: node,
        ax: node.absoluteTransform[0][2] - fx,
        ay: node.absoluteTransform[1][2] - fy,
      });
      return;
    }

    /* GROUP or FRAME where ALL direct children are vector types → treat as one icon */
    if ((node.type === "GROUP" || node.type === "FRAME" || node.type === "COMPONENT") && node.children && node.children.length > 0) {
      var allVec = true;
      for (var j = 0; j < node.children.length; j++) {
        if (!isVectorType(node.children[j].type)) { allVec = false; break; }
      }
      if (allVec) {
        out.push({
          node: node,
          ax: node.absoluteTransform[0][2] - fx,
          ay: node.absoluteTransform[1][2] - fy,
        });
        return;
      }
      /* Recurse into mixed groups */
      for (var k = 0; k < node.children.length; k++) {
        collectVectors(node.children[k], frameNode, fx, fy, out);
      }
    }
  } catch (e) {}
}

/* ─── Convert TEXT node → Fabric Textbox ─────────────────── */

function makeTextObj(item, frameWidth) {
  var node = item.node;

  var fillColor = "#ffffff";
  var fills = node.fills;
  if (fills && fills !== figma.mixed && fills.length > 0) {
    for (var i = fills.length - 1; i >= 0; i--) {
      if (fills[i].visible !== false && fills[i].type === "SOLID") {
        fillColor = rgbToHex(fills[i].color, fills[i].opacity);
        break;
      }
    }
  }

  var family = "Montserrat";
  var styleName = "Regular";
  if (node.fontName !== figma.mixed) {
    family = node.fontName.family;
    styleName = node.fontName.style;
  }
  var fontSize = (node.fontSize !== figma.mixed) ? Math.round(node.fontSize) : 16;

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

  /* For left-aligned text: extend width to frame edge to prevent wrapping
     from browser font metric differences (e.g. no UltraLight weight)     */
  var boxWidth = Math.round(node.width);
  if (textAlign === "left" && frameWidth > 0) {
    var remaining = Math.round(frameWidth - item.ax);
    if (remaining > boxWidth) boxWidth = remaining;
  }

  return {
    type: "Textbox",
    originX: "left",
    originY: "top",
    left: Math.round(item.ax),
    top: Math.round(item.ay),
    width: boxWidth,
    text: node.characters || "",
    fontSize: fontSize,
    fontFamily: family,
    fontWeight: getFontWeight(styleName),
    fontStyle: isItalic ? "italic" : "normal",
    fill: fillColor,
    textAlign: textAlign,
    charSpacing: charSpacing,
    lineHeight: lineHeight,
    opacity: (node.opacity != null) ? node.opacity : 1,
    editable: true,
    selectable: true,
    name: node.name || "text",
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
  var allowed = ["FRAME", "COMPONENT", "COMPONENT_SET"];
  if (allowed.indexOf(frame.type) < 0) {
    figma.ui.postMessage({ type: "error", text: "Selecione um Frame ou Componente." });
    return;
  }

  figma.ui.postMessage({ type: "loading" });

  var stage = "start";
  try {

    stage = "absoluteTransform";
    var fx = frame.absoluteTransform[0][2];
    var fy = frame.absoluteTransform[1][2];

    stage = "collectTexts";
    var textItems = [];
    collectTexts(frame, fx, fy, textItems);

    stage = "collectVectors";
    var vectorItems = [];
    collectVectors(frame, frame, fx, fy, vectorItems);

    /* Hide texts + vectors before background PNG export */
    stage = "hideNodes";
    for (var i = 0; i < textItems.length; i++) textItems[i].node.visible = false;
    for (var i = 0; i < vectorItems.length; i++) vectorItems[i].node.visible = false;

    var bgBase64 = null;
    try {
      stage = "exportAsync";
      var bgBytes = await frame.exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: 1 },
      });
      stage = "bytesToBase64";
      bgBase64 = "data:image/png;base64," + bytesToBase64(bgBytes);
    } finally {
      stage = "restoreNodes";
      for (var j = 0; j < textItems.length; j++) textItems[j].node.visible = true;
      for (var j = 0; j < vectorItems.length; j++) vectorItems[j].node.visible = true;
    }

    /* Export each vector/icon separately as PNG */
    stage = "exportVectors";
    var vectorObjs = [];
    for (var v = 0; v < vectorItems.length; v++) {
      try {
        var vItem = vectorItems[v];
        var vBytes = await vItem.node.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: 1 },
        });
        var vBase64 = "data:image/png;base64," + bytesToBase64(vBytes);
        vectorObjs.push({
          type: "Image",
          originX: "left",
          originY: "top",
          src: vBase64,
          left: Math.round(vItem.ax),
          top: Math.round(vItem.ay),
          width: Math.round(vItem.node.width),
          height: Math.round(vItem.node.height),
          scaleX: 1,
          scaleY: 1,
          selectable: true,
          evented: true,
          name: vItem.node.name || "icon",
        });
      } catch (ve) { /* skip individual vector failures */ }
    }

    stage = "makeTextObjs";
    var textObjs = [];
    var fw = Math.round(frame.width);
    for (var k = 0; k < textItems.length; k++) {
      try { textObjs.push(makeTextObj(textItems[k], fw)); } catch (e2) {}
    }

    stage = "buildObjects";
    var objects = [];
    /* z-order: background → vectors/icons → texts */
    if (bgBase64) {
      objects.push({
        type: "Image",
        originX: "left",
        originY: "top",
        src: bgBase64,
        left: 0, top: 0,
        width: Math.round(frame.width),
        height: Math.round(frame.height),
        scaleX: 1, scaleY: 1,
        selectable: false, evented: false,
        lockMovementX: true, lockMovementY: true,
        lockScalingX: true, lockScalingY: true,
        name: "__background__",
      });
    }
    for (var m = 0; m < vectorObjs.length; m++) objects.push(vectorObjs[m]);
    for (var n = 0; n < textObjs.length; n++) objects.push(textObjs[n]);

    stage = "buildResult";
    var result = {
      wevyflow: "1.0",
      id: slugify(frame.name),
      name: frame.name,
      w: Math.round(frame.width),
      h: Math.round(frame.height),
      bgColor: "#000000",
      canvas: {
        version: "6.0.0",
        background: "#000000",
        objects: objects,
      },
    };

    figma.ui.postMessage({
      type: "done",
      json: JSON.stringify(result),
      name: frame.name,
    });

  } catch (e) {
    figma.ui.postMessage({
      type: "error",
      text: "Falhou em [" + stage + "]: " + String(e),
    });
  }
};
