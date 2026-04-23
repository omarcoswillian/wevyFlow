import type { Preset } from "./types";

/**
 * WevyFlow full-page Preset catalog — monolithic templates.
 *
 * Each Preset is a self-contained HTML page. The compose step can pick
 * one as the base and swap copy, or skip them in favor of pure section
 * composition. monolithic: true until the template is split into
 * individual Section files (Phase 2).
 */
export const PRESETS: Preset[] = [
  /* ───────── CAPTURA ───────── */
  {
    id: "captura-premium",
    label: "Captura Premium · Dark Green",
    description: "Página de captura dark com barra de urgência/countdown, hero split (copy + formulário), prova social, depoimentos e garantia. Accent verde vibrante.",
    kind: "captura",
    themes: ["dark", "vibrant"],
    file: "captura-premium.html",
    sectionOutline: ["urgencia", "hero", "social-proof", "depoimentos", "features", "garantia"],
    monolithic: true,
    accent: "#0d9f4c",
    fonts: ["Montserrat"],
  },
  {
    id: "captura-infoprodutor",
    label: "Captura Infoprodutor · Two-tone",
    description: "Captura de leads para infoprodutos. Barra dark de urgência com countdown, hero light com formulário e benefícios, seção de depoimentos e garantia.",
    kind: "captura",
    themes: ["dark", "light", "vibrant"],
    file: "captura-infoprodutor.html",
    sectionOutline: ["urgencia", "hero", "social-proof", "depoimentos", "garantia"],
    monolithic: true,
    accent: "#1DB954",
    fonts: ["Montserrat"],
  },
  {
    id: "captura-comunidade",
    label: "Captura Comunidade · Dark Purple",
    description: "Captura para movimentos e comunidades. Hero dark roxo com formulário, seção de pilares, depoimentos e CTA final. Accent púrpura.",
    kind: "captura",
    themes: ["dark", "vibrant"],
    file: "lp-captura-comunidade.html",
    sectionOutline: ["hero", "features", "depoimentos", "social-proof", "cta-final"],
    monolithic: true,
    accent: "#7c3aed",
    fonts: ["Montserrat"],
  },
  {
    id: "captura-light-premium",
    label: "Captura Light Premium · Verde Sage",
    description: "Captura premium em fundo warm/bege claro. Hero split com formulário à direita, seção de prova social, depoimentos e garantia. Visual sofisticado.",
    kind: "captura",
    themes: ["light", "minimal", "bege"],
    file: "lp-captura-light-premium.html",
    sectionOutline: ["hero", "social-proof", "depoimentos", "features", "garantia"],
    monolithic: true,
    accent: "#1a8d5f",
    fonts: ["Montserrat"],
  },
  {
    id: "captura-dark-premium",
    label: "Captura Dark Premium · Gold",
    description: "Captura premium dark com accent dourado. Hero split com formulário, prova social, depoimentos e garantia. Vibe luxury/high-ticket.",
    kind: "captura",
    themes: ["dark", "luxury"],
    file: "lp-captura-dark-premium.html",
    sectionOutline: ["hero", "social-proof", "depoimentos", "features", "garantia"],
    monolithic: true,
    accent: "#c8a832",
    fonts: ["Montserrat"],
  },

  /* ───────── VENDAS ───────── */
  {
    id: "lp-vendas",
    label: "LP Vendas Completa · Dark Orange",
    description: "Página de vendas completa: hero com stats, para quem é, depoimentos, oferta com stack de valor, bônus, garantia, FAQ e CTA final. Dark com accent laranja.",
    kind: "vendas",
    themes: ["dark", "vibrant"],
    file: "lp-vendas-completa.html",
    sectionOutline: ["hero", "para-quem", "depoimentos", "features", "oferta", "bonus", "garantia", "faq", "cta-final"],
    monolithic: true,
    accent: "#ff5c00",
    fonts: ["Montserrat"],
  },
  {
    id: "lp-vendas-spe",
    label: "LP Vendas SPE · VSL / Stories",
    description: "Página de vendas com VSL (player de vídeo), resultados em cards de conversa, método em passos, depoimentos, oferta, bônus, garantia e FAQ. Light com gradient laranja→pink.",
    kind: "vendas",
    themes: ["light", "vibrant"],
    file: "lp-vendas-spe.html",
    sectionOutline: ["hero", "steps", "depoimentos", "oferta", "bonus", "garantia", "faq"],
    monolithic: true,
    accent: "#f97316",
    fonts: ["Montserrat"],
  },
  {
    id: "vendas-black-boutique",
    label: "LP Vendas Black Boutique · Mauve",
    description: "Página de vendas estilo boutique com paleta mauve/roxo-acinzentado. Barra de urgência elegante, VSL, depoimentos, oferta, bônus, garantia, FAQ e CTA final.",
    kind: "vendas",
    themes: ["boutique", "minimal"],
    file: "lp-vendas-black-boutique.html",
    sectionOutline: ["urgencia", "hero", "features", "depoimentos", "oferta", "bonus", "garantia", "faq", "cta-final"],
    monolithic: true,
    accent: "#6e4d75",
    fonts: ["Montserrat"],
  },
  {
    id: "vendas-white-boutique",
    label: "LP Vendas White Boutique · Mauve Light",
    description: "Versão white do Boutique. Mesma estrutura da versão black mas com fundo acinzentado-claro. Paleta mauve warm, ideal para produtos femininos ou lifestyle premium.",
    kind: "vendas",
    themes: ["boutique", "light", "minimal"],
    file: "lp-vendas-white-boutique.html",
    sectionOutline: ["urgencia", "hero", "features", "depoimentos", "oferta", "bonus", "garantia", "faq", "cta-final"],
    monolithic: true,
    accent: "#6e4d75",
    fonts: ["Montserrat"],
  },
  {
    id: "metodo-spe",
    label: "Método SPE · Dark Orange Completo",
    description: "LP de vendas tipo método passo-a-passo. Hero dark, VSL, passos do método, depoimentos, oferta com bônus, garantia e FAQ. Orange vibrante.",
    kind: "vendas",
    themes: ["dark", "vibrant"],
    file: "metodo-spe.html",
    sectionOutline: ["hero", "steps", "depoimentos", "oferta", "bonus", "garantia", "faq"],
    monolithic: true,
    accent: "#ff5c00",
    fonts: ["Montserrat"],
  },

  /* ───────── VENDAS · INSPIRED ───────── */
  {
    id: "lp-vendas-stories10x-dark",
    label: "LP Vendas · Stories 10x Dark Pink",
    description: "Página de vendas dark roxa/pink estilo Stories 10x. Hero com badge + grade de 4 benefícios, VSL, CTA pink com glow, bonus strip horizontal, para-quem 2×3, social proof com 4 vídeos de influencers e CTA final. Accent rosa/pink vibrante.",
    kind: "vendas",
    themes: ["dark", "vibrant"],
    file: "lp-vendas-stories10x-dark.html",
    sectionOutline: ["hero", "features", "cta-final", "para-quem", "depoimentos", "cta-final"],
    monolithic: true,
    accent: "#E8176A",
    fonts: ["Montserrat", "DM Sans"],
  },
  {
    id: "lp-vendas-spe-light",
    label: "LP Vendas SPE · Light Personal Brand",
    description: "Página de vendas light estilo personal-brand/stories. Hero branco com headline colorida (pink+orange+purple), VSL vermelho, before/after com X e check, galeria de screenshots de resultados, carrossel dark de depoimentos em texto e seção de hook com mensagens de DM. Ideal para cursos de criação de conteúdo e stories.",
    kind: "vendas",
    themes: ["light", "minimal", "vibrant"],
    file: "lp-vendas-spe-light.html",
    sectionOutline: ["hero", "features", "para-quem", "social-proof", "depoimentos", "cta-final"],
    monolithic: true,
    accent: "#E8176A",
    fonts: ["Montserrat", "DM Sans"],
  },
  {
    id: "lp-vendas-novomercado-dark",
    label: "LP Vendas · Novo Mercado Dark Navy",
    description: "Página de vendas dark navy/roxo estilo plataforma SaaS/infoprodutor premium. Nav sticky com CTA de borda, hero fullscreen com painéis de UI decorativos, badge de prova social com avatares, headline em 2 linhas com accent pink, subheadline com links coloridos e CTA pill arredondado. Features em 3 cols, números de prova e depoimentos.",
    kind: "vendas",
    themes: ["dark", "tech", "vibrant"],
    file: "lp-vendas-novomercado-dark.html",
    sectionOutline: ["hero", "features", "social-proof", "depoimentos", "cta-final"],
    monolithic: true,
    accent: "#E8176A",
    fonts: ["Montserrat", "DM Sans"],
  },

  /* ───────── WORKSHOP ───────── */
  {
    id: "lp-workshop",
    label: "LP Workshop · Light Blue",
    description: "Página de venda de evento/workshop. Hero com data e lotes, marquee de benefícios, para quem é, agenda em passos, mentor, oferta por lotes, garantia e FAQ. Light blue.",
    kind: "workshop",
    themes: ["light", "minimal"],
    file: "lp-vendas-workshop.html",
    sectionOutline: ["urgencia", "hero", "para-quem", "steps", "mentor", "oferta", "garantia", "faq"],
    monolithic: true,
    accent: "#2563eb",
    fonts: ["Montserrat"],
  },

  /* ───────── SAAS ───────── */
  {
    id: "saas-harmonic",
    label: "SaaS Harmonic · Apple Minimal",
    description: "Landing page SaaS estilo Apple/Harmonic. Nav sticky, hero limpo, logos de clientes, seções Discover/Analyze/Act, depoimentos e pricing. Light + minimal.",
    kind: "saas",
    themes: ["light", "minimal", "tech"],
    file: "lp-saas-harmonic-style.html",
    sectionOutline: ["hero", "social-proof", "features", "steps", "depoimentos", "oferta"],
    monolithic: true,
    accent: "#0071e3",
    fonts: ["Montserrat"],
  },
  {
    id: "saas-agency",
    label: "SaaS Agency Automation · Dark Orange",
    description: "Landing de agência/automação com hero dark, seção de missão, cases de resultado, serviços em grid, depoimentos, CTA de consulta e FAQ. Orange accent.",
    kind: "saas",
    themes: ["dark", "tech"],
    file: "lp-saas-agency-automation.html",
    sectionOutline: ["hero", "social-proof", "features", "steps", "mentor", "depoimentos", "faq"],
    monolithic: true,
    accent: "#e85d2a",
    fonts: ["Montserrat"],
  },

  /* ───────── ECOMMERCE ───────── */
  {
    id: "ecommerce-apple",
    label: "E-commerce · Apple Store Style",
    description: "Loja de acessórios estilo Apple Store. Nav top, sidebar de filtros, grid de produtos com cards limpos. Light minimal com accent azul.",
    kind: "ecommerce",
    themes: ["light", "minimal"],
    file: "lp-ecommerce-apple-style.html",
    sectionOutline: ["hero", "features", "social-proof", "oferta"],
    monolithic: true,
    accent: "#0071e3",
    fonts: ["Montserrat"],
  },
  {
    id: "store-apple",
    label: "Store · Apple Product Page",
    description: "Página de produto estilo Apple com hero split, ícones de categoria, grid de features e seção de compra. Light minimal com accent azul.",
    kind: "ecommerce",
    themes: ["light", "minimal"],
    file: "lp-store-apple-style.html",
    sectionOutline: ["hero", "features", "oferta"],
    monolithic: true,
    accent: "#0071e3",
    fonts: ["Montserrat"],
  },

  /* ───────── QUIZ ───────── */
  {
    id: "quiz-funnel",
    label: "Quiz Funnel · Dark Purple",
    description: "Funil de quiz interativo com 5 perguntas, tela de intro, progresso visual, tela de resultado personalizado e CTA de captura. Dark com accent púrpura.",
    kind: "quiz",
    themes: ["dark", "vibrant"],
    file: "lp-quiz-funnel.html",
    sectionOutline: ["hero", "steps", "social-proof", "cta-final"],
    monolithic: true,
    accent: "#8b5cf6",
    fonts: ["Montserrat"],
  },

  /* ───────── BLOG ───────── */
  {
    id: "blog-premium",
    label: "Blog Premium · Apple Clean",
    description: "Blog/portal de conteúdo estilo Apple. Nav frosted-glass, hero editorial, grid de posts em destaque e lista de artigos. Light minimal com accent azul.",
    kind: "blog",
    themes: ["light", "minimal"],
    file: "lp-blog-premium.html",
    sectionOutline: ["hero", "social-proof", "features"],
    monolithic: true,
    accent: "#0071e3",
    fonts: ["Montserrat"],
  },
];

/** Fast lookup by preset id */
export const PRESETS_BY_ID: Record<string, Preset> = Object.fromEntries(
  PRESETS.map((p) => [p.id, p])
);

/** Presets indexed by kind */
export const PRESETS_BY_KIND = PRESETS.reduce<Record<string, Preset[]>>((acc, p) => {
  (acc[p.kind] ??= []).push(p);
  return acc;
}, {});
