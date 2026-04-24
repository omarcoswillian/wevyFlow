import type { Section } from "./types";

/**
 * WevyFlow atomic Section catalog — Phase 1.
 *
 * These are the building blocks the compose step picks from.
 * Sections with `hasSlots: true` can be personalized via deterministic
 * string substitution on [INSERIR: <slot>] markers. Sections with
 * `hasSlots: false` need a smarter copy-rewrite pass (Claude rewrites
 * the existing copy in place).
 *
 * As Phase 2, we split the full-page Presets into additional atomic
 * sections and add them here, growing the catalog beyond these 12.
 */
export const SECTIONS: Section[] = [
  /* ───────── HEROES ───────── */
  {
    id: "hero-simples",
    label: "Hero Simples · Dark Orange",
    description: "Hero centralizado com badge, headline em Montserrat semi-bold, subheadline, CTA laranja e 3 provas sociais com checks verdes. Dark com accent laranja vibrante.",
    kind: "hero",
    themes: ["dark", "vibrant", "minimal"],
    suits: ["vendas", "captura", "saas"],
    file: "sections/hero-simples.html",
    slots: ["badge texto", "headline principal", "palavra destaque", "subheadline descritiva com beneficio principal", "texto CTA", "prova social 1", "prova social 2", "prova social 3"],
    hasSlots: true,
    fonts: ["Montserrat", "DM Sans"],
    accent: "#FF5C00",
  },
  {
    id: "hero-captura-conversao",
    label: "Hero Captura · Light Conversão",
    description: "Hero em fundo branco com formulário de captura integrado. Layout orientado a conversão, estilo clean corporativo.",
    kind: "hero",
    themes: ["light", "minimal"],
    suits: ["captura"],
    file: "sections/hero-captura-conversao.html",
    slots: [],
    hasSlots: false,
  },
  {
    id: "hero-captura-dark-cinematic",
    label: "Hero Captura · Dark Cinematic",
    description: "Hero dark com gradient + overlay cinematográfico. Alta presença visual, ideal para produtos premium e lançamentos de impacto.",
    kind: "hero",
    themes: ["dark", "cinematic"],
    suits: ["captura", "vendas"],
    file: "sections/hero-captura-dark-cinematic.html",
    slots: [],
    hasSlots: false,
  },
  {
    id: "hero-captura-luana",
    label: "Hero Captura · Light Personal Brand",
    description: "Hero light estilo personal-brand com foto lateral, headline serif/editorial e formulário à direita. Copy padrão: lançamento de mentoria/curso do criador.",
    kind: "hero",
    themes: ["light", "boutique", "minimal"],
    suits: ["captura", "workshop"],
    file: "sections/hero-captura-luana.html",
    slots: [],
    hasSlots: false,
  },
  {
    id: "hero-vendas-portfolio-dark",
    label: "Hero Vendas · Dark Luxury (gold)",
    description: "Hero dark com accent dourado (linear-gradient var(--gold)), fonte serif pesada, vibe luxury/premium. Cai bem em mentorias high-ticket e portfolios.",
    kind: "hero",
    themes: ["dark", "luxury"],
    suits: ["vendas", "portfolio"],
    file: "sections/hero-vendas-portfolio-dark.html",
    slots: [],
    hasSlots: false,
  },
  {
    id: "hero-vendas-saas",
    label: "Hero Vendas · SaaS Tech",
    description: "Hero com padrão radial dotted, tipografia bold, feel de produto tech. Usa tons neutros com accent vibrante.",
    kind: "hero",
    themes: ["tech", "minimal"],
    suits: ["saas", "vendas"],
    file: "sections/hero-vendas-saas.html",
    slots: [],
    hasSlots: false,
  },
  {
    id: "hero-vendas-split-bege",
    label: "Hero Vendas · Split Bege Warm",
    description: "Hero split 2-colunas com fundo bege warm, tipografia editorial. Vibe orgânica e artesanal, combina com produtos de lifestyle e coaching.",
    kind: "hero",
    themes: ["bege", "boutique"],
    suits: ["vendas", "workshop", "portfolio"],
    file: "sections/hero-vendas-split-bege.html",
    slots: [],
    hasSlots: false,
  },

  /* ───────── URGÊNCIA ───────── */
  {
    id: "urgencia-countdown",
    label: "Barra de Urgência · Countdown",
    description: "Barra fixa com gradient vermelho→laranja e texto de urgência. Vai no topo da página, independe de kind — encaixa em vendas, captura, workshop.",
    kind: "urgencia",
    themes: ["vibrant"],
    suits: ["vendas", "captura", "workshop"],
    file: "sections/urgencia-countdown.html",
    slots: ["texto urgencia"],
    hasSlots: true,
    fonts: ["DM Sans"],
    accent: "#E04E00",
  },

  /* ───────── PARA-QUEM ───────── */
  {
    id: "para-quem-e",
    label: "Para Quem É · 3 Perfis Dark",
    description: "Seção dark com 3 cards descrevendo os perfis ideais do produto. Cada card tem título curto + descrição. Copy-driven, baixa carga visual.",
    kind: "para-quem",
    themes: ["dark", "vibrant"],
    suits: ["vendas", "captura", "workshop"],
    file: "sections/para-quem-e.html",
    slots: ["headline secao", "subtitulo explicando o avatar ideal", "perfil 1 titulo", "perfil 1 descricao", "perfil 2 titulo", "perfil 2 descricao", "perfil 3 titulo", "perfil 3 descricao"],
    hasSlots: true,
    fonts: ["Montserrat"],
    accent: "#FF5C00",
  },

  /* ───────── DEPOIMENTOS ───────── */
  {
    id: "depoimentos-grid",
    label: "Depoimentos · Grid 3 Cards Dark",
    description: "Grid de 3 depoimentos com avatar de iniciais, nome, nicho/cargo e texto + resultado destacado. Dark com accent laranja.",
    kind: "depoimentos",
    themes: ["dark", "vibrant"],
    suits: ["vendas", "captura", "workshop", "saas"],
    file: "sections/depoimentos-grid.html",
    slots: ["headline depoimentos", "iniciais", "nome 1", "nicho/cargo 1", "depoimento 1 texto", "resultado 1", "nome 2", "nicho/cargo 2", "depoimento 2 texto", "resultado 2", "nome 3", "nicho/cargo 3", "depoimento 3 texto", "resultado 3"],
    hasSlots: true,
    fonts: ["Montserrat"],
    accent: "#FF5C00",
  },

  /* ───────── OFERTA ───────── */
  {
    id: "oferta-preco",
    label: "Oferta + Preço · Dark Stack",
    description: "Seção de oferta com headline, subtítulo, 3 itens inclusos, 2 bônus, preço antigo riscado, preço promocional, parcelas e CTA. Dark.",
    kind: "oferta",
    themes: ["dark", "vibrant"],
    suits: ["vendas", "workshop"],
    file: "sections/oferta-preco.html",
    slots: ["headline oferta", "subtitulo oferta", "item incluso 1", "item incluso 2", "item incluso 3", "bonus 1", "bonus 2", "preco antigo", "preco", "parcelas ex \"12x R$ 97\"", "dias", "texto CTA"],
    hasSlots: true,
    fonts: ["Montserrat"],
    accent: "#FF5C00",
  },

  /* ───────── FAQ ───────── */
  {
    id: "faq-accordion",
    label: "FAQ · Accordion 2-col Dark",
    description: "FAQ em 2 colunas (título+intro à esquerda, 6 perguntas à direita). Dark com accent laranja. Usa <details>/<summary> nativos no HTML exportado.",
    kind: "faq",
    themes: ["dark", "vibrant"],
    suits: ["vendas", "captura", "saas", "workshop"],
    file: "sections/faq-accordion.html",
    slots: ["pergunta 1", "resposta 1", "pergunta 2", "resposta 2", "pergunta 3", "resposta 3", "pergunta 4", "resposta 4", "pergunta 5", "resposta 5", "pergunta 6", "resposta 6"],
    hasSlots: true,
    fonts: ["Montserrat", "DM Sans"],
    accent: "#FF5C00",
  },
];

/** Fast lookup by section id */
export const SECTIONS_BY_ID: Record<string, Section> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s])
);

/** Sections indexed by kind (e.g. SECTIONS_BY_KIND.hero → all heroes) */
export const SECTIONS_BY_KIND = SECTIONS.reduce<Record<string, Section[]>>((acc, s) => {
  (acc[s.kind] ??= []).push(s);
  return acc;
}, {});
