export type FontCategory = "sans" | "serif" | "display" | "mono";

export interface GoogleFont {
  family: string;
  category: FontCategory;
  weights: number[];
  italic?: boolean;
}

// Curated list of fonts commonly used in high-converting landing pages.
export const GOOGLE_FONTS: GoogleFont[] = [
  // System / safe
  { family: "Inter", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900], italic: true },
  { family: "DM Sans", category: "sans", weights: [400, 500, 600, 700], italic: true },
  { family: "Manrope", category: "sans", weights: [300, 400, 500, 600, 700, 800] },
  { family: "Plus Jakarta Sans", category: "sans", weights: [300, 400, 500, 600, 700, 800], italic: true },
  { family: "Outfit", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Urbanist", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900], italic: true },
  { family: "Work Sans", category: "sans", weights: [300, 400, 500, 600, 700, 800], italic: true },
  { family: "Poppins", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900], italic: true },
  { family: "Montserrat", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900], italic: true },
  { family: "Nunito", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900], italic: true },
  { family: "Lato", category: "sans", weights: [300, 400, 700, 900], italic: true },
  { family: "Open Sans", category: "sans", weights: [300, 400, 500, 600, 700, 800], italic: true },
  { family: "Roboto", category: "sans", weights: [300, 400, 500, 700, 900], italic: true },
  { family: "Source Sans 3", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900], italic: true },
  { family: "Space Grotesk", category: "sans", weights: [300, 400, 500, 600, 700] },
  { family: "Geist", category: "sans", weights: [300, 400, 500, 600, 700, 800, 900] },

  // Display
  { family: "Montserrat", category: "display", weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Bebas Neue", category: "display", weights: [400] },
  { family: "Archivo Black", category: "display", weights: [400] },
  { family: "Oswald", category: "display", weights: [300, 400, 500, 600, 700] },
  { family: "Anton", category: "display", weights: [400] },
  { family: "Righteous", category: "display", weights: [400] },
  { family: "Space Mono", category: "mono", weights: [400, 700], italic: true },
  { family: "Syne", category: "display", weights: [400, 500, 600, 700, 800] },

  // Serif
  { family: "Playfair Display", category: "serif", weights: [400, 500, 600, 700, 800, 900], italic: true },
  { family: "DM Serif Display", category: "serif", weights: [400], italic: true },
  { family: "Lora", category: "serif", weights: [400, 500, 600, 700], italic: true },
  { family: "Merriweather", category: "serif", weights: [300, 400, 700, 900], italic: true },
  { family: "Libre Baskerville", category: "serif", weights: [400, 700], italic: true },
  { family: "Cormorant Garamond", category: "serif", weights: [300, 400, 500, 600, 700], italic: true },
  { family: "Crimson Pro", category: "serif", weights: [300, 400, 500, 600, 700, 800, 900], italic: true },
  { family: "Fraunces", category: "serif", weights: [300, 400, 500, 600, 700, 800, 900], italic: true },

  // Mono
  { family: "JetBrains Mono", category: "mono", weights: [400, 500, 600, 700, 800] },
  { family: "Fira Code", category: "mono", weights: [400, 500, 600, 700] },
  { family: "IBM Plex Mono", category: "mono", weights: [300, 400, 500, 600, 700] },
];

const FAMILY_INDEX: Record<string, GoogleFont> = Object.fromEntries(
  GOOGLE_FONTS.map((f) => [f.family.toLowerCase(), f])
);

export function findFont(family: string): GoogleFont | undefined {
  if (!family) return undefined;
  const clean = family.replace(/["']/g, "").split(",")[0].trim();
  return FAMILY_INDEX[clean.toLowerCase()];
}

export function googleFontUrl(families: string[]): string {
  if (families.length === 0) return "";
  const params = families
    .map((family) => {
      const font = FAMILY_INDEX[family.toLowerCase()];
      if (!font) return null;
      const weights = font.weights.join(";");
      const base = `family=${encodeURIComponent(font.family).replace(/%20/g, "+")}`;
      if (font.italic) {
        const italicAxis = font.weights.map((w) => `0,${w}`).concat(font.weights.map((w) => `1,${w}`)).join(";");
        return `${base}:ital,wght@${italicAxis}`;
      }
      return `${base}:wght@${weights}`;
    })
    .filter(Boolean);
  if (params.length === 0) return "";
  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}

export function cssFontStack(family: string, category?: FontCategory): string {
  const fallback =
    category === "serif" ? "Georgia, serif" :
    category === "mono" ? "ui-monospace, SFMono-Regular, Menlo, monospace" :
    category === "display" ? "system-ui, sans-serif" :
    "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  return `'${family}', ${fallback}`;
}
