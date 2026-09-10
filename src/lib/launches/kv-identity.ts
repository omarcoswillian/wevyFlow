import type { BrandColor, BrandFont } from "@/app/lib/types-kit";
import type { LogoVariationDirection } from "@/app/api/generate-logo/shared";
import { GOOGLE_FONTS, findFont, type GoogleFont } from "@/app/lib/editor/google-fonts";

/** Rodada B do redesenho de KV: resolve a identidade estruturada (paleta +
 * tipografia) de um candidato a partir do logo JÁ gerado — sem nenhuma
 * chamada de IA nova, sem custo de crédito (spec do Codex, gpt-5.6-sol,
 * sessão 2026-09-09, seção 3.2). identity_spec é o dado de verdade; as
 * cartelas visuais (renderPaletteCard abaixo) são derivadas dele, nunca o
 * contrário — nunca ler HEX ou nome de fonte de dentro de uma imagem gerada
 * por IA. */

const WHITE = "#FFFFFF";
const BLACK = "#0A0A0A";
const FALLBACK_PRIMARY = "#A78BFA";

const HEX_RE = /^#[0-9a-f]{6}$/i;

function isValidHex(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Relative luminance (sRGB, simplified — good enough for a contrast pick,
 * not for color-accurate work) — used to pick a readable label color and to
 * decide whether a sampled pixel is just background (near-white/near-black),
 * not to fabricate a "discovered" brand color out of the canvas itself. */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isLight(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return luminance(r, g, b) > 150;
}

function isNearNeutral(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const denom = 255 - Math.abs(2 * l - 255);
  const saturation = denom === 0 ? 0 : (max - min) / denom;
  // Very light, very dark, or very low-saturation (gray) pixels are treated
  // as background/canvas, not brand ink — the logo prompts always render on
  // a near-white or near-black canvas depending on `variant` (see
  // buildLogoPrompt in generate-logo/shared.ts).
  return l > 235 || l < 25 || saturation < 0.12;
}

/** Samples the generated logo's actual pixels for its dominant non-neutral
 * color ("what the model actually drew"), never trusting a blind
 * most-frequent-color histogram — background alone would usually win that.
 * Returns null for a genuinely monochromatic logo (all pixels near-white/
 * near-black/gray) instead of fabricating a color that was never there. */
async function extractLogoInkColor(logoBuffer: Buffer): Promise<string | null> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(logoBuffer)
    .resize(48, 48, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const counts = new Map<string, { count: number; r: number; g: number; b: number }>();
  const channels = info.channels;
  for (let i = 0; i + channels <= data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = channels >= 4 ? data[i + 3] : 255;
    if (a < 200) continue;
    if (isNearNeutral(r, g, b)) continue;
    // Quantize to reduce anti-aliasing noise into a handful of real buckets.
    const key = `${Math.round(r / 16)},${Math.round(g / 16)},${Math.round(b / 16)}`;
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { count: 1, r, g, b });
  }

  if (counts.size === 0) return null;
  const [best] = [...counts.values()].sort((a, b) => b.count - a.count);
  return rgbToHex(best.r, best.g, best.b);
}

export interface ResolveBrandPaletteOptions {
  primaryColor?: string;
  secondaryColor?: string;
  /** Quando o logo foi gerado com imagens de referência anexadas,
   * buildLogoPrompt já tornou a cor do briefing um mero fallback — a
   * referência manda no visual de verdade (achado do dono: anexou uma
   * referência dourada/creme e queria essa estética, não a cor padrão do
   * wizard). Se essa troca funcionou (o logo saiu com uma tinta bem
   * diferente da cor prevista), a paleta/textura têm que seguir o que o
   * logo REALMENTE ficou, não o que a gente pedia antes de ver o
   * resultado — senão a textura sai na cor errada mesmo com o logo certo
   * (bug real encontrado testando: logo dourado, textura azul, porque a
   * paleta ainda chamava o azul do briefing de "primária"). */
  hasReferenceImages?: boolean;
}

/** Priority order (spec do Codex, seção 3.2, ajustado por um achado desta
 * sessão):
 *   1. Sem referência anexada: restrição explícita do briefing
 *      (primary/secondaryColor) — o usuário escolheu essa cor de propósito.
 *   2. Com referência anexada: a tinta extraída do logo de verdade gerado
 *      vira a primária (é o que a referência realmente produziu); a cor do
 *      briefing, se diferente, vira um accent documentado — nunca some,
 *      só deixa de fingir que é "a" cor da marca quando não é mais.
 *   3. Neutros determinísticos (branco/preto) pra completar usos de UI.
 * Nunca finge ter "descoberto" uma cor que não estava lá — um logo
 * monocromático simplesmente não ganha uma entrada "accent". */
