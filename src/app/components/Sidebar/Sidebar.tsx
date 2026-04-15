"use client";

import { Platform } from "../../lib/types";
import { PlatformSelector } from "./PlatformSelector";
import { PromptInput } from "./PromptInput";
import { RefinementInput } from "./RefinementInput";
import { TemplateGrid } from "./TemplateGrid";

interface SidebarProps {
  platform: Platform;
  onPlatformChange: (platform: Platform) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  hasGeneratedCode: boolean;
  onRefine: (request: string) => void;
  isRefining: boolean;
  onNewGeneration: () => void;
}

export function Sidebar({
  platform,
  onPlatformChange,
  prompt,
  onPromptChange,
  onGenerate,
  isLoading,
  hasGeneratedCode,
  onRefine,
  isRefining,
  onNewGeneration,
}: SidebarProps) {
  return (
    <aside className="w-[var(--wf-sidebar-width)] border-r border-wf-border flex flex-col shrink-0 overflow-y-auto bg-wf-bg">
      <PlatformSelector value={platform} onChange={onPlatformChange} />
      <PromptInput
        value={prompt}
        onChange={onPromptChange}
        onGenerate={onGenerate}
        isLoading={isLoading}
      />

      {hasGeneratedCode && (
        <RefinementInput
          onRefine={onRefine}
          onNewGeneration={onNewGeneration}
          isRefining={isRefining}
        />
      )}

      <TemplateGrid onSelectTemplate={onPromptChange} />
    </aside>
  );
}
