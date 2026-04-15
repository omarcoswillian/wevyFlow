"use client";

import { ViewportSize } from "../../lib/types";
import { EmptyState } from "../EmptyState";
import { PreviewToolbar } from "./PreviewToolbar";
import { PreviewFrame } from "./PreviewFrame";
import { CodeViewer } from "./CodeViewer";

interface MainAreaProps {
  generatedCode: string;
  isLoading: boolean;
  error: string;
  activeTab: "preview" | "code";
  onTabChange: (tab: "preview" | "code") => void;
  viewportSize: ViewportSize;
  onViewportChange: (size: ViewportSize) => void;
}

export function MainArea({
  generatedCode,
  isLoading,
  error,
  activeTab,
  onTabChange,
  viewportSize,
  onViewportChange,
}: MainAreaProps) {
  const hasContent = Boolean(generatedCode) || isLoading;

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <PreviewToolbar
        activeTab={activeTab}
        onTabChange={onTabChange}
        viewportSize={viewportSize}
        onViewportChange={onViewportChange}
        hasCode={Boolean(generatedCode)}
        code={generatedCode}
      />

      <div className="flex-1 overflow-hidden">
        {error && (
          <div className="m-4 p-4 rounded-xl bg-wf-danger/10 border border-wf-danger/20 text-wf-danger text-sm animate-fade-in flex items-start gap-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <p className="font-medium mb-0.5">Erro na geração</p>
              <p className="text-xs opacity-80">{error}</p>
            </div>
          </div>
        )}

        {!hasContent && !error && <EmptyState />}

        {hasContent && activeTab === "preview" && (
          <PreviewFrame
            code={generatedCode}
            viewportSize={viewportSize}
            isLoading={isLoading}
          />
        )}

        {hasContent && activeTab === "code" && (
          <CodeViewer code={generatedCode} />
        )}
      </div>
    </main>
  );
}