export async function resolveBrandPalette(logoBuffer: Buffer, opts: ResolveBrandPaletteOptions): Promise<BrandColor[]> {
  const extractedHex = await extractLogoInkColor(logoBuffer).catch(() => null);
  const briefingPrimary = isValidHex(opts.primaryColor) ? opts.primaryColor : null;

  let primary: string;
  let displacedBriefingColor: string | null = null;
  if (opts.hasReferenceImages && extractedHex) {
    primary = extractedHex;
    displacedBriefingColor = briefingPrimary && briefingPrimary.toLowerCase() !== extractedHex.toLowerCase() ? briefingPrimary : null;
  } else {
    primary = briefingPrimary ?? extractedHex ?? FALLBACK_PRIMARY;
  }

  const colors: BrandColor[] = [{ name: "Primária", hex: primary, usage: "primary" }];

  // secondaryColor vem do lançamento (launch.brandInfo), não da referência
  // visual desta KV — quando a referência já mandou na primária, um
  // secundário genérico e não relacionado só teria a mesma chance de
  // destoar que a cor de briefing original já teve (mesmo raciocínio do
  // displacedBriefingColor acima). Sem uma segunda cor extraída de verdade
  // da referência (fora do escopo desta rodada), a opção mais honesta é
  // simplesmente não afirmar um secundário nesse caso, em vez de herdar um
  // que não tem nada a ver.
  if (!opts.hasReferenceImages && isValidHex(opts.secondaryColor) && opts.secondaryColor.toLowerCase() !== primary.toLowerCase()) {
    colors.push({ name: "Secundária", hex: opts.secondaryColor, usage: "secondary" });
  }

  if (displacedBriefingColor) {
    colors.push({ name: "Cor prevista no briefing", hex: displacedBriefingColor, usage: "accent" });
  } else if (!opts.hasReferenceImages && extractedHex && extractedHex.toLowerCase() !== primary.toLowerCase()) {
    colors.push({ name: "Tinta do logo", hex: extractedHex, usage: "accent" });
  }

  colors.push({ name: "Branco", hex: WHITE, usage: "light" });
  colors.push({ name: "Preto", hex: BLACK, usage: "dark" });

  return colors;
}

/** Combinação curada de fontes por direção criativa — a mesma lógica de
 * "direção" já usada pros prompts de imagem (VARIATION_DIRECTION_DESCRIPTORS
 * em generate-logo/shared.ts), aplicada agora à tipografia da identidade.
 * Reaproveita o catálogo de fontes já usado pelo editor de páginas
 * (src/app/lib/editor/google-fonts.ts) — mesma fonte de verdade, sem duplicar
 * um segundo catálogo. */
const DIRECTION_FONT_PAIRINGS: Record<LogoVariationDirection, { display: string; body: string }> = {
  tipografica: { display: "Playfair Display", body: "Lora" },
  geometrica: { display: "Space Grotesk", body: "Inter" },
  minimalista: { display: "Manrope", body: "Work Sans" },
  expressiva: { display: "Syne", body: "Plus Jakarta Sans" },
};

function toBrandFont(font: GoogleFont, usage: "display" | "body"): BrandFont {
  const preferred = usage === "display" ? font.weights.filter((w) => w >= 600) : font.weights.filter((w) => w <= 500);
  const weights = preferred.length > 0 ? preferred : font.weights;
  return {
    name: font.family,
    googleFont: `${font.family.replace(/ /g, "+")}:wght@${weights.join(";")}`,
    usage,
  };
}

export interface ResolveBrandTypographyOptions {
  /** launch.brandInfo.fontChoice — an explicit choice from the briefing wins
   * over the curated body-font default when it names a font in the catalog
   * (a briefing constraint outranks a generic per-direction default, same
   * priority rule as the palette). */
  fontChoice?: string;
}

