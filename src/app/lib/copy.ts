export const COPY = {
  brand: {
    name: "WevyFlow",
    tagline: "Estrutura dos grandes lancamentos, sem precisar de uma equipe.",
    description:
      "A plataforma completa para infoprodutores que querem lancar com profissionalismo — sem contratar uma equipe.",
  },
  home: {
    hero: {
      headline: "Seu proximo lancamento, do briefing a publicacao.",
      subheadline:
        "Crie paginas, emails, criativos e kits completos de lancamento com a mesma estrutura que agencias cobram R$15.000 por projeto.",
      cta_primary: "Criar meu lancamento",
      cta_secondary: "Ver exemplos",
    },
    quickActions: {
      title: "O que voce quer criar?",
      items: [
        { label: "Kit completo de lancamento", description: "LP + emails + criativos em um fluxo" },
        { label: "Pagina de captura", description: "Converte visitante em lead" },
        { label: "Pagina de vendas", description: "VSL, longa ou minimalista" },
        { label: "Sequencia de emails", description: "Pre-lancamento, carrinho, pos-venda" },
      ],
    },
  },
  navigation: {
    home: "Inicio",
    launches: "Meus Lancamentos",
    pages: "Paginas",
    emails: "Emails",
    creatives: "Criativos",
    leads: "Leads",
    projects: "Projetos",
  },
  onboarding: {
    welcome_headline: "Bem-vindo ao WevyFlow",
    welcome_sub: "Vamos configurar sua conta em 2 minutos.",
    step1_title: "Bem-vindo",
    step2_title: "Seu produto",
    step3_title: "Estrategia",
    step4_title: "Confirmacao",
    skip: "Fazer isso depois",
    continue: "Continuar",
    finish: "Criar meu kit",
  },
  plans: {
    free: {
      name: "Gratis",
      description: "Para quem esta comecando",
      cta: "Comecar gratis",
    },
    pro: {
      name: "Pro",
      description: "Para infoprodutores em crescimento",
      cta: "Assinar Pro",
      upgrade_nudge:
        "Voce esta no plano Gratis. Faca upgrade para gerar mais lancamentos.",
    },
    scale: {
      name: "Scale",
      description: "Para quem lanca em volume",
      cta: "Falar com o time",
    },
  },
  errors: {
    generic: "Algo deu errado. Tente novamente.",
    generation_limit:
      "Voce atingiu o limite do plano Gratis. Faca upgrade para continuar gerando.",
    auth_required: "Faca login para continuar.",
  },
  empty_states: {
    launches: "Voce ainda nao tem lancamentos. Crie o primeiro agora.",
    pages: "Nenhuma pagina criada. Gere uma com IA em segundos.",
    emails:
      "Nenhuma sequencia criada. Adicione emails ao seu kit de lancamento.",
    leads:
      "Nenhum lead ainda. Publique sua pagina de captura para comecar a capturar.",
    projects: "Nenhum projeto ainda. Gere uma landing page e salve aqui.",
  },
} as const;
