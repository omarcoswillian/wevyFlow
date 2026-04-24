import type { ViewportSize } from "@/app/lib/types";
import type { ReactNode } from "react";

export type { ViewportSize };

export interface ViewportOption {
  id: ViewportSize;
  icon: ReactNode;
  label: string;
}

export const VIEWPORT_WIDTHS: Record<ViewportSize, string> = {
  ultrawide: "max-w-[2200px]",
  desktop: "max-w-full",
  tablet: "max-w-[768px]",
  mobile: "max-w-[375px]",
};