export function resolveBrandTypography(direction: LogoVariationDirection, opts: ResolveBrandTypographyOptions): BrandFont[] {
  const pairing = DIRECTION_FONT_PAIRINGS[direction];
  const displayFont = findFont(pairing.display) ?? GOOGLE_FONTS[0];
  const curatedBody = findFont(pairing.body) ?? GOOGLE_FONTS[0];
  const requestedBody = opts.fontChoice ? findFont(opts.fontChoice) : undefined;
  const bodyFont = requestedBody ?? curatedBody;

  return [toBrandFont(displayFont, "display"), toBrandFont(bodyFont, "body")];
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Renders the palette as flat color bands with HEX labels — same layout as
 * the reference brand books (public/library-seed/kv-examples/.../02-paleta.png).
 * Pure geometry + text, no custom font loading needed (the label just needs
 * to be legible, it isn't the brand's own typography) — safe to rasterize
 * with librsvg's default font fallback via sharp. */
export async function renderPaletteCard(colors: BrandColor[]): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const width = 960;
  const height = 540;
  const bandHeight = height / Math.max(1, colors.length);

  const bands = colors
    .map((c, i) => {
      const y = i * bandHeight;
      const labelColor = isLight(c.hex) ? "#111111" : "#FFFFFF";
      return `
        <rect x="0" y="${y.toFixed(2)}" width="${width}" height="${bandHeight.toFixed(2)}" fill="${c.hex}" />
        <text x="40" y="${(y + bandHeight / 2 + 7).toFixed(2)}" font-family="Helvetica, Arial, sans-serif" font-size="24" letter-spacing="1" fill="${labelColor}">${escapeXml(c.hex.toUpperCase())}</text>
      `;
    })
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bands}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/* ── Cartela de tipografia (Rodada D) ─────────────────────────────────────
 * A única peça composta que genuinamente precisa da fonte REAL desenhada
 * (a cartela de paleta acima só rotula hex codes — qualquer fonte serve).
 * librsvg (usado por sharp) não carrega @font-face de forma confiável em
 * todo ambiente de servidor, então esta peça usa @napi-rs/canvas (registro
 * de fonte de verdade via GlobalFonts) em vez de SVG+sharp.
 *
 * As fontes são buscadas do Google Fonts em tempo de execução (rede), com
 * cache em memória do processo — mesmo catálogo pequeno e curado
 * (DIRECTION_FONT_PAIRINGS) se repete entre candidatos/lotes, então a
 * segunda geração pra frente nem toca a rede. Falha de rede/parse nunca
 * derruba o candidato: retorna null e o chamador (kv-worker.ts) só pula
 * essa peça — mesmo contrato "melhor-esforço" da cartela de paleta. */

const GOOGLE_FONT_FETCH_TIMEOUT_MS = 8_000;
// UA de um navegador comum é o que faz o endpoint legado (`css`, não
// `css2`) devolver uma instância ESTÁTICA em WOFF2 (não a fonte variável
// que o `css2` serve por padrão) — @napi-rs/canvas carrega WOFF2 de boa,
// mas o registro de uma fonte variável sem os eixos certos rende só tofu
// (achado verificado nesta sessão: tentei o UA clássico "IE6" que os
// tutoriais antigos usam pra pegar TTF puro, mas o Google hoje devolve um
// .eot pra esse UA — formato que nem é um sfnt válido).
const FONT_FETCH_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const fontBufferCache = new Map<string, Promise<Buffer | null>>();

async function fetchGoogleFontBuffer(family: string, weight: number): Promise<Buffer | null> {
  const cacheKey = `${family}:${weight}`;
  const cached = fontBufferCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async (): Promise<Buffer | null> => {
    try {
      const familyParam = family.replace(/ /g, "+");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GOOGLE_FONT_FETCH_TIMEOUT_MS);
      let cssRes: Response;
      try {
        cssRes = await fetch(`https://fonts.googleapis.com/css?family=${familyParam}:${weight}`, {
          headers: { "User-Agent": FONT_FETCH_USER_AGENT },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!cssRes.ok) return null;
      const css = await cssRes.text();
      // Prioriza o bloco "/* latin */" — os outros subconjuntos (cyrillic,
      // vietnamese, greek...) não têm glifos latinos, e pegar o primeiro
      // url() do CSS às cegas pegava um desses por acaso (achado verificado
      // nesta sessão: renderizava só tofu porque a fonte cyrillic não tem
      // as letras de "Método Forza").
      const latinMatch = css.match(/\/\*\s*latin\s*\*\/[^{]*\{[^}]*url\(([^)]+)\)/) ?? css.match(/url\(([^)]+)\)/);
      if (!latinMatch) return null;

      const fontRes = await fetch(latinMatch[1]);
      if (!fontRes.ok) return null;
      return Buffer.from(await fontRes.arrayBuffer());
    } catch {
      return null;
    }
  })();

  fontBufferCache.set(cacheKey, promise);
  return promise;
}

