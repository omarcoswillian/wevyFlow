import { readFileSync } from "fs";
import { join } from "path";

const TEMPLATES_DIR = join(process.cwd(), "src/app/lib/ready-templates");

const TEMPLATE_MAP: Record<string, string> = {
  "ready-luana-carolina-ed-001":          "luana-carolina-ed-001.html",
  "ready-luana-carolina-ed-001-obrigado": "luana-carolina-ed-001-obrigado.html",
  // Arsenal de seções (internas, não listadas nos templates)
  "ready-hero-simples":             "sections/hero-simples.html",
  "ready-urgencia":                 "sections/urgencia-countdown.html",
  "ready-para-quem":                "sections/para-quem-e.html",
  "ready-depoimentos":              "sections/depoimentos-grid.html",
  "ready-oferta":                   "sections/oferta-preco.html",
  "ready-faq":                      "sections/faq-accordion.html",
  "ready-hero-captura-luana":       "sections/hero-captura-luana.html",
  "ready-hero-captura-conversao":   "sections/hero-captura-conversao.html",
  "ready-hero-captura-cinematic":   "sections/hero-captura-dark-cinematic.html",
  "ready-hero-vendas-saas":         "sections/hero-vendas-saas.html",
  "ready-hero-vendas-bege":         "sections/hero-vendas-split-bege.html",
  "ready-hero-vendas-portfolio":    "sections/hero-vendas-portfolio-dark.html",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || !TEMPLATE_MAP[id]) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  try {
    const html = readFileSync(join(TEMPLATES_DIR, TEMPLATE_MAP[id]), "utf-8");
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return Response.json({ error: "Template file not found" }, { status: 404 });
  }
}
