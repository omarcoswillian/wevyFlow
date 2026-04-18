"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  MessageCircle,
  Info,
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
  Sparkles,
  Send,
  ImagePlus,
  X,
  Eye,
  MousePointer,
  AlignRight,
  Code2,
  Share2,
  MoreHorizontal,
  Globe,
  ArrowRight,
  Bot,
  User,
  CheckCircle2,
  Circle,
  Undo2,
  Redo2,
  Save,
} from "lucide-react";
import { Platform, ViewportSize } from "../lib/types";
import { IFRAME_VISUAL_EDIT_SCRIPT } from "../lib/iframe-inject";
import { BASE_CSS, BASE_SCRIPT } from "../lib/base-css";
import { useEditHistory } from "../lib/editor/useEditHistory";
import { googleFontUrl } from "../lib/editor/google-fonts";
import { VisualEditor, ElementProps } from "./VisualEditor";
import { InsertPanel } from "./InsertPanel";
import { LayersPanel, TreeNode } from "./LayersPanel";
import { LibraryPanel } from "./LibraryPanel";
import { useComponents } from "../lib/editor/useComponents";
import { ElementorExport } from "./ElementorExport";
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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  images?: { name: string; base64: string }[];
  timestamp: number;
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

// Container max-widths for each viewport. Ultra-wide simulates a 2K display.
const VIEWPORT_WIDTHS: Record<ViewportSize, string> = {
  ultrawide: "max-w-[2200px]",
  desktop: "max-w-full",
  tablet: "max-w-[768px]",
  mobile: "max-w-[375px]",
};

