import { HEADERS } from "./headers";
import { HEROES } from "./heroes";
import { SECTIONS } from "./sections";
import { LANCAMENTO } from "./lancamento";

export const COMPONENT_LIBRARY: Record<string, string> = {
  ...HEADERS,
  ...HEROES,
  ...SECTIONS,
  ...LANCAMENTO,
};

export function getComponentCatalog(): string {
  const entries = Object.entries(COMPONENT_LIBRARY);
  let catalog = "COMPONENTES DISPONÍVEIS:\n";
  for (const [id, html] of entries) {
    const nameMatch = html.match(/<!-- (.+?) -->/);
    const name = nameMatch ? nameMatch[1] : id;
    catalog += `• [${id}] → ${name}\n`;
  }
  return catalog;
}

export function getAllComponentsHTML(): string {
  return Object.values(COMPONENT_LIBRARY).join("\n\n");
}