/** Pega o peso mais pesado (display) ou mais leve (corpo) do catálogo local
 * pra buscar como instância estática — o catálogo já filtra os pesos
 * "de display" vs "de corpo" em toBrandFont, mas essa função recebe só o
 * BrandFont já resolvido (sem os pesos), então reconsulta o catálogo pelo
 * nome pra saber que peso baixar de verdade. */
function resolveSpecimenWeight(fontName: string, usage: "display" | "body"): number {
  const catalog = findFont(fontName);
  const weights = catalog?.weights ?? [400];
  return usage === "display" ? weights[weights.length - 1] : weights[0];
}

/** Renderiza a especificação de tipografia como uma cartela real (a fonte
 * de display grande, a de corpo menor, como no exemplo 03-tipografia.png).
 * Retorna null (nunca lança) se alguma das duas fontes não puder ser
 * baixada/registrada — o chamador simplesmente não persiste essa peça
 * nessa rodada, sem derrubar o candidato. */
export async function renderTypographyCard(fonts: BrandFont[]): Promise<Buffer | null> {
  const display = fonts.find((f) => f.usage === "display");
  const body = fonts.find((f) => f.usage === "body");
  if (!display || !body) return null;

  const [displayBuf, bodyBuf] = await Promise.all([
    fetchGoogleFontBuffer(display.name, resolveSpecimenWeight(display.name, "display")),
    fetchGoogleFontBuffer(body.name, resolveSpecimenWeight(body.name, "body")),
  ]);
  if (!displayBuf || !bodyBuf) return null;

  const { GlobalFonts, createCanvas } = await import("@napi-rs/canvas");
  // Nomes já são as famílias reais do catálogo (ex: "Playfair Display") —
  // registrar de novo pra um candidato que já usou a mesma fonte é
  // idempotente (GlobalFonts é um registro global do processo, não por
  // chamada), então não precisa de um alias sintético por candidato.
  if (!GlobalFonts.has(display.name)) GlobalFonts.register(displayBuf, display.name);
  if (!GlobalFonts.has(body.name)) GlobalFonts.register(bodyBuf, body.name);

  const width = 960;
  const height = 540;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FAFAF8";
  ctx.fillRect(0, 0, width, height);

  // Rótulos usam a própria fonte de corpo (já registrada de verdade acima)
  // em vez do genérico "sans-serif" — o alias genérico não resolveu pra um
  // font real com acentuação latina completa neste ambiente e renderizava
  // tofu em "TÍTULOS" (achado verificado nesta sessão).
  ctx.fillStyle = "#8A8A85";
  ctx.font = `20px "${body.name}"`;
  ctx.fillText("TÍTULOS", 60, 90);
  ctx.fillStyle = "#111111";
  ctx.font = `48px "${display.name}"`;
  ctx.fillText(display.name, 60, 160);
  ctx.font = `32px "${display.name}"`;
  ctx.fillText("ABCDEFGHIJKLM abcdefghijklm 0123456789", 60, 215);

  ctx.strokeStyle = "#DDDDD8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 280);
  ctx.lineTo(width - 60, 280);
  ctx.stroke();

  ctx.fillStyle = "#8A8A85";
  ctx.font = `20px "${body.name}"`;
  ctx.fillText("TEXTO", 60, 340);
  ctx.fillStyle = "#111111";
  ctx.font = `32px "${body.name}"`;
  ctx.fillText(body.name, 60, 400);
  ctx.font = `22px "${body.name}"`;
  ctx.fillText("ABCDEFGHIJKLM abcdefghijklm 0123456789", 60, 445);

  return canvas.toBuffer("image/png");
}

function pickApplicationBackground(colors: BrandColor[]): string {
  return (
    colors.find((c) => c.usage === "accent")?.hex
    ?? colors.find((c) => c.usage === "secondary")?.hex
    ?? colors.find((c) => c.usage === "primary")?.hex
    ?? FALLBACK_PRIMARY
  );
}

/** "Logo — aplicação" (Rodada D, sem IA): o logo já gerado (que já vem com
 * seu próprio fundo — não é um recorte transparente) composto sobre um
 * cartão de uma cor de destaque da paleta, mostrando a marca "em uso" numa
 * superfície diferente da que ele nasceu. */