export function WorkspaceView({
  code, isLoading, isRefining, platform, prompt, error, onRefine, onBack,
}: WorkspaceViewProps) {
  const [rightTab, setRightTab] = useState<"preview" | "code">("preview");
  const [userOverrodeTab, setUserOverrodeTab] = useState(false);
  const [viewportSize, setViewportSize] = useState<ViewportSize>("desktop");
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [saved, setSaved] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatImages, setChatImages] = useState<{ name: string; base64: string }[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [leftPanelTab, setLeftPanelTab] = useState<"chat" | "details" | "insert" | "layers" | "library">("chat");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const { components, add: addComponent, remove: removeComponent, rename: renameComponent } = useComponents();
  const pendingComponentName = useRef<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [visualEditMode, setVisualEditMode] = useState(false);
  const [selectedElementProps, setSelectedElementProps] = useState<ElementProps | null>(null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [loadedFonts, setLoadedFonts] = useState<string[]>([]);
  const [showElementorExport, setShowElementorExport] = useState(false);
  const [elementorCopied, setElementorCopied] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatFileRef = useRef<HTMLInputElement>(null);
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
    } catch { /* quota / disabled storage — silent */ }
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
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${BASE_CSS}${fontsLink}</head><body>${body}${BASE_SCRIPT}${IFRAME_VISUAL_EDIT_SCRIPT}</body></html>`;
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
    navigator.clipboard.writeText(finalCode || code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleDownload = useCallback(() => {
    const codeToExport = finalCode || code;
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

  const handleSend = () => {
    if ((!chatInput.trim() && chatImages.length === 0) || isRefining) return;

    // If there are images and no text (or text about photo), try to insert directly
    if (chatImages.length > 0 && (!chatInput.trim() || chatInput.toLowerCase().includes("foto") || chatInput.toLowerCase().includes("imagem") || chatInput.toLowerCase().includes("inserir"))) {
      // Insert first image directly into template
      insertPhotoIntoTemplate(chatImages[0].base64);
      setMessages((prev) => [...prev, { role: "user", content: chatInput.trim() || "Inserir foto no template", images: [...chatImages], timestamp: Date.now() }]);
      setChatInput("");
      setChatImages([]);
      return;
    }

    const msg = chatInput.trim() || "Analise a imagem e aplique ao layout";
    const imgs = [...chatImages];
    setMessages((prev) => [...prev, { role: "user", content: msg, images: imgs.length > 0 ? imgs : undefined, timestamp: Date.now() }]);
    setChatInput("");
    setChatImages([]);
    onRefine(msg, imgs.length > 0 ? imgs : undefined);
  };

  const addImageFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      if (file.size > 2_000_000) return; // 2MB max
      const reader = new FileReader();
      reader.onload = () => {
        setChatImages((prev) => prev.length >= 3 ? prev : [...prev, { name: file.name, base64: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleChatImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addImageFiles(e.target.files);
    if (chatFileRef.current) chatFileRef.current.value = "";
  }, [addImageFiles]);

  // Global drag & drop + paste (native events for reliability)
  useEffect(() => {
    let dragCounter = 0;

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragging(true);
      }
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setIsDragging(false);
      }
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);
      if (e.dataTransfer?.files.length) {
        addImageFiles(e.dataTransfer.files);
      }
    };

    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        addImageFiles(files);
      }
    };

    document.addEventListener("dragenter", onDragEnter);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);

    return () => {
      document.removeEventListener("dragenter", onDragEnter);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, [addImageFiles]);

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
      {/* Global drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-purple-500/5 border-2 border-dashed border-purple-500/40 flex items-center justify-center backdrop-blur-[2px] pointer-events-none">
          <div className="text-center bg-[#1a1a1e]/90 backdrop-blur-xl rounded-2xl px-8 py-6 border border-purple-500/20 shadow-2xl">
            <ImagePlus className="w-10 h-10 text-purple-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-purple-300">Solte a imagem aqui</p>
            <p className="text-[11px] text-purple-400/40 mt-1">Print, referência ou mockup</p>
          </div>
        </div>
      )}

      {/* ─── Collapsed Rail (shows instead of full panel) ─── */}
      {leftCollapsed && (
        <div className="w-[44px] shrink-0 flex flex-col items-center py-3 gap-1 bg-[#0e0e11] rounded-[20px]">
          <button onClick={() => setLeftCollapsed(false)} title="Expandir painel (⌘\\)"
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
            <PanelLeftOpen className="w-4 h-4" />
          </button>
          <div className="w-6 h-px bg-white/[0.06] my-1" />
          <RailButton active={leftPanelTab === "chat"} onClick={() => { setLeftPanelTab("chat"); setLeftCollapsed(false); }} title="Chat" icon={<MessageCircle className="w-4 h-4" />} />
          <RailButton active={leftPanelTab === "details"} onClick={() => { setLeftPanelTab("details"); setLeftCollapsed(false); }} title="Detalhes" icon={<Info className="w-4 h-4" />} />
          {code && !isLoading && <RailButton active={leftPanelTab === "insert"} onClick={() => { setLeftPanelTab("insert"); setLeftCollapsed(false); }} title="Inserir" icon={<Plus className="w-4 h-4" />} />}
          {code && !isLoading && <RailButton active={leftPanelTab === "library"} onClick={() => { setLeftPanelTab("library"); setLeftCollapsed(false); }} title="Biblioteca" icon={<Package className="w-4 h-4" />} />}
          {code && !isLoading && <RailButton active={leftPanelTab === "layers"} onClick={() => { setLeftPanelTab("layers"); setLeftCollapsed(false); }} title="Camadas" icon={<AlignRight className="w-4 h-4" />} />}
        </div>
      )}

      {/* ─── Left Panel: Chat + Steps ─── */}
      {!leftCollapsed && (
      <div
        ref={dropZoneRef}
        className="w-[380px] shrink-0 flex flex-col bg-[#0e0e11] rounded-[20px] overflow-hidden relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.05] transition-all cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-[13px] font-medium text-white/80 truncate max-w-[220px]">{prompt.slice(0, 50)}{prompt.length > 50 ? "..." : ""}</h2>
              <p className="text-[10px] text-white/25">
                {isLoading ? "Construindo..." : isRefining ? "Refinando..." : "Concluído"}
              </p>
            </div>
          </div>
          <button onClick={() => setLeftCollapsed(true)} title="Recolher painel (⌘\\)"
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/[0.06] cursor-pointer transition-colors">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 px-3 pt-3 pb-1">
          <button onClick={() => { setLeftPanelTab("chat"); if (visualEditMode) toggleVisualEdit(); }}
            className={cn("px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
              leftPanelTab === "chat" && !visualEditMode ? "bg-white/[0.07] text-white/80" : "text-white/30 hover:text-white/50")}>
            Chat
          </button>
          <button onClick={() => { setLeftPanelTab("details"); if (visualEditMode) toggleVisualEdit(); }}
            className={cn("px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
              leftPanelTab === "details" && !visualEditMode ? "bg-white/[0.07] text-white/80" : "text-white/30 hover:text-white/50")}>
            Detalhes
          </button>
          {code && !isLoading && (
            <button onClick={() => { setLeftPanelTab("insert"); if (visualEditMode) toggleVisualEdit(); }}
              className={cn("px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
                leftPanelTab === "insert" && !visualEditMode ? "bg-white/[0.07] text-white/80" : "text-white/30 hover:text-white/50")}>
              Inserir
            </button>
          )}
          {code && !isLoading && (
            <button onClick={() => { setLeftPanelTab("library"); if (visualEditMode) toggleVisualEdit(); }}
              className={cn("px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
                leftPanelTab === "library" && !visualEditMode ? "bg-white/[0.07] text-white/80" : "text-white/30 hover:text-white/50")}>
              Biblioteca
            </button>
          )}
          {code && !isLoading && (
            <button
              onClick={() => { setLeftPanelTab("layers"); if (visualEditMode) toggleVisualEdit(); }}
              title="Camadas"
              className={cn("flex items-center justify-center w-8 h-[30px] rounded-lg transition-all cursor-pointer ml-auto",
                leftPanelTab === "layers" && !visualEditMode ? "bg-white/[0.07] text-white/80" : "text-white/30 hover:text-white/50 hover:bg-white/[0.04]")}>
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          )}
          {code && !isLoading && (
            <button onClick={() => { toggleVisualEdit(); setLeftPanelTab("chat"); }}
              title="Editar visual"
              className={cn("flex items-center justify-center w-8 h-[30px] rounded-lg transition-all cursor-pointer",
                visualEditMode ? "bg-purple-500/20 text-purple-400" : "text-white/30 hover:text-white/50 hover:bg-white/[0.04]")}>
              <MousePointer className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Content */}
        {visualEditMode ? (
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
        ) : (
        <>
        {leftPanelTab === "insert" ? (
          <InsertPanel onInsert={handleInsertHtml} onDragHtml={handleDragHtml} />
        ) : leftPanelTab === "layers" ? (
          <LayersPanel
            tree={tree}
            selectedId={selectedElementId}
            onSelect={handleLayerSelect}
            onDelete={handleLayerDelete}
            onToggleHidden={handleLayerToggleHidden}
            onRename={handleLayerRename}
          />
        ) : leftPanelTab === "library" ? (
          <LibraryPanel
            components={components}
            pageHtml={finalCode || code}
            onInsert={handleInsertHtml}
            onDragHtml={handleDragHtml}
            onRemoveComponent={removeComponent}
            onRenameComponent={renameComponent}
          />
        ) : (
        <>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {leftPanelTab === "details" && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-medium mb-3">Etapas de construção</p>
              {buildSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5 py-1.5">
                  {step.status === "done" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : step.status === "active" ? (
                    <Loader2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5 animate-spin" />
                  ) : (
                    <Circle className="w-4 h-4 text-white/10 shrink-0 mt-0.5" />
                  )}
                  <span className={cn("text-[12px]",
                    step.status === "done" ? "text-white/50" : step.status === "active" ? "text-purple-400" : "text-white/15"
                  )}>{step.label}</span>
                </div>
              ))}

              {code && !isLoading && (
                <div className="mt-6 pt-4 border-t border-white/[0.06] space-y-3">
                  <p className="text-[10px] text-white/25 uppercase tracking-widest font-medium">Exportar para</p>
                  <div className="grid grid-cols-2 gap-2">
                    <ExportButton label="Elementor" desc="WordPress" onClick={handleCopy} />
                    <ExportButton label="Webflow" desc="Embed code" onClick={handleCopy} />
                    <ExportButton label="Framer" desc="Code override" onClick={handleCopy} />
                    <ExportButton label="HTML" desc="Download" onClick={handleDownload} />
                  </div>
                </div>
              )}
            </div>
          )}

          {leftPanelTab === "chat" && (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className={cn(
                    "w-6 h-6 rounded-lg shrink-0 flex items-center justify-center mt-0.5",
                    msg.role === "user" ? "bg-white/[0.06]" : "bg-purple-500/15"
                  )}>
                    {msg.role === "user" ? <User className="w-3 h-3 text-white/40" /> : <Bot className="w-3 h-3 text-purple-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-white/25 mb-1">{msg.role === "user" ? "Você" : "WevyFlow"}</p>
                    {msg.images && msg.images.length > 0 && (
                      <div className="flex gap-1.5 mb-2">
                        {msg.images.map((img, j) => (
                          <img key={j} src={img.base64} alt={img.name} className="w-20 h-20 rounded-xl object-cover border border-white/[0.1]" />
                        ))}
                      </div>
                    )}
                    <p className="text-[12px] text-white/60 leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}

              {(isLoading || isRefining) && (
                <div className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-purple-500/15 shrink-0 flex items-center justify-center mt-0.5">
                    <Bot className="w-3 h-3 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-white/25 mb-1">WevyFlow</p>
                    <div className="flex items-center gap-2 text-[12px] text-purple-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {isRefining ? "Aplicando refinamento..." : "Construindo layout..."}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Photo insert banner - shows when template has photo placeholder */}
        {(finalCode || code) && ((finalCode || code).includes("photo-placeholder") || (finalCode || code).includes("hero-right-fallback")) && (
          <div className="px-3 pt-2">
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    insertPhotoIntoTemplate(reader.result as string);
                    setMessages((prev) => [...prev, { role: "assistant", content: "Foto inserida no template!", timestamp: Date.now() }]);
                  };
                  reader.readAsDataURL(file);
                };
                input.click();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/15 transition-all cursor-pointer"
            >
              <ImagePlus className="w-4 h-4" />
              Inserir foto do mentor / produto
            </button>
          </div>
        )}

        {/* Chat input */}
        <div className="px-3 pb-3 pt-1 space-y-2">
          {/* Image preview strip */}
          {chatImages.length > 0 && (
            <div className="flex gap-1.5 px-1">
              {chatImages.map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img.base64} alt={img.name} className="w-12 h-12 rounded-lg object-cover border border-white/[0.1]" />
                  <button onClick={() => setChatImages(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl px-2.5 py-2 focus-within:border-purple-500/30 transition-colors">
            {/* Image upload button */}
            <button
              onClick={() => chatFileRef.current?.click()}
              disabled={isLoading || chatImages.length >= 3}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer shrink-0",
                chatImages.length >= 3 ? "text-white/10 cursor-not-allowed" : "text-white/25 hover:text-purple-400 hover:bg-white/[0.05]"
              )}
              title="Enviar imagem (print, referência, mockup)"
            >
              <ImagePlus className="w-4 h-4" />
            </button>
            <input ref={chatFileRef} type="file" accept="image/*" multiple onChange={handleChatImageUpload} className="hidden" />

            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={chatImages.length > 0 ? "Descreva o que quer baseado na imagem..." : "Peça alterações, envie prints..."}
              className="flex-1 bg-transparent text-[12px] text-white placeholder:text-white/20 focus:outline-none"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isRefining || isLoading || (!chatInput.trim() && chatImages.length === 0)}
              className={cn(
                "p-1.5 rounded-lg transition-all cursor-pointer shrink-0",
                (chatInput.trim() || chatImages.length > 0) && !isRefining && !isLoading
                  ? "bg-purple-500 text-white hover:bg-purple-400"
                  : "text-white/15"
              )}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[9px] text-white/15 text-center">Envie prints e referências — a IA analisa visualmente</p>
        </div>
        </>
        )}
        </>
        )}
      </div>
      )}

      {/* ─── Right Panel: Preview / Code ─── */}
      <div className="flex-1 flex flex-col rounded-[20px] bg-[#0c0c10] overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-[#0c0c10]">
          <div className="flex items-center gap-2">
            {/* Preview / Code toggle */}
            <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/[0.03]">
              <button onClick={() => { setRightTab("preview"); setUserOverrodeTab(true); }}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                  rightTab === "preview" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50")}>
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button onClick={() => { setRightTab("code"); setUserOverrodeTab(true); }}
                className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer",
                  rightTab === "code" ? "bg-white/[0.08] text-white" : "text-white/30 hover:text-white/50")}>
                <Code2 className="w-3.5 h-3.5" /> Código
              </button>
            </div>

            {/* Viewports */}
            {rightTab === "preview" && (
              <div className="flex gap-0.5 ml-1">
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
              <div className="flex gap-0.5 ml-1 pl-2 border-l border-white/[0.06]">
                <button
                  onClick={editHistory.undo}
                  disabled={!editHistory.canUndo}
                  title="Desfazer (⌘Z)"
                  className={cn("p-1.5 rounded-md transition-all",
                    editHistory.canUndo ? "text-white/40 hover:text-white hover:bg-white/[0.05] cursor-pointer" : "text-white/10 cursor-not-allowed")}>
                  <Undo2 className="w-4 h-4" />
                </button>
                <button
                  onClick={editHistory.redo}
                  disabled={!editHistory.canRedo}
                  title="Refazer (⇧⌘Z)"
                  className={cn("p-1.5 rounded-md transition-all",
                    editHistory.canRedo ? "text-white/40 hover:text-white hover:bg-white/[0.05] cursor-pointer" : "text-white/10 cursor-not-allowed")}>
                  <Redo2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            {code && (
              <>
                <button onClick={handleCopy}
                  className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
                    copied ? "bg-emerald-500/15 text-emerald-400" : "text-white/30 hover:text-white/50 hover:bg-white/[0.05]")}>
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copiado!" : "Copiar"}
                </button>
                <button
                  onClick={() => {
                    const codeToShare = finalCode || code;
                    const fullHtml = `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Layout WevyFlow</title>\n</head>\n<body>\n${codeToShare}\n</body>\n</html>`;
                    if (navigator.share) {
                      const blob = new Blob([fullHtml], { type: "text/html" });
                      const file = new File([blob], "wevyflow-layout.html", { type: "text/html" });
                      navigator.share({ title: "Layout WevyFlow", files: [file] }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(codeToShare);
                      setShared(true);
                      setTimeout(() => setShared(false), 2000);
                    }
                  }}
                  className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
                    shared ? "bg-emerald-500/15 text-emerald-400" : "text-white/30 hover:text-white/50 hover:bg-white/[0.05]")}
                >
                  {shared ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                  {shared ? "Copiado!" : "Share"}
                </button>
                <button onClick={handleSave} title="Salvar alterações localmente (este navegador)"
                  className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
                    saved ? "bg-emerald-500/15 text-emerald-400" : "text-white/30 hover:text-white/50 hover:bg-white/[0.05]")}>
                  {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                  {saved ? "Salvo!" : "Salvar"}
                </button>
                <button onClick={handleDownload}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/30 hover:text-white/50 hover:bg-white/[0.05] transition-all cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> HTML
                </button>
                <button onClick={handleCopyElementor}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer",
                    elementorCopied
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-gradient-to-r from-orange-500 to-pink-500 text-white hover:shadow-lg hover:shadow-orange-500/20")}>
                  {elementorCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {elementorCopied ? "Copiado! Cole no Elementor" : "Elementor"}
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

      {/* Elementor Export Modal */}
      {showElementorExport && (
        <ElementorExport
          code={finalCode || code}
          fonts={loadedFonts}
          onClose={() => setShowElementorExport(false)}
        />
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

function ExportButton({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-start px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/30 hover:bg-white/[0.04] transition-all cursor-pointer group">
      <span className="text-[11px] font-medium text-white/60 group-hover:text-purple-400 transition-colors">{label}</span>
      <span className="text-[9px] text-white/20">{desc}</span>
    </button>
  );
}
