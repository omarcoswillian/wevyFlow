"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { ViewportSize } from "../../lib/types";

interface PreviewToolbarProps {
  activeTab: "preview" | "code";
  onTabChange: (tab: "preview" | "code") => void;
  viewportSize: ViewportSize;
  onViewportChange: (size: ViewportSize) => void;
  hasCode: boolean;
  code: string;
}

const VIEWPORTS: { id: ViewportSize; label: string; icon: React.ReactNode }[] = [
  {
    id: "desktop",
    label: "Desktop",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: "tablet",
    label: "Tablet",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
  },
  {
    id: "mobile",
    label: "Mobile",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <line x1="12" y1="18" x2="12.01" y2="18" />
      </svg>
    ),
  },
];

export function PreviewToolbar({
  activeTab,
  onTabChange,
  viewportSize,
  onViewportChange,
  hasCode,
  code,
}: PreviewToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleDownload = useCallback(() => {
    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Layout WevyFlow</title>
</head>
<body>
${code}
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wevyflow-layout.html";
    a.click();
    URL.revokeObjectURL(url);
  }, [code]);

  return (
    <div className="flex items-center justify-between border-b border-wf-border px-4 py-2 shrink-0 bg-wf-bg">
      <div className="flex items-center gap-4">
        {/* Tabs */}
        <div className="flex gap-1">
          <button
            onClick={() => onTabChange("preview")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
              activeTab === "preview"
                ? "bg-wf-primary/15 text-wf-primary"
                : "text-wf-text-muted hover:text-wf-text hover:bg-wf-surface-hover"
            )}
          >
            Preview
          </button>
          <button
            onClick={() => onTabChange("code")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
              activeTab === "code"
                ? "bg-wf-primary/15 text-wf-primary"
                : "text-wf-text-muted hover:text-wf-text hover:bg-wf-surface-hover"
            )}
          >
            Código
          </button>
        </div>

        {/* Viewport toggle - only on preview */}
        {activeTab === "preview" && (
          <div className="flex items-center gap-1 pl-3 border-l border-wf-border">
            {VIEWPORTS.map((v) => (
              <button
                key={v.id}
                onClick={() => onViewportChange(v.id)}
                title={v.label}
                className={cn(
                  "p-1.5 rounded-md transition-all cursor-pointer",
                  viewportSize === v.id
                    ? "bg-wf-primary/15 text-wf-primary"
                    : "text-wf-text-muted hover:text-wf-text hover:bg-wf-surface-hover"
                )}
              >
                {v.icon}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {hasCode && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer",
              copied
                ? "bg-wf-success/15 text-wf-success border border-wf-success/30"
                : "bg-wf-surface border border-wf-border text-wf-text-muted hover:border-wf-primary hover:text-wf-primary"
            )}
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-wf-primary text-white hover:bg-wf-primary-hover transition-all cursor-pointer flex items-center gap-1.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Baixar HTML
          </button>
        </div>
      )}
    </div>
  );
}
