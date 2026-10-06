import type { BrandInfo, EmailItem } from "./types-kit";

/* Email visual determinístico: converte o texto de um EmailItem num HTML
 * responsivo (tabelas + estilos inline, o que Gmail/Outlook aceitam) com as
 * cores, o estilo e o logo da marca. Não usa IA: o texto fica exatamente
 * como foi aprovado. O link do botão sai como {{link}} pra o usuário trocar
 * pelo da plataforma de email. */

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const SAFE_HEX = /^#[0-9a-fA-F]{6}$/;

/** Fontes de email: webfont não é confiável nos clientes, então cada escolha
 * da marca vira uma pilha de fontes de sistema com a mesma personalidade. */
const FONT_STACK: Record<string, string> = {
  playfair: "Georgia, 'Times New Roman', serif",
  "space-grotesk": "'Trebuchet MS', Verdana, Arial, sans-serif",
  montserrat: "Verdana, Geneva, Arial, sans-serif",
  poppins: "Verdana, Geneva, Arial, sans-serif",
  sora: "'Segoe UI', Helvetica, Arial, sans-serif",
  inter: "'Segoe UI', Helvetica, Arial, sans-serif",
};

function readableOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#111111" : "#ffffff";
}

export function renderEmailHtml(email: EmailItem, brand: BrandInfo, opts: { ctaIndex?: 0 | 1 } = {}): string {
  const primary = SAFE_HEX.test(brand.primaryColor) ? brand.primaryColor : "#6d28d9";
  const light = brand.stylePreset === "light-clean";
  const page = light ? "#f2f2f5" : "#0c0c10";
  const card = light ? "#ffffff" : "#17171d";
  const text = light ? "#1c1c22" : "#e8e8ee";
  const muted = light ? "#6b6b76" : "#9a9aa6";
  const font = FONT_STACK[brand.fontChoice] ?? FONT_STACK.sora;
  const cta = (opts.ctaIndex === 1 ? email.cta_b : undefined) ?? email.cta;
  const logo = brand.logoUrl && /^https?:\/\//.test(brand.logoUrl) ? brand.logoUrl : "";

  const paragraphs = email.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:${text};">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 24px;"><tr><td style="border-radius:999px;background:${primary};"><a href="{{link}}" style="display:inline-block;padding:15px 30px;font-size:16px;font-weight:700;color:${readableOn(primary)};text-decoration:none;border-radius:999px;">${escapeHtml(cta)}</a></td></tr></table>`
    : "";

  const ps = email.ps
    ? `<p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:${muted};font-style:italic;">${escapeHtml(email.ps)}</p>`
    : "";

  const header = logo
    ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(brand.productName)}" style="display:block;max-height:44px;max-width:200px;margin:0 0 28px;">`
    : `<div style="margin:0 0 28px;font-size:18px;font-weight:800;color:${primary};letter-spacing:-0.01em;">${escapeHtml(brand.productName)}</div>`;

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(email.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(email.preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${page};">
<tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${card};border-radius:16px;font-family:${font};">
<tr><td style="padding:36px 32px 32px;">
${header}${paragraphs}${button}${ps}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
