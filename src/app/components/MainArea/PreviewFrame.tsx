"use client";

import { cn } from "../../lib/cn";
import { ViewportSize } from "../../lib/types";

interface PreviewFrameProps {
  code: string;
  viewportSize: ViewportSize;
  isLoading: boolean;
}

const VIEWPORT_WIDTHS: Record<ViewportSize, string> = {
  ultrawide: "max-w-[2200px]",
  desktop: "max-w-full",
  tablet: "max-w-[768px]",
  mobile: "max-w-[375px]",
};

export function PreviewFrame({ code, viewportSize, isLoading }: PreviewFrameProps) {
  const previewHtml = code
    ? `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}</style></head><body>${code}</body></html>`
    : "";

  return (
    <div className="h-full flex items-start justify-center overflow-auto p-4 bg-wf-bg/50">
      <div
        className={cn(
          "w-full viewport-frame mx-auto relative",
          VIEWPORT_WIDTHS[viewportSize],
          viewportSize === "mobile" && "device-mobile",
          viewportSize === "tablet" && "device-tablet"
        )}
      >
        {isLoading && !code && (
          <div className="w-full h-96 shimmer rounded-lg" />
        )}

        {(code || isLoading) && (
          <iframe
            srcDoc={previewHtml}
            className={cn(
              "w-full bg-white border-0",
              viewportSize === "mobile" ? "h-[667px]" : viewportSize === "tablet" ? "h-[800px]" : "h-[calc(100vh-140px)]",
              isLoading && !code && "opacity-0",
              code && "animate-fade-in"
            )}
            sandbox="allow-scripts"
            title="Preview"
          />
        )}
      </div>
    </div>
  );
}
