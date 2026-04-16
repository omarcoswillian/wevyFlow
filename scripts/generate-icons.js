/**
 * Generates PWA icons as PNG from an SVG source.
 * Run: node scripts/generate-icons.js
 *
 * Since we don't want to add sharp/canvas deps just for icon gen,
 * this creates simple PNG icons using raw binary data.
 * For production, replace these with your real brand icons.
 */

const fs = require("fs");
const path = require("path");

// Minimal SVG icon for WavyFlow — purple wave "W"
const createSvg = (size, maskable = false) => {
  const padding = maskable ? size * 0.1 : 0;
  const inner = size - padding * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.15}" fill="#09090b"/>
  ${maskable ? `<rect x="${padding}" y="${padding}" width="${inner}" height="${inner}" rx="${inner * 0.15}" fill="#09090b"/>` : ""}
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
  </defs>
  <text x="50%" y="54%" dominant-baseline="central" text-anchor="middle"
    font-family="system-ui, -apple-system, sans-serif" font-weight="800"
    font-size="${size * 0.48}" fill="url(#g)" letter-spacing="-${size * 0.02}">W</text>
  <rect x="${size * 0.2}" y="${size * 0.78}" width="${size * 0.6}" height="${size * 0.03}" rx="${size * 0.015}" fill="#a78bfa" opacity="0.6"/>
</svg>`;
};

const iconsDir = path.join(__dirname, "..", "public", "icons");

// Write SVG files (browsers/Next.js can serve these; for real PNGs, use a converter)
const sizes = [192, 512];
for (const size of sizes) {
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.svg`), createSvg(size, false));
  fs.writeFileSync(path.join(iconsDir, `icon-maskable-${size}.svg`), createSvg(size, true));
}

// Also create a simple apple-touch-icon SVG
fs.writeFileSync(path.join(iconsDir, "apple-touch-icon.svg"), createSvg(180, false));

console.log("PWA icon SVGs generated in public/icons/");
console.log("NOTE: For production, convert these to PNG or replace with your brand icons.");
