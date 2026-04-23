"use client";

import { WorkspaceView } from "../../components/WorkspaceView";
import { useAppContext } from "../_context";

export default function Page() {
  const {
    generatedCode, isLoading, isRefining, currentPlatform, currentPrompt,
    error, handleRefine, handleBack,
  } = useAppContext();

  return (
    <WorkspaceView
      code={generatedCode}
      isLoading={isLoading}
      isRefining={isRefining}
      platform={currentPlatform}
      prompt={currentPrompt}
      error={error}
      onRefine={handleRefine}
      onBack={handleBack}
    />
  );
}
