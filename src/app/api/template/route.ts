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
  "ready-captura-infoprodutor": "captura-infoprodutor.html",
  // Arsenal de Heroes
  "ready-hero-captura-luana": "sections/hero-captura-luana.html",
  "ready-hero-captura-conversao": "sections/hero-captura-conversao.html",
  "ready-hero-captura-cinematic": "sections/hero-captura-dark-cinematic.html",
  "ready-hero-vendas-saas": "sections/hero-vendas-saas.html",
  "ready-hero-vendas-bege": "sections/hero-vendas-split-bege.html",
  "ready-hero-vendas-portfolio": "sections/hero-vendas-portfolio-dark.html",
  "ready-lp-vendas-spe": "lp-vendas-spe.html",
  "ready-ecommerce-apple": "lp-ecommerce-apple-style.html",
  "ready-store-apple": "lp-store-apple-style.html",
  "ready-lp-workshop": "lp-vendas-workshop.html",
  "ready-saas-harmonic": "lp-saas-harmonic-style.html",
  "ready-saas-agency": "lp-saas-agency-automation.html",
  "ready-captura-comunidade": "lp-captura-comunidade.html",
  "ready-blog-premium": "lp-blog-premium.html",
  "ready-captura-light": "lp-captura-light-premium.html",
  "ready-captura-dark": "lp-captura-dark-premium.html",
  "ready-quiz-funnel": "lp-quiz-funnel.html",
  "ready-vendas-black-boutique": "lp-vendas-black-boutique.html",
  "ready-vendas-white-boutique": "lp-vendas-white-boutique.html",
  // Replicas inspiradas em referências reais
  "ready-stories10x-dark": "lp-vendas-stories10x-dark.html",
  "ready-spe-light": "lp-vendas-spe-light.html",
  "ready-novomercado-dark": "lp-vendas-novomercado-dark.html",
  // Evento / Workshop
  "evento-presencial-dark": "evento-presencial-dark.html",
  // Método RMX
  "ready-metodo-rmx": "lp-vendas-metodo-rmx.html",
  "ready-metodo-rmx-light": "lp-vendas-metodo-rmx-light.html",
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
