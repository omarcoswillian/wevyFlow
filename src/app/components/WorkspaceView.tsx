"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  MessageCircle,
  Plus,
  Package,
  Monitor,
  Tablet,
  Smartphone,
  Tv,
  Copy,
  Check,
  Download,
  Loader2,
  Eye,
  MousePointer,
  Layers,
  Code2,
  CheckCircle2,
  Circle,
  Undo2,
  Redo2,
  Save,
  ImageIcon,
  Globe,
  ExternalLink,
  X,
  Search,
  BarChart2,
  Link2,
  EyeOff,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Platform, ViewportSize } from "../lib/types";
import { IFRAME_VISUAL_EDIT_SCRIPT } from "../lib/iframe-inject";
import { ChatPanel, type ChatMessage } from "./workspace/ChatPanel";
import { VIEWPORT_WIDTHS } from "./workspace/viewport-config";
import { BASE_CSS, BASE_SCRIPT } from "../lib/base-css";
import { useEditHistory } from "../lib/editor/useEditHistory";
import { googleFontUrl } from "../lib/editor/google-fonts";
import { VisualEditor, ElementProps } from "./VisualEditor";
import { InsertPanel } from "./InsertPanel";
import { LayersPanel, TreeNode } from "./LayersPanel";
import { LibraryPanel } from "./LibraryPanel";
import { ImageAIPanel } from "./ImageAIPanel";
import { useComponents } from "../lib/editor/useComponents";
import { ElementorExport } from "./ElementorExport";
import { VSLConfigPanel } from "./VSLConfigPanel";
import { VSLConfig, deserializeConfig, serializeConfig, buildVSLInnerHtml } from "../lib/vsl";
import { stripEditorScripts } from "../lib/strip-editor-scripts";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import xml from "react-syntax-highlighter/dist/esm/languages/hljs/xml";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";

SyntaxHighlighter.registerLanguage("xml", xml);

interface WorkspaceViewProps {
  code: string;
  isLoading: boolean;
  isRefining: boolean;
  platform: Platform;
  prompt: string;
  error: string;
  onRefine: (request: string, images?: { name: string; base64: string }[]) => void;
  onBack: () => void;
}

interface BuildStep {
  label: string;
  status: "done" | "active" | "pending";
}

const VIEWPORTS: { id: ViewportSize; icon: React.ReactNode; label: string }[] = [
  { id: "ultrawide", icon: <Tv className="w-4 h-4" />, label: "Ultra-wide" },
  { id: "desktop", icon: <Monitor className="w-4 h-4" />, label: "Desktop" },
  { id: "tablet", icon: <Tablet className="w-4 h-4" />, label: "Tablet" },
  { id: "mobile", icon: <Smartphone className="w-4 h-4" />, label: "Mobile" },
];

