export type Platform = "html" | "elementor" | "webflow";

export type ViewportSize = "desktop" | "tablet" | "mobile";

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
