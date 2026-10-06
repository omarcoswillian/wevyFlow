/* Camada de texto determinística: o modelo de imagem gera só o fundo (sem
 * texto) e a headline e o CTA aprovados entram aqui, pelo canvas, com a fonte
 * da marca. O texto sai exato, em português, sem depender de o modelo acertar
 * a grafia. */

export interface TextOverlayInput {
  imageUrl: string;
  headline: string;
  cta: string;
  /** Chave de fonte do briefing (sora, inter, poppins, ...). */
  fontChoice: string;
  primaryColor: string;
  /** Estilo claro usa texto escuro sobre véu claro; os demais, o contrário. */
  light: boolean;
  /** Stories/9:16 pedem margem maior (zona segura das plataformas). */
  safeVertical: boolean;
  /** Tamanho final em pixels: o fundo é recortado (cover, centralizado) pra
   * caber. Sem isso, usa o tamanho natural da imagem. */
  targetWidth?: number;
  targetHeight?: number;
}

const GOOGLE_FONT: Record<string, string> = {
  sora: "Sora", inter: "Inter", poppins: "Poppins", montserrat: "Montserrat",
  playfair: "Playfair Display", "space-grotesk": "Space Grotesk",
};

const loadedFonts = new Set<string>();

async function ensureFont(family: string): Promise<void> {
  if (typeof document === "undefined" || loadedFonts.has(family)) return;
  try {
    const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@700;800&display=swap`;
    if (!document.querySelector(`link[href="${href}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
    await Promise.race([
      document.fonts.load(`800 48px "${family}"`),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
    loadedFonts.add(family);
  } catch {
    /* segue com a fonte de reserva */
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem de fundo."));
    img.src = url;
  });
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Cor de texto legível sobre um fundo hex (WCAG: luminância relativa). */
function readableOn(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#111111" : "#ffffff";
}

/** Compõe headline + CTA sobre o fundo e devolve um PNG em data URL. */
export async function composeTextLayer(input: TextOverlayInput): Promise<{ dataUrl: string; mimeType: "image/png" }> {
  const family = GOOGLE_FONT[input.fontChoice] ?? "Sora";
  await ensureFont(family);
  const img = await loadImage(input.imageUrl);
  const W = input.targetWidth ?? img.naturalWidth;
  const H = input.targetHeight ?? img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  // Recorte "cover" centralizado: preenche o quadro sem distorcer.
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  ctx.drawImage(img, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);

  const base = Math.min(W, H);
  const marginX = Math.round(W * 0.08);
  const marginTop = Math.round(H * (input.safeVertical ? 0.14 : 0.07));
  const marginBottom = Math.round(H * (input.safeVertical ? 0.14 : 0.07));
  const textColor = input.light ? "#111111" : "#ffffff";
  const veil = input.light ? "255,255,255" : "0,0,0";
  const stack = `"${family}", system-ui, -apple-system, "Segoe UI", sans-serif`;

  // Véu degradê atrás da headline e do CTA pra garantir contraste em qualquer fundo.
  const top = ctx.createLinearGradient(0, 0, 0, H * 0.5);
  top.addColorStop(0, `rgba(${veil},0.62)`);
  top.addColorStop(1, `rgba(${veil},0)`);
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, H * 0.5);
  const bottom = ctx.createLinearGradient(0, H * 0.72, 0, H);
  bottom.addColorStop(0, `rgba(${veil},0)`);
  bottom.addColorStop(1, `rgba(${veil},0.55)`);
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H * 0.72, W, H * 0.28);

  // Headline: reduz o corpo até caber em, no máximo, 4 linhas.
  const maxWidth = W - marginX * 2;
  let fontSize = Math.round(base * 0.085);
  let lines: string[] = [];
  for (; fontSize >= Math.round(base * 0.04); fontSize -= 2) {
    ctx.font = `800 ${fontSize}px ${stack}`;
    lines = wrapLines(ctx, input.headline, maxWidth);
    if (lines.length <= 4) break;
  }
  ctx.fillStyle = textColor;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const lineHeight = Math.round(fontSize * 1.15);
  lines.forEach((l, i) => ctx.fillText(l, marginX, marginTop + i * lineHeight));

  // CTA: botão arredondado na cor primária, texto com contraste calculado.
  const cta = input.cta.trim();
  if (cta) {
    const ctaSize = Math.round(base * 0.045);
    ctx.font = `700 ${ctaSize}px ${stack}`;
    const padX = Math.round(ctaSize * 1.1);
    const btnH = Math.round(ctaSize * 2.1);
    const btnW = Math.min(maxWidth, Math.round(ctx.measureText(cta).width + padX * 2));
    const x = marginX;
    const y = H - marginBottom - btnH;
    ctx.fillStyle = input.primaryColor;
    ctx.beginPath();
    ctx.roundRect(x, y, btnW, btnH, btnH / 2);
    ctx.fill();
    ctx.fillStyle = readableOn(input.primaryColor);
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(cta, x + btnW / 2, y + btnH / 2, btnW - padX);
  }

  return { dataUrl: canvas.toDataURL("image/png"), mimeType: "image/png" };
}