export function WorkspaceView({
  code, isLoading, isRefining, platform, prompt, error, onRefine, onBack,
}: WorkspaceViewProps) {
  const [rightTab, setRightTab] = useState<"preview" | "code">("preview");
  const [userOverrodeTab, setUserOverrodeTab] = useState(false);
  const [viewportSize, setViewportSize] = useState<ViewportSize>("desktop");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [leftPanelTab, setLeftPanelTab] = useState<"chat" | "details" | "insert" | "layers" | "library" | "images">("layers");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const { components, add: addComponent, remove: removeComponent, rename: renameComponent } = useComponents();
  const pendingComponentName = useRef<string | null>(null);
  const [visualEditMode, setVisualEditMode] = useState(false);
  const [selectedElementProps, setSelectedElementProps] = useState<ElementProps | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [loadedFonts, setLoadedFonts] = useState<string[]>([]);
  const [showElementorExport, setShowElementorExport] = useState(false);
  const [elementorCopied, setElementorCopied] = useState(false);
  const [wpCopied, setWpCopied] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [publishSlug, setPublishSlug] = useState("");
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishGaId, setPublishGaId] = useState("");
  const [publishFbPixel, setPublishFbPixel] = useState("");
  const [publishMetaDesc, setPublishMetaDesc] = useState("");
  const [publishNoIndex, setPublishNoIndex] = useState(false);
  const [publishSeoOpen, setPublishSeoOpen] = useState(false);
  const [publishTrackingOpen, setPublishTrackingOpen] = useState(false);
  const [vslDialog, setVslDialog] = useState<{ id: string; config: VSLConfig | null } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build steps based on loading state
  const buildSteps: BuildStep[] = [
    { label: "Analisando referências e contexto", status: isLoading && !code ? "active" : "done" },
    { label: "Construindo estrutura HTML", status: isLoading && code && code.length < 500 ? "active" : code ? "done" : "pending" },
    { label: "Aplicando estilos CSS", status: isLoading && code && code.length >= 500 ? "active" : code && !isLoading ? "done" : "pending" },
    { label: "Adicionando animações e interações", status: isLoading && code && code.length >= 2000 ? "active" : code && !isLoading ? "done" : "pending" },
    { label: "Finalizando layout responsivo", status: !isLoading && code ? "done" : "pending" },
  ];

  // Init messages with user prompt
  useEffect(() => {
    if (prompt && messages.length === 0) {
      setMessages([{ role: "user", content: prompt, timestamp: Date.now() }]);
    }
  }, [prompt, messages.length]);

  // Add assistant message when generation completes
  useEffect(() => {
    if (!isLoading && code && messages.length === 1) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Layout construído com sucesso! Você pode ver o preview ao lado. Use o chat abaixo para refinar o que quiser.", timestamp: Date.now() },
      ]);
    }
  }, [isLoading, code, messages.length]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Only build preview HTML when NOT streaming (to avoid iframe flashing)
  const isStreaming = isLoading || isRefining;
  const editHistory = useEditHistory("");
  const finalCode = editHistory.value;

  // Draft persistence: each unique prompt gets a stable localStorage key.
  // Save = explicit user action; restore happens silently on mount when present.
  const draftKey = useMemo(() => {
    if (!prompt) return null;
    let h = 0;
    for (let i = 0; i < prompt.length; i++) h = ((h << 5) - h + prompt.charCodeAt(i)) | 0;
    return `wf:draft:${h}`;
  }, [prompt]);

  const handleSave = useCallback(() => {
    if (!draftKey || !finalCode) return;
    try {
      localStorage.setItem(draftKey, finalCode);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      const isQuota = err instanceof DOMException && (err.code === 22 || err.code === 1014 || err.name === "QuotaExceededError");
      // Surface the failure so the user knows the draft did NOT persist.
      // Silent failure here is what made saves "look fine" then disappear after refresh.
      window.dispatchEvent(new CustomEvent("wevyflow-storage-error", {
        detail: { type: isQuota ? "quota" : "unknown", message: isQuota
          ? "Armazenamento local cheio. O draft NÃO foi salvo. Clique em Liberar espaço."
          : "Erro ao salvar draft." },
      }));
    }
  }, [draftKey, finalCode]);

  // When streaming starts, show code tab. When done, switch to preview.
  // Respects manual tab override by the user during streaming.
  useEffect(() => {
    if (isStreaming && !finalCode && !userOverrodeTab) {
      setRightTab("code");
    }
    if (isStreaming) {
      setUserOverrodeTab(false);
    }
  }, [isStreaming, finalCode, userOverrodeTab]);

  useEffect(() => {
    if (!isStreaming && code) {
      // Prefer a saved draft over the freshly-loaded template, when one exists
      // for this exact prompt. Lets the user pick up where they left off.
      let initial = code;
      if (draftKey) {
        try {
          const draft = localStorage.getItem(draftKey);
          if (draft && draft.length > 0) initial = draft;
        } catch { /* storage unavailable */ }
      }
      editHistory.reset(initial);
      if (!userOverrodeTab) {
        setRightTab("preview");
      }
    }
    // editHistory.reset is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, code, userOverrodeTab, draftKey]);

  const buildPreviewHtml = useCallback((body: string) => {
    const fontsUrl = googleFontUrl(loadedFonts);
    const fontsLink = fontsUrl ? `<link rel="stylesheet" href="${fontsUrl}">` : "";
    // Strip any editor scripts already embedded in body (legacy from earlier
    // serializations). Without this, multiple IIFEs run with their own
    // idCounter/dragHtml state — colliding ids, duplicated drops, broken updates.
    const cleanBody = stripEditorScripts(body);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${BASE_CSS}${fontsLink}</head><body>${cleanBody}${BASE_SCRIPT}${IFRAME_VISUAL_EDIT_SCRIPT}</body></html>`;
  }, [loadedFonts]);

  // Iframe srcDoc is kept separate from finalCode so that edits originating
  // inside the iframe (postMessage → setValue) don't trigger a reload/flash.
  const [previewHtml, setPreviewHtml] = useState("");
  const iframeSyncRef = useRef<string>("");

  useEffect(() => {
    if (!finalCode) {
      setPreviewHtml("");
      iframeSyncRef.current = "";
      return;
    }
    if (finalCode === iframeSyncRef.current) return; // iframe already has this
    setPreviewHtml(buildPreviewHtml(finalCode));
    iframeSyncRef.current = finalCode;
  }, [finalCode, buildPreviewHtml]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(stripEditorScripts(finalCode || code));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleDownload = useCallback(() => {
    const codeToExport = stripEditorScripts(finalCode || code);
    const fullHtml = `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Layout WevyFlow</title>\n</head>\n<body>\n${codeToExport}\n</body>\n</html>`;
    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wevyflow-layout.html";
    a.click();
    URL.revokeObjectURL(url);
  }, [code]);

  const handleCopyElementor = useCallback(() => {
    setShowElementorExport(true);
  }, []);

  const handleExportWordPress = useCallback(() => {
    const cleanHtml = stripEditorScripts(iframeSyncRef.current || finalCode || code);
    const fullHtml = `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${prompt || "WevyFlow Page"}</title>\n</head>\n<body>\n${cleanHtml}\n</body>\n</html>`;
    const payload = JSON.stringify({
      wf: 1,
      title: prompt || "WevyFlow Page",
      html: fullHtml,
      exportedAt: new Date().toISOString(),
    });
    navigator.clipboard.writeText(payload);
    setWpCopied(true);
    setTimeout(() => setWpCopied(false), 3000);
  }, [code, finalCode, prompt]);

  const injectPublishOptions = useCallback((html: string): string => {
    let out = html;
    const hasHead = /<\/head>/i.test(out);
    const hasBody = /<\/body>/i.test(out);
    if (!hasHead) return out;

    const headInserts: string[] = [];
    const bodyInserts: string[] = [];

    if (publishMetaDesc.trim()) {
      const tag = `<meta name="description" content="${publishMetaDesc.trim().replace(/"/g, "&quot;")}">`;
      if (/<meta\s+name=["']description["']/i.test(out)) {
        out = out.replace(/<meta\s+name=["']description["'][^>]*>/i, tag);
      } else {
        headInserts.push(tag);
      }
    }

    if (publishNoIndex) {
      if (!/<meta\s+name=["']robots["']/i.test(out)) {
        headInserts.push(`<meta name="robots" content="noindex, nofollow">`);
      }
    }

    if (publishGaId.trim()) {
      const id = publishGaId.trim();
      headInserts.push(
        `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
        `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');</script>`
      );
    }

    if (headInserts.length > 0) {
      out = out.replace(/<\/head>/i, `${headInserts.map(s => `  ${s}`).join("\n")}\n</head>`);
    }

    if (publishFbPixel.trim()) {
      const id = publishFbPixel.trim();
      bodyInserts.push(
        `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');</script>`,
        `<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1"/></noscript>`
      );
    }

    if (bodyInserts.length > 0 && hasBody) {
      out = out.replace(/<\/body>/i, `${bodyInserts.map(s => `  ${s}`).join("\n")}\n</body>`);
    }

    return out;
  }, [publishMetaDesc, publishNoIndex, publishGaId, publishFbPixel]);

  const handlePublish = useCallback(async () => {
    const slug = publishSlug.trim();
    if (!slug) return;
    setPublishLoading(true);
    setPublishError(null);
    const cleanHtml = stripEditorScripts(iframeSyncRef.current || finalCode || code);
    // Generated pages are already full HTML documents — avoid double-wrapping
    const isFullDoc = /^\s*<!doctype\s/i.test(cleanHtml) || /^\s*<html/i.test(cleanHtml);
    const baseHtml = isFullDoc
      ? cleanHtml
      : `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${prompt || "WevyFlow Page"}</title>\n</head>\n<body>\n${cleanHtml}\n</body>\n</html>`;
    const fullHtml = injectPublishOptions(baseHtml);
    try {
      const res = await fetch("/api/pages/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, title: prompt || "WevyFlow Page", html: fullHtml, page_type: "generated" }),
      });
      const data = await res.json();
      if (!res.ok) { setPublishError(data.error || "Erro ao publicar"); return; }
      setPublishedUrl(data.url);
    } catch { setPublishError("Erro de conexão"); }
    finally { setPublishLoading(false); }
  }, [publishSlug, code, finalCode, prompt, injectPublishOptions]);

  // Visual edit: toggle mode
  const toggleVisualEdit = useCallback(() => {
    const next = !visualEditMode;
    setVisualEditMode(next);
    setSelectedElementProps(null);
    setSelectedElementId(null);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: next ? "wf-enable-edit" : "wf-disable-edit" }, "*");
    }
  }, [visualEditMode]);

  // Visual edit: listen for messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === "wf-element-selected") {
        setSelectedElementProps(e.data.props);
        if (typeof e.data.id === "string") setSelectedElementId(e.data.id);
        // If a drop just landed (or any selection happened), surface the editor
        if (!visualEditMode) setVisualEditMode(true);
      }
      if (e.data.type === "wf-element-deselected") {
        setSelectedElementProps(null);
        setSelectedElementId(null);
      }
      if (e.data.type === "wf-code-updated" && typeof e.data.html === "string") {
        iframeSyncRef.current = e.data.html;
        editHistory.setValue(e.data.html);
        if (Array.isArray(e.data.tree)) setTree(e.data.tree);
        if (!visualEditMode) setVisualEditMode(true);
      }
      if (e.data.type === "wf-tree" && Array.isArray(e.data.tree)) {
        setTree(e.data.tree);
      }
      if (e.data.type === "wf-selected-html" && typeof e.data.html === "string" && pendingComponentName.current) {
        addComponent(pendingComponentName.current, e.data.html, e.data.tagName || "div");
        pendingComponentName.current = null;
      }
      if (e.data.type === "wf-vsl-update-result") {
        console.log("[VSL] update result from iframe", e.data);
        if (!e.data.ok) {
          window.alert(`VSL não foi atualizado: ${e.data.reason || "erro desconhecido"}\n(detalhes no console)`);
        }
      }
      if (e.data.type === "wf-open-vsl-config" && typeof e.data.id === "string") {
        // Auto-enable edit mode so the iframe accepts the subsequent wf-update-vsl
        if (!visualEditMode) {
          iframeRef.current?.contentWindow?.postMessage({ type: "wf-enable-edit" }, "*");
          setVisualEditMode(true);
        }
        // Make sure the left panel is visible — the config UI lives there
        setLeftCollapsed(false);
        const cfg = typeof e.data.config === "string" ? deserializeConfig(e.data.config) : null;
        setVslDialog({ id: e.data.id, config: cfg });
      }
      if (e.data.type === "wf-ready") {
        if (Array.isArray(e.data.tree)) setTree(e.data.tree);
        // Iframe reloaded (new srcDoc) — restore edit mode + selection
        if (iframeRef.current?.contentWindow) {
          if (visualEditMode) {
            iframeRef.current.contentWindow.postMessage({ type: "wf-enable-edit" }, "*");
          }
          if (selectedElementId) {
            iframeRef.current.contentWindow.postMessage({ type: "wf-restore-selection", id: selectedElementId }, "*");
          }
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
    // editHistory.setValue is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualEditMode, selectedElementId]);

  const handleVisualStyleChange = useCallback((property: string, value: string) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "wf-apply-style", property, value, viewport: viewportSize },
        "*"
      );
    }
  }, [viewportSize]);

  // When the user switches viewport, tell the iframe — so subsequent reads (computed style)
  // and the inspector use the right context.
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: "wf-set-viewport", viewport: viewportSize },
        "*"
      );
    }
  }, [viewportSize]);

  const handleInsertHtml = useCallback((html: string) => {
    // Ensure edit mode is on so the insertion lands + selects properly
    if (!visualEditMode && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "wf-enable-edit" }, "*");
      setVisualEditMode(true);
    }
    iframeRef.current?.contentWindow?.postMessage({ type: "wf-insert-html", html }, "*");
  }, [visualEditMode]);

  const handleInsertImage = useCallback((url: string) => {
    if (selectedElementProps?.tagName === "img") {
      iframeRef.current?.contentWindow?.postMessage({ type: "wf-apply-attr", name: "src", value: url }, "*");
    } else {
      handleInsertHtml(`<img src="${url}" alt="Imagem" style="max-width:100%;height:auto;display:block;">`);
    }
  }, [selectedElementProps, handleInsertHtml]);

  const handleSaveComponent = useCallback(() => {
    if (!selectedElementId) return;
    const name = window.prompt("Nome do componente:");
    if (!name || !name.trim()) return;
    pendingComponentName.current = name.trim();
    iframeRef.current?.contentWindow?.postMessage({ type: "wf-request-selected-html" }, "*");
  }, [selectedElementId]);

  const handleLayerSelect = useCallback((id: string) => {
    if (!visualEditMode) setVisualEditMode(true);
    iframeRef.current?.contentWindow?.postMessage({ type: "wf-select-by-id", id }, "*");
  }, [visualEditMode]);
  const handleLayerDelete = useCallback((id: string) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "wf-delete-by-id", id }, "*");
  }, []);
  const handleLayerToggleHidden = useCallback((id: string) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "wf-toggle-hidden-by-id", id }, "*");
  }, []);
  const handleLayerRename = useCallback((id: string, name: string) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "wf-rename-by-id", id, name }, "*");
  }, []);

  const handleVSLSave = useCallback((config: VSLConfig) => {
    if (!vslDialog) {
      console.error("[VSL] handleVSLSave called with no active dialog");
      return;
    }
    const html = buildVSLInnerHtml(config);
    console.log("[VSL] saving", { id: vslDialog.id, htmlLen: html.length, hasIframe: !!iframeRef.current?.contentWindow });
    if (!iframeRef.current?.contentWindow) {
      console.error("[VSL] iframe contentWindow not available");
      return;
    }
    iframeRef.current.contentWindow.postMessage({
      type: "wf-update-vsl",
      id: vslDialog.id,
      html,
      config: serializeConfig(config),
    }, "*");
    setVslDialog(null);
  }, [vslDialog]);

  const handleDragHtml = useCallback((html: string | null) => {
    if (html === null) {
      iframeRef.current?.contentWindow?.postMessage({ type: "wf-drag-end" }, "*");
    } else {
      iframeRef.current?.contentWindow?.postMessage({ type: "wf-drag-start", html }, "*");
    }
  }, []);

  const handleLoadFont = useCallback((family: string) => {
    setLoadedFonts((prev) => (prev.includes(family) ? prev : [...prev, family]));
    const url = googleFontUrl([family]);
    if (url && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "wf-load-font", family, url }, "*");
    }
  }, []);

  // Element actions (delete / duplicate / move)
  const deleteSelected = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "wf-delete-selected" }, "*");
  }, []);
  const duplicateSelected = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: "wf-duplicate-selected" }, "*");
  }, []);
  const moveSelected = useCallback((dir: "up" | "down") => {
    iframeRef.current?.contentWindow?.postMessage({ type: "wf-move-selected", dir }, "*");
  }, []);

  // Keyboard shortcuts: undo/redo + delete + duplicate + move
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInInput = !!(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable));
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod) {
        if (isInInput) return;
        if (key === "z" && !e.shiftKey) { e.preventDefault(); editHistory.undo(); return; }
        if ((key === "z" && e.shiftKey) || key === "y") { e.preventDefault(); editHistory.redo(); return; }
        if (key === "d" && visualEditMode && selectedElementId) { e.preventDefault(); duplicateSelected(); return; }
        if (key === "arrowup" && visualEditMode && selectedElementId) { e.preventDefault(); moveSelected("up"); return; }
        if (key === "arrowdown" && visualEditMode && selectedElementId) { e.preventDefault(); moveSelected("down"); return; }
        if (key === "\\" || key === "/") { e.preventDefault(); setLeftCollapsed((x) => !x); return; }
      }

      // Delete / Backspace: only when an element is selected and focus isn't in an input
      if ((e.key === "Delete" || e.key === "Backspace") && visualEditMode && selectedElementId && !isInInput) {
        e.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualEditMode, selectedElementId]);

  const handleVisualTextChange = useCallback((value: string) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "wf-apply-text", value }, "*");
    }
  }, []);

  const handleVisualAttrChange = useCallback((name: string, value: string | null) => {
    iframeRef.current?.contentWindow?.postMessage({ type: "wf-apply-attr", name, value }, "*");
  }, []);

  // Insert photo directly into template (replace placeholder)
  const insertPhotoIntoTemplate = useCallback((base64: string) => {
    if (!code) return;
    // Replace photo placeholder div with actual image
    let updated = code;
    // Pattern 1: photo-placeholder div
    const placeholderRegex = /<div class="photo-placeholder">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
    if (placeholderRegex.test(updated)) {
      updated = updated.replace(placeholderRegex, `<img src="${base64}" class="hero-right-photo" alt="Mentor" style="width:100%;height:100%;object-fit:cover;object-position:center 20%">`);
    }
    // Pattern 2: hero-right-fallback
    const fallbackRegex = /<div class="hero-right-fallback">[\s\S]*?<\/div>\s*<\/div>/;
    if (fallbackRegex.test(updated)) {
      updated = updated.replace(fallbackRegex, `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;object-position:center 20%;position:relative;z-index:1" alt="Mentor">`);
    }
    // Pattern 3: generic gradient placeholder
    const gradientPlaceholder = /<div style="width:100%;height:100%;background:linear-gradient[^"]*"><\/div>/;
    if (gradientPlaceholder.test(updated)) {
      updated = updated.replace(gradientPlaceholder, `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;object-position:center 20%" alt="Foto">`);
    }

    if (updated !== code) {
      editHistory.setValue(updated, { immediate: true });
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Foto inserida no template com sucesso! Confira o preview.",
        timestamp: Date.now(),
      }]);
    } else {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Nao foi possivel inserir a foto automaticamente — o template nao tem placeholder compativel. Use o chat para pedir a insercao manualmente (ex: 'coloque esta foto no hero').",
        timestamp: Date.now(),
      }]);
    }
  }, [code]);

  const handleChatRefine = useCallback((text: string, images?: { name: string; base64: string }[]) => {
    setMessages((prev) => [...prev, { role: "user", content: text, images, timestamp: Date.now() }]);
    onRefine(text, images);
  }, [onRefine]);

  const handleInsertPhotoFromChat = useCallback((base64: string, caption: string) => {
    insertPhotoIntoTemplate(base64);
    setMessages((prev) => [...prev, { role: "user", content: caption, images: [{ name: "foto", base64 }], timestamp: Date.now() }]);
  }, []);


  // When refinement completes, add assistant message
  useEffect(() => {
    if (!isRefining && messages.length > 0 && messages[messages.length - 1].role === "user" && code) {
      const lastMsg = messages[messages.length - 1];
      if (Date.now() - lastMsg.timestamp > 1000) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Refinamento aplicado! Confira o preview atualizado.", timestamp: Date.now() },
        ]);
      }
    }
  }, [isRefining, code, messages]);

  return (
    <div className="flex h-screen bg-[#080809] p-2 gap-2">

      {/* ─── LEFT: Navigator / Chat / Insert / Library ─── */}
      {leftCollapsed ? (
        <div className="w-[44px] shrink-0 flex flex-col items-center py-3 gap-1 bg-[#0e0e11] rounded-[20px]">
          <button onClick={() => setLeftCollapsed(false)} title="Expandir (⌘\\)"
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
            <PanelLeftOpen className="w-4 h-4" />
          </button>
          <div className="w-6 h-px bg-white/[0.06] my-1" />
          <RailButton active={leftPanelTab === "chat"} onClick={() => { setLeftPanelTab("chat"); setLeftCollapsed(false); }} title="Chat" icon={<MessageCircle className="w-4 h-4" />} />
          {code && !isLoading && <RailButton active={leftPanelTab === "insert"} onClick={() => { setLeftPanelTab("insert"); setLeftCollapsed(false); }} title="Inserir" icon={<Plus className="w-4 h-4" />} />}
          {code && !isLoading && <RailButton active={leftPanelTab === "layers"} onClick={() => { setLeftPanelTab("layers"); setLeftCollapsed(false); }} title="Navigator" icon={<Layers className="w-4 h-4" />} />}
          {code && !isLoading && <RailButton active={leftPanelTab === "library"} onClick={() => { setLeftPanelTab("library"); setLeftCollapsed(false); }} title="Biblioteca" icon={<Package className="w-4 h-4" />} />}
          {code && !isLoading && <RailButton active={leftPanelTab === "images"} onClick={() => { setLeftPanelTab("images"); setLeftCollapsed(false); }} title="Imagens IA" icon={<ImageIcon className="w-4 h-4" />} />}
        </div>
      ) : (
        <div ref={dropZoneRef} className="w-[260px] shrink-0 flex flex-col bg-[#0e0e11] rounded-[20px] overflow-hidden relative">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-1">
              <button onClick={onBack} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all cursor-pointer" title="Voltar">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setLeftPanelTab("chat")} title="Chat"
                className={cn("p-1.5 rounded-lg transition-all cursor-pointer", leftPanelTab === "chat" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50")}>
                <MessageCircle className="w-3.5 h-3.5" />
              </button>
              {code && !isLoading && (
                <button onClick={() => setLeftPanelTab("insert")} title="Inserir"
                  className={cn("p-1.5 rounded-lg transition-all cursor-pointer", leftPanelTab === "insert" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50")}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
              {code && !isLoading && (
                <button onClick={() => setLeftPanelTab("layers")} title="Navigator"
                  className={cn("p-1.5 rounded-lg transition-all cursor-pointer", leftPanelTab === "layers" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50")}>
                  <Layers className="w-3.5 h-3.5" />
                </button>
              )}
              {code && !isLoading && (
                <button onClick={() => setLeftPanelTab("library")} title="Biblioteca"
                  className={cn("p-1.5 rounded-lg transition-all cursor-pointer", leftPanelTab === "library" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50")}>
                  <Package className="w-3.5 h-3.5" />
                </button>
              )}
              {code && !isLoading && (
                <button onClick={() => setLeftPanelTab("images")} title="Imagens IA"
                  className={cn("p-1.5 rounded-lg transition-all cursor-pointer", leftPanelTab === "images" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50")}>
                  <ImageIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button onClick={() => setLeftCollapsed(true)} title="Recolher (⌘\\)"
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          {vslDialog ? (
            <VSLConfigPanel
              key={vslDialog.id}
              initialConfig={vslDialog.config}
              onClose={() => setVslDialog(null)}
              onSave={handleVSLSave}
            />
          ) : leftPanelTab === "layers" ? (
            <LayersPanel
              tree={tree}
              selectedId={selectedElementId}
              onSelect={handleLayerSelect}
              onDelete={handleLayerDelete}
              onToggleHidden={handleLayerToggleHidden}
              onRename={handleLayerRename}
            />
          ) : leftPanelTab === "insert" ? (
            <InsertPanel onInsert={handleInsertHtml} onDragHtml={handleDragHtml} />
          ) : leftPanelTab === "library" ? (
            <LibraryPanel
              components={components}
              pageHtml={finalCode || code}
              onInsert={handleInsertHtml}
              onDragHtml={handleDragHtml}
              onRemoveComponent={removeComponent}
              onRenameComponent={renameComponent}
            />
          ) : leftPanelTab === "images" ? (
            <ImageAIPanel
              selectedElementTagName={selectedElementProps?.tagName ?? null}
              onInsertImage={handleInsertImage}
            />
          ) : (
            <ChatPanel
              messages={messages}
              isLoading={isLoading}
              isRefining={isRefining}
              code={finalCode || code}
              onRefine={handleChatRefine}
              onInsertPhoto={handleInsertPhotoFromChat}
              endRef={chatEndRef}
            />
          )}
        </div>
      )}

      {/* ─── CENTER: Preview / Code ─── */}
      <div className="flex-1 flex flex-col rounded-[20px] bg-[#0c0c10] overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06] bg-[#0c0c10]">
          <div className="flex items-center gap-1.5">
            {/* Preview / Code toggle */}
            <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/[0.03]">
              <button onClick={() => { setRightTab("preview"); setUserOverrodeTab(true); }}
                className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                  rightTab === "preview" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50")}>
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button onClick={() => { setRightTab("code"); setUserOverrodeTab(true); }}
                className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                  rightTab === "code" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50")}>
                <Code2 className="w-3.5 h-3.5" /> Código
              </button>
            </div>

            {/* Viewports */}
            {rightTab === "preview" && (
              <div className="flex gap-0.5">
                {VIEWPORTS.map((v) => (
                  <button key={v.id} onClick={() => setViewportSize(v.id)}
                    className={cn("p-1.5 rounded-md transition-all cursor-pointer",
                      viewportSize === v.id ? "bg-white/[0.08] text-white" : "text-white/20 hover:text-white/40")}>
                    {v.icon}
                  </button>
                ))}
              </div>
            )}

            {/* Undo / Redo */}
            {code && !isStreaming && (
              <div className="flex gap-0.5 pl-1.5 border-l border-white/[0.06]">
                <button onClick={editHistory.undo} disabled={!editHistory.canUndo} title="Desfazer (⌘Z)"
                  className={cn("p-1.5 rounded-md transition-all",
                    editHistory.canUndo ? "text-white/40 hover:text-white hover:bg-white/[0.05] cursor-pointer" : "text-white/10 cursor-not-allowed")}>
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={editHistory.redo} disabled={!editHistory.canRedo} title="Refazer (⇧⌘Z)"
                  className={cn("p-1.5 rounded-md transition-all",
                    editHistory.canRedo ? "text-white/40 hover:text-white hover:bg-white/[0.05] cursor-pointer" : "text-white/10 cursor-not-allowed")}>
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Visual Edit toggle */}
            {code && !isStreaming && (
              <button onClick={toggleVisualEdit} title="Modo edição visual — clique para selecionar elementos"
                className={cn("p-1.5 rounded-md transition-all cursor-pointer",
                  visualEditMode ? "bg-purple-500/20 text-purple-400" : "text-white/30 hover:text-white/50 hover:bg-white/[0.05]")}>
                <MousePointer className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {code && (
              <>
                <button onClick={handleCopy}
                  className={cn("flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
                    copied ? "bg-emerald-500/15 text-emerald-400" : "text-white/30 hover:text-white/50 hover:bg-white/[0.05]")}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "OK!" : "Copiar"}
                </button>
                <button onClick={handleSave} title="Salvar draft localmente"
                  className={cn("flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
                    saved ? "bg-emerald-500/15 text-emerald-400" : "text-white/30 hover:text-white/50 hover:bg-white/[0.05]")}>
                  {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {saved ? "Salvo!" : "Salvar"}
                </button>
                <button onClick={handleDownload}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium text-white/30 hover:text-white/50 hover:bg-white/[0.05] transition-all cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> HTML
                </button>
                <button onClick={handleExportWordPress}
                  className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer",
                    wpCopied
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-[#2563eb] hover:bg-[#1d4ed8] text-white shadow-sm")}>
                  {wpCopied ? <Check className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                  {wpCopied ? "Copiado!" : "WordPress"}
                </button>
                <button onClick={() => {
                  setPublishModalOpen(true);
                  setPublishedUrl(null);
                  setPublishError(null);
                  if (!publishSlug) {
                    const suggested = (prompt || "minha-pagina")
                      .toLowerCase()
                      .normalize("NFD").replace(/[̀-ͯ]/g, "")
                      .replace(/[^a-z0-9\s-]/g, "")
                      .trim()
                      .replace(/\s+/g, "-")
                      .slice(0, 50);
                    setPublishSlug(suggested);
                  }
                }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer shadow-sm">
                  <Globe className="w-3.5 h-3.5" /> Publicar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
            {error}
          </div>
        )}

        {/* Preview */}
        {rightTab === "preview" && (
          <div className="flex-1 overflow-auto flex items-start justify-center p-3">
            <div className={cn("w-full viewport-frame mx-auto", VIEWPORT_WIDTHS[viewportSize],
              viewportSize === "mobile" && "device-mobile", viewportSize === "tablet" && "device-tablet")}>
              {isStreaming && !finalCode ? (
                <div className="w-full h-[500px] rounded-2xl bg-[#111] flex flex-col items-center justify-center gap-4">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0s" }} />
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0.15s" }} />
                    <div className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0.3s" }} />
                  </div>
                  <p className="text-xs text-white/30">Construindo layout...</p>
                </div>
              ) : previewHtml ? (
                <iframe
                  ref={iframeRef}
                  srcDoc={previewHtml}
                  className={cn("w-full bg-white border-0 rounded-lg",
                    viewportSize === "mobile" ? "h-[667px]" :
                    viewportSize === "tablet" ? "h-[1024px]" :
                    viewportSize === "ultrawide" ? "h-[calc(100vh-100px)]" :
                    "h-[calc(100vh-100px)]")}
                  sandbox="allow-scripts allow-same-origin"
                  title="Preview"
                />
              ) : null}
            </div>
          </div>
        )}

        {/* Code */}
        {rightTab === "code" && (
          <div className="flex-1 overflow-auto">
            <SyntaxHighlighter language="xml" style={atomOneDark} showLineNumbers
              lineNumberStyle={{ color: "rgba(255,255,255,0.1)", fontSize: "11px", paddingRight: "16px", minWidth: "40px" }}
              customStyle={{ background: "#0c0c10", margin: 0, padding: "20px", fontSize: "12px", lineHeight: "1.8", minHeight: "100%" }}
              wrapLongLines>
              {code}
            </SyntaxHighlighter>
          </div>
        )}
      </div>

      {/* ─── RIGHT: CSS Style Panel ─── */}
      {rightCollapsed ? (
        <div className="w-[44px] shrink-0 flex flex-col items-center py-3 gap-1 bg-[#0e0e11] rounded-[20px]">
          <button onClick={() => setRightCollapsed(false)} title="Abrir painel de estilo"
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
            <PanelRightOpen className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="w-[260px] shrink-0 flex flex-col bg-[#0e0e11] rounded-[20px] overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06] shrink-0">
            <span className="text-[11px] font-medium text-white/40 uppercase tracking-widest">Estilo</span>
            <button onClick={() => setRightCollapsed(true)} title="Recolher painel de estilo"
              className="p-1 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all cursor-pointer">
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          </div>
          <VisualEditor
            elementProps={selectedElementProps}
            viewport={viewportSize}
            onStyleChange={handleVisualStyleChange}
            onTextChange={handleVisualTextChange}
            onAttrChange={handleVisualAttrChange}
            onFontLoad={handleLoadFont}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onMove={moveSelected}
            onSaveComponent={handleSaveComponent}
            onBack={toggleVisualEdit}
          />
        </div>
      )}

      {/* Elementor Export Modal */}
      {showElementorExport && (
        <ElementorExport
          code={finalCode || code}
          fonts={loadedFonts}
          onClose={() => setShowElementorExport(false)}
        />
      )}

      {/* Publish Modal */}
      {publishModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setPublishModalOpen(false); setPublishedUrl(null); }} />
          <div className="relative z-10 w-full max-w-lg mx-4 bg-[#0f0f14] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
                  <Globe className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <h3 className="text-[14px] font-semibold text-white">Publicar página</h3>
              </div>
              <button onClick={() => { setPublishModalOpen(false); setPublishedUrl(null); }} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {!publishedUrl ? (
              <div className="overflow-y-auto flex-1">
                <div className="px-6 py-5 space-y-5">

                  {/* URL Section */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Link2 className="w-3.5 h-3.5 text-white/30" />
                      <span className="text-[11px] uppercase tracking-widest text-white/30 font-semibold">URL</span>
                    </div>
                    <div className="flex items-center gap-0 rounded-lg border border-white/[0.08] overflow-hidden focus-within:border-purple-500/40 transition-colors">
                      <span className="px-3 py-2.5 text-[11px] text-white/25 bg-white/[0.02] border-r border-white/[0.06] shrink-0 font-mono">wevyflow.com/p/</span>
                      <input
                        value={publishSlug}
                        onChange={(e) => setPublishSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                        placeholder="meu-produto"
                        autoFocus
                        className="flex-1 bg-transparent px-3 py-2.5 text-[12px] text-white placeholder:text-white/20 focus:outline-none font-mono min-w-0"
                      />
                    </div>
                  </div>

                  {/* SEO Section */}
                  <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                    <button
                      onClick={() => setPublishSeoOpen((o) => !o)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-white/30" />
                        <span className="text-[12px] font-medium text-white/70">SEO e Indexação</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(publishMetaDesc || publishNoIndex) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-semibold">configurado</span>
                        )}
                        {publishSeoOpen ? <ChevronUp className="w-3.5 h-3.5 text-white/20" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20" />}
                      </div>
                    </button>
                    {publishSeoOpen && (
                      <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/[0.05]">
                        <div>
                          <label className="block text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-1.5">Meta description</label>
                          <textarea
                            value={publishMetaDesc}
                            onChange={(e) => setPublishMetaDesc(e.target.value)}
                            rows={2}
                            placeholder="Descrição que aparece no Google e WhatsApp quando o link é compartilhado..."
                            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-[11px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30 resize-none transition-colors"
                          />
                          <p className="text-[10px] text-white/20 mt-1">{publishMetaDesc.length}/160 caracteres</p>
                        </div>
                        <div className="flex items-center justify-between py-1">
                          <div>
                            <p className="text-[12px] text-white/60 font-medium">Ocultar do Google</p>
                            <p className="text-[10px] text-white/25 mt-0.5">Adiciona noindex — útil para páginas de teste ou internas</p>
                          </div>
                          <button
                            onClick={() => setPublishNoIndex((v) => !v)}
                            className={cn(
                              "relative w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer",
                              publishNoIndex ? "bg-purple-500" : "bg-white/[0.08]"
                            )}
                          >
                            <span className={cn(
                              "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                              publishNoIndex ? "translate-x-4" : "translate-x-0.5"
                            )} />
                          </button>
                        </div>
                        {publishNoIndex && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/[0.08] border border-amber-500/[0.15]">
                            <EyeOff className="w-3 h-3 text-amber-400 shrink-0" />
                            <p className="text-[10px] text-amber-400/80">Esta página não será indexada pelo Google.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tracking Section */}
                  <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                    <button
                      onClick={() => setPublishTrackingOpen((o) => !o)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <BarChart2 className="w-3.5 h-3.5 text-white/30" />
                        <span className="text-[12px] font-medium text-white/70">Rastreamento e Analytics</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(publishGaId || publishFbPixel) && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
                            {[publishGaId && "GA4", publishFbPixel && "Meta Pixel"].filter(Boolean).join(" + ")}
                          </span>
                        )}
                        {publishTrackingOpen ? <ChevronUp className="w-3.5 h-3.5 text-white/20" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20" />}
                      </div>
                    </button>
                    {publishTrackingOpen && (
                      <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/[0.05]">
                        <div>
                          <label className="block text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-1.5">Google Analytics 4 (Measurement ID)</label>
                          <input
                            value={publishGaId}
                            onChange={(e) => setPublishGaId(e.target.value.trim())}
                            placeholder="G-XXXXXXXXXX"
                            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30 font-mono transition-colors"
                          />
                          <p className="text-[10px] text-white/20 mt-1">Encontre em GA4 → Admin → Fluxos de dados</p>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-widest text-white/25 font-semibold mb-1.5">Meta Pixel ID</label>
                          <input
                            value={publishFbPixel}
                            onChange={(e) => setPublishFbPixel(e.target.value.trim())}
                            placeholder="123456789012345"
                            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/30 font-mono transition-colors"
                          />
                          <p className="text-[10px] text-white/20 mt-1">Gerenciador de Anuncios → Pixels → seu pixel</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {publishError && (
                    <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{publishError}</p>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                  <button
                    onClick={handlePublish}
                    disabled={publishLoading || !publishSlug.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-[13px] font-semibold transition-colors cursor-pointer shadow-lg shadow-purple-900/30"
                  >
                    {publishLoading
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Publicando...</>
                      : <><Globe className="w-3.5 h-3.5" /> Publicar agora</>
                    }
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-8 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-[15px] font-bold text-white mb-1">Pagina no ar!</p>
                <p className="text-[11px] text-white/35 mb-5 font-mono break-all">{publishedUrl}</p>
                <div className="flex gap-2">
                  <a href={publishedUrl} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir
                  </a>
                  <button
                    onClick={() => navigator.clipboard.writeText(publishedUrl)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white/60 text-[12px] font-medium transition-colors cursor-pointer">
                    <Copy className="w-3.5 h-3.5" /> Copiar URL
                  </button>
                </div>
                {(publishGaId || publishFbPixel) && (
                  <div className="mt-4 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-left">
                    <p className="text-[10px] uppercase tracking-widest text-white/20 font-semibold mb-1.5">Rastreamento injetado</p>
                    <div className="flex flex-wrap gap-1.5">
                      {publishGaId && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono">GA4 {publishGaId}</span>}
                      {publishFbPixel && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1877F2]/10 border border-[#1877F2]/20 text-[#4da6ff] font-mono">Pixel {publishFbPixel}</span>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function RailButton({ active, onClick, title, icon }: { active: boolean; onClick: () => void; title: string; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      className={cn("p-2 rounded-lg cursor-pointer transition-colors",
        active ? "bg-purple-500/20 text-purple-400" : "text-white/40 hover:text-white hover:bg-white/[0.05]")}>
      {icon}
    </button>
  );
}