export async function renderLogoApplicationCard(logoBuffer: Buffer, colors: BrandColor[]): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const width = 960;
  const height = 960;
  const bg = pickApplicationBackground(colors);

  const logoMeta = await sharp(logoBuffer).metadata();
  const targetWidth = Math.round(width * 0.62);
  const sourceWidth = logoMeta.width ?? targetWidth;
  const sourceHeight = logoMeta.height ?? targetWidth;
  const targetHeight = Math.round((sourceHeight / sourceWidth) * targetWidth);
  const resizedLogo = await sharp(logoBuffer).resize(targetWidth, targetHeight, { fit: "inside" }).toBuffer();
  const resizedMeta = await sharp(resizedLogo).metadata();
  const left = Math.round((width - (resizedMeta.width ?? targetWidth)) / 2);
  const top = Math.round((height - (resizedMeta.height ?? targetHeight)) / 2);

  return sharp({ create: { width, height, channels: 3, background: bg } })
    .composite([{ input: resizedLogo, left, top }])
    .png()
    .toBuffer();
}

/** "Capa" — a última peça de um candidato, composta só depois que logo e
 * textura existem. Layout em duas colunas (o mesmo princípio de um brand
 * book de agência de verdade: painel de texto + painel de imagem, nunca um
 * logo sozinho flutuando no centro de um fundo):
 *   — Coluna de foto (quando o dono já subiu applicationPhotos): a foto
 *     real ocupa a maior parte do quadro — é o elemento mais forte da capa,
 *     não decoração atrás do logo. Sem foto, cai pra textura (a peça de IA)
 *     preenchendo esse espaço, nunca um fundo liso vazio.
 *   — Painel de texto: nome da marca grande na fonte de display de verdade
 *     (não o logo rasterizado de novo), uma régua de destaque na cor
 *     extraída da paleta, subtítulo (nicho) na fonte de corpo, e o logo
 *     pequeno como assinatura no rodapé — papel de marca d'água, não
 *     protagonista.
 * Usa @napi-rs/canvas: compõe duas imagens (foto/textura + logo) e texto
 * com fonte de verdade na mesma superfície. Melhor-esforço — se as fontes
 * não carregarem, cai pro logo como protagonista (versão antiga, mas em
 * proporção menor) em vez de falhar a peça inteira. */
export async function renderCoverCard(
  logoBuffer: Buffer,
  colors: BrandColor[],
  fonts: BrandFont[],
  productName: string,
  subtitle: string | undefined,
  textureBuffer?: Buffer | null,
  photoBuffer?: Buffer | null
): Promise<Buffer> {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const width = 1600;
  const height = 1000;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const primary = colors.find((c) => c.usage === "primary")?.hex ?? FALLBACK_PRIMARY;
  // Painel de texto usa um NEUTRO da paleta (nunca a cor forte/de destaque
  // aqui — pickApplicationBackground(accent??secondary??primary) é pra
  // cartão de aplicação, não pra fundo de leitura de texto). Sem isso, o
  // painel caía no FALLBACK_PRIMARY roxo sempre que só existiam neutros no
  // filtro (achado verificado nesta sessão: capa saiu roxa mesmo com um
  // logo dourado, porque light/dark não são "accent/secondary/primary").
  const panelBg = colors.find((c) => c.usage === "light")?.hex ?? colors.find((c) => c.usage === "dark")?.hex ?? "#FFFFFF";
  const panelText = isLight(panelBg) ? "#111111" : "#FFFFFF";

  const display = fonts.find((f) => f.usage === "display");
  const body = fonts.find((f) => f.usage === "body");
  const [displayBuf, bodyBuf] = display && body
    ? await Promise.all([
        fetchGoogleFontBuffer(display.name, resolveSpecimenWeight(display.name, "display")),
        fetchGoogleFontBuffer(body.name, resolveSpecimenWeight(body.name, "body")),
      ])
    : [null, null];
  const hasCustomFonts = !!(display && body && displayBuf && bodyBuf);
  if (hasCustomFonts) {
    const { GlobalFonts } = await import("@napi-rs/canvas");
    if (!GlobalFonts.has(display!.name)) GlobalFonts.register(displayBuf!, display!.name);
    if (!GlobalFonts.has(body!.name)) GlobalFonts.register(bodyBuf!, body!.name);
  }
  const displayFontName = hasCustomFonts ? display!.name : "serif";
  const bodyFontName = hasCustomFonts ? body!.name : "sans-serif";

  const panelWidth = Math.round(width * 0.4);

  // Coluna de imagem: foto de verdade > textura > cor lisa da paleta, nessa
  // ordem de preferência — nunca deixa o lado forte do layout vazio.
  const imageBuffer = photoBuffer ?? textureBuffer;
  if (imageBuffer) {
    const image = await loadImage(imageBuffer);
    drawImageCover(ctx, image, panelWidth, 0, width - panelWidth, height);
  } else {
    ctx.fillStyle = primary;
    ctx.fillRect(panelWidth, 0, width - panelWidth, height);
  }

  // Painel de texto
  ctx.fillStyle = panelBg;
  ctx.fillRect(0, 0, panelWidth, height);

  const marginX = 72;
  ctx.fillStyle = panelText;
  ctx.font = `${hasCustomFonts ? 72 : 64}px "${displayFontName}"`;
  const nameLines = wrapTextLines(ctx, productName, panelWidth - marginX * 2);
  let y = height * 0.38;
  for (const line of nameLines) {
    ctx.fillText(line, marginX, y);
    y += hasCustomFonts ? 82 : 74;
  }

  ctx.strokeStyle = primary;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(marginX, y + 8);
  ctx.lineTo(marginX + 96, y + 8);
  ctx.stroke();

  if (subtitle) {
    ctx.font = `24px "${bodyFontName}"`;
    ctx.globalAlpha = 0.7;
    wrapText(ctx, subtitle.toUpperCase(), marginX, y + 52, panelWidth - marginX * 2, 32);
    ctx.globalAlpha = 1;
  }

  // Logo como assinatura no rodapé do painel — pequeno, não é mais o
  // protagonista do layout.
  const logo = await loadImage(logoBuffer);
  const logoTargetWidth = panelWidth - marginX * 2;
  const logoTargetHeight = (logo.height / logo.width) * logoTargetWidth;
  const maxLogoHeight = 110;
  const logoScale = logoTargetHeight > maxLogoHeight ? maxLogoHeight / logoTargetHeight : 1;
  const finalLogoWidth = logoTargetWidth * logoScale;
  const finalLogoHeight = logoTargetHeight * logoScale;
  ctx.drawImage(logo, marginX, height - finalLogoHeight - 64, finalLogoWidth, finalLogoHeight);

  return canvas.toBuffer("image/png");
}

