export type Platform = "html" | "elementor" | "webflow";

export type ViewportSize = "ultrawide" | "desktop" | "tablet" | "mobile";

// CSS media queries that mirror the viewport sizes — the iframe injects rules
// scoped with these so per-breakpoint edits in the editor map 1:1 to the published page.
export const VIEWPORT_MEDIA: Record<Exclude<ViewportSize, "desktop">, string> = {
  ultrawide: "@media (min-width: 1681px)",
  tablet: "@media (min-width: 481px) and (max-width: 1024px)",
  mobile: "@media (max-width: 480px)",
};

export type TemplateCategory = "vendas" | "captura" | "saas" | "blog" | "portfolio" | "sections";

export interface TemplateItem {
  id: string;
  label: string;
  description: string;
  category: TemplateCategory;
  prompt: string;
  tags: string[];
}

export interface HistoryEntry {
  id: string;
  prompt: string;
  platform: Platform;
  code: string;
  createdAt: number;
}
