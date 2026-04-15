import { readFileSync } from "fs";
import { join } from "path";

const TEMPLATES_DIR = join(process.cwd(), "src/app/lib/ready-templates");

const TEMPLATE_MAP: Record<string, string> = {
  "ready-captura-premium": "captura-premium.html",
  "ready-lp-vendas": "lp-vendas-completa.html",
  "ready-hero-simples": "sections/hero-simples.html",
  "ready-urgencia": "sections/urgencia-countdown.html",
  "ready-para-quem": "sections/para-quem-e.html",
  "ready-depoimentos": "sections/depoimentos-grid.html",
  "ready-oferta": "sections/oferta-preco.html",
  "ready-faq": "sections/faq-accordion.html",
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