/** Quebra texto em linhas (sem limite de linhas) — usado pro nome da marca
 * na Capa, que precisa mostrar a frase inteira, diferente de wrapText (que
 * trunca em maxLines pra caber num espaço de legenda). */
function wrapTextLines(ctx: import("@napi-rs/canvas").SKRSContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Decodifica uma referenceImages/applicationPhotos data URL (o formato que
 * o briefing sempre guarda essas imagens) de volta pra Buffer. Retorna null
 * em vez de lançar — um valor corrompido/de formato inesperado não deve
 * derrubar o candidato, só faz essa peça ficar de fora (mesmo contrato
 * melhor-esforço das outras peças compostas). */
export function dataUrlToBuffer(dataUrl: string): Buffer | null {
  const match = /^data:image\/(?:png|jpeg|webp);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}

/** Desenha `image` preenchendo todo o retângulo (x,y,width,height), cortando
 * o excesso — equivalente a CSS `object-fit: cover`. Fotos reais chegam em
 * proporções arbitrárias; sem isso, uma foto retrato num mockup paisagem
 * (ou vice-versa) apareceria distorcida ou com faixas vazias. */
function drawImageCover(
  ctx: import("@napi-rs/canvas").SKRSContext2D,
  image: import("@napi-rs/canvas").Image,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  const imageRatio = image.width / image.height;
  const boxRatio = width / height;
  let sx: number, sy: number, sw: number, sh: number;
  if (imageRatio > boxRatio) {
    sh = image.height;
    sw = sh * boxRatio;
    sx = (image.width - sw) / 2;
    sy = 0;
  } else {
    sw = image.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (image.height - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height);
}

function wrapText(
  ctx: import("@napi-rs/canvas").SKRSContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2
): void {
  const words = text.split(/\s+/);
  let line = "";
  let lines = 0;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines += 1;
      if (lines >= maxLines) return;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, y + lines * lineHeight);
}

// (renderApplicationMockup por composição de código foi removida — o mockup
// de aplicação agora é gerado pelo Nano Banana de verdade, com a foto real
// e as referências como entrada; ver generateMockupCandidate em
// generate-logo/shared.ts. Pedido do dono depois de ver o resultado da
// versão renderizada: "quero que o nano banana mude a pessoa e mude o
// título... quero que replique a referência, o que está sendo feito está
// muito longe".)
