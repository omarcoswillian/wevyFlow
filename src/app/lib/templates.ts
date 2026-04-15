import { TemplateItem } from "./types";

export const TEMPLATE_CATEGORIES = [
  { id: "vendas" as const, label: "Página de Vendas" },
  { id: "captura" as const, label: "Captura de Leads" },
  { id: "saas" as const, label: "SaaS / Produto" },
  { id: "blog" as const, label: "Blog / Conteúdo" },
  { id: "portfolio" as const, label: "Portfolio" },
  { id: "sections" as const, label: "Seções" },
];

export const TEMPLATES: TemplateItem[] = [
  // ━━━ PÁGINA DE VENDAS ━━━
  {
    id: "vendas-lancamento",
    label: "Lançamento Digital",
    description: "Página completa de lançamento com hero, prova social, features, depoimentos, preços, FAQ e CTA",
    category: "vendas",
    tags: ["completa", "lançamento", "curso"],
    prompt: `Crie uma landing page de VENDAS completa para um curso/produto digital. Estilo premium, fundo claro (#fafafa alternando com branco). Fonte Sora para headlines, Inter para body. Cor de acento verde (#10b981).

ESTRUTURA OBRIGATÓRIA (nesta ordem):
1. HEADER: Logo "MétodoX" à esquerda, nav (Módulos, Depoimentos, Preços, FAQ), botão "Começar Agora" verde à direita. Sticky com blur.
2. HERO: Duas colunas 55/45. Esquerda: badge "🔥 Turma 12 aberta", headline "Domine [habilidade] e escale seus resultados" em 48px bold, parágrafo 18px cinza, dois botões (verde primário + outline), stats row ("+5.000 alunos • 4.9/5 avaliação • 97% aprovação"). Direita: mockup de dashboard com cards de métricas e gráfico de barras simulado.
3. LOGOS: Faixa "Visto em" com 6 logos de veículos (Exame, Forbes, Estadão — use texto estilizado cinza).
4. FEATURES: "O que você vai aprender" + grid 3x2 de 6 cards com ícone (use divs com background colorido), título bold, descrição 2 linhas.
5. DEPOIMENTOS: 3 cards com foto avatar circular (div gradiente), nome, cargo, texto em itálico, 5 estrelas douradas. Card central em destaque elevado.
6. PREÇOS: 3 planos — Básico R$97, Profissional R$197 (DESTAQUE preto com badge "Mais Escolhido"), VIP R$497. Lista de features com checks. CTA em cada card.
7. FAQ: Layout 2 colunas — esquerda "Perguntas Frequentes" + link suporte, direita 6 perguntas estilo accordion aberto.
8. CTA FINAL: Fundo escuro #111, headline branca "Comece sua transformação hoje", timer estático, botão verde enorme, garantia 7 dias.
9. FOOTER: Fundo #111, grid 4 colunas (logo+desc, links produto, links empresa, newsletter input), copyright.

Scroll reveal em todos os elementos. Hover effects em cards e botões. Mobile-first responsivo.`,
  },
  {
    id: "vendas-produto-fisico",
    label: "Produto / E-commerce",
    description: "Página de produto com hero full, galeria, benefícios, reviews e compra",
    category: "vendas",
    tags: ["produto", "ecommerce", "físico"],
    prompt: `Crie uma landing page de PRODUTO (pode ser físico ou digital) com design premium clean.

1. HEADER: Logo à esquerda, nav centro, botão "Comprar" à direita. Fundo branco.
2. HERO: Full width. Headline enorme "O produto que vai mudar seu dia a dia" centralizada, subtítulo, botão CTA preto. Abaixo: card grande de produto com gradiente suave como "foto" e badge de preço.
3. FEATURES VISUAIS: 4 blocos alternados (imagem esquerda/direita) com headline, texto e ícones de benefício.
4. NÚMEROS: Row de 4 stats grandes (+10.000 vendidos, 4.9 estrelas, 30 dias garantia, Frete grátis).
5. REVIEWS: Grid 2x2 de depoimentos com estrelas e avatares.
6. OFERTA: Card centralizado com preço antigo riscado, preço novo grande, parcelas, CTA, selos de segurança.
7. FOOTER minimalista.

Estilo: fundo branco/creme (#f9f8f6), tipografia preta, acento em cor quente. Espaçamento enorme.`,
  },
  {
    id: "vendas-webinar",
    label: "Webinar / Evento",
    description: "Inscrição para webinar ao vivo com countdown, bio do palestrante e formulário",
    category: "vendas",
    tags: ["webinar", "evento", "ao vivo"],
    prompt: `Crie uma landing page para INSCRIÇÃO em webinar/evento ao vivo. Fundo escuro premium.

1. HEADER: Logo branco, badge "AO VIVO" vermelho pulsante.
2. HERO: Headline branca "Webinar Gratuito: [tema]", data/hora em destaque, foto/avatar do palestrante com nome e título, 4 bullets do que será abordado.
3. FORMULÁRIO: Card glassmorphism com campos (Nome, Email, WhatsApp), botão "Reservar Minha Vaga", contador "237 vagas restantes" (estático).
4. SOBRE O PALESTRANTE: Duas colunas com bio, conquistas em números.
5. PROGRAMAÇÃO: Timeline vertical com 4 tópicos do webinar.
6. CTA FINAL: Countdown estático + botão.

Cor de acento azul (#3b82f6). Glow sutil atrás do formulário.`,
  },

  {
    id: "ready-lp-vendas",
    label: "LP Vendas Completa (Pronto)",
    description: "Landing page completa com 11 secoes: Hero, Autoridade, Para quem, Pilares, Depoimentos, Especialista, Garantia, Oferta, FAQ, Footer. Carrega instantaneamente.",
    category: "vendas",
    tags: ["pronto", "completa", "11 secoes", "alta conversao"],
    prompt: "READY:ready-lp-vendas",
  },

  // ━━━ CAPTURA DE LEADS ━━━
  {
    id: "ready-captura-premium",
    label: "Captura Premium (Pronto)",
    description: "Template pronto, hand-crafted. Pagina de captura com foto do mentor, formulario e stats. Carrega instantaneamente.",
    category: "captura",
    tags: ["pronto", "premium", "formulario", "mentor"],
    prompt: "READY:ready-captura-premium",
  },
  {
    id: "captura-premium-foto",
    label: "Captura Premium com Foto",
    description: "Página de captura de alto impacto com foto hero full-screen, overlay escuro e formulário. Estilo Luana Carolina / páginas de lançamento premium",
    category: "captura",
    tags: ["premium", "foto", "high-ticket", "lançamento"],
    prompt: `Crie uma página de CAPTURA de leads de ALTO IMPACTO, estilo página premium de lançamento digital brasileiro (como Luana Carolina, Execução Máxima).

LAYOUT:
- Full height viewport (min-height: 100vh)
- Se o usuário enviou uma FOTO, use-a como background (object-fit:cover, position:absolute, 100% width/height). Senão, use um gradiente escuro sofisticado que simule profundidade (de #0a0a0a a #1a1a2e com tons sutis).
- OVERLAY: gradient escuro por cima (linear-gradient de rgba(0,0,0,0.7) à esquerda para rgba(0,0,0,0.3) à direita)
- Todo conteúdo posicionado sobre o overlay

CONTEÚDO (alinhado à esquerda, max-width 600px):
- Logo no topo (texto "MarcaX" em branco, font Montserrat ou Sora, italic/serif para parte decorativa)
- Headline GRANDE (36-44px), branca, bold: "Desbloqueie sua melhor versão em 25 dias ativando o modo [método] e alcance seus objetivos"
- Subtítulo em branco/70% opacidade (16-18px): descrição de 2 linhas do benefício
- FORMULÁRIO integrado diretamente na página (não em card separado):
  * Campo Nome (fundo transparente, border-bottom branco sutil, texto branco, placeholder branco/40%)
  * Campo Email (mesmo estilo)
  * Campo WhatsApp (mesmo estilo)
  * Botão CTA ENORME: fundo verde (#0bda51 ou gradient green), texto branco bold uppercase, padding 18px 40px, border-radius 6px, letter-spacing 0.05em, hover com brilho. Texto: "QUERO ME INSCREVER AGORA"
- Texto de privacidade em branco/30% opacidade abaixo do botão

ESTILO VISUAL:
- Fontes: Montserrat ou Sora para headlines, Inter para body
- A foto/gradiente é o PROTAGONISTA visual — o design depende dela
- Sem cards, sem boxes — conteúdo direto sobre a imagem
- Minimalista mas impactante. Poucos elementos, muito espaço
- Mobile: tudo empilhado, formulário full-width
- Campos do formulário com estilo underline (só borda inferior) e ícone à esquerda
- Scroll reveal nos elementos`,
  },
  {
    id: "captura-vagas-abertas",
    label: "Vagas Abertas / Inscrição",
    description: "Página de captura para inscrição em programa/mentoria com foto do mentor, headline persuasiva e formulário",
    category: "captura",
    tags: ["inscrição", "mentoria", "vagas", "programa"],
    prompt: `Crie uma página de INSCRIÇÃO para programa/mentoria. Estilo premium de alto ticket.

LAYOUT (duas seções):
SEÇÃO 1 - HERO (100vh):
- Background: foto do mentor/palestrante (se enviada pelo usuário, use-a) ou gradiente escuro sofisticado
- Overlay gradiente escuro da esquerda para transparente à direita
- Logo decorativo no topo esquerda
- Headline impactante à esquerda: "Como criar um infoproduto irresistível e escalar suas vendas no digital" (38-44px, branco, bold)
- Subtítulo em branco/60% (16px): benefício em 2 linhas
- Formulário inline com campos empilhados:
  * Nome (input com borda sutil, placeholder, fundo semi-transparente)
  * WhatsApp (mesmo estilo)
  * Email (mesmo estilo)
  * Botão verde GRANDE: "QUERO GARANTIR O MEU LUGAR" (uppercase, letter-spacing, gradiente verde animado)
- Texto LGPD minúsculo abaixo

SEÇÃO 2 - PROVA SOCIAL:
- Fundo escuro (#0a0a0a)
- Row de 3-4 stats: "+5.000 alunos", "97% satisfação", "4.9 avaliação", "30 países"
- Grid de depoimentos com avatares

Fontes: Montserrat headlines, Inter body. Cor acento: verde (#0bda51).
Design cinematográfico. A foto faz 80% do impacto visual.`,
  },
  {
    id: "captura-ebook",
    label: "E-book Download",
    description: "Página de captura para download de e-book com mockup 3D e formulário",
    category: "captura",
    tags: ["ebook", "download", "lead magnet"],
    prompt: `Crie uma página de CAPTURA de leads para download de e-book. Clean e focada em conversão.

Layout duas colunas 50/50:
- ESQUERDA: Mockup 3D do e-book (card com gradiente, sombra sofisticada, simulando capa com título e autor), abaixo "O que você vai aprender:" com 5 bullets com checks verdes.
- DIREITA: Headline "Baixe gratuitamente", subtítulo, formulário com campos estilizados (Nome, Email, WhatsApp), botão CTA verde "Baixar E-book Grátis →", texto "100% gratuito, sem spam", badge de privacidade.

Fundo: branco limpo ou gradiente muito suave. Sem distrações — sem nav, sem footer complexo. Foco total no formulário.
Badge no topo: "📚 Mais de 15.000 downloads".`,
  },
  {
    id: "captura-lista-espera",
    label: "Lista de Espera",
    description: "Pré-lançamento minimalista com campo de email e contador de inscritos",
    category: "captura",
    tags: ["waitlist", "pré-lançamento", "coming soon"],
    prompt: `Crie uma página de LISTA DE ESPERA / PRÉ-LANÇAMENTO. Ultra minimalista e sofisticada.

- Fundo escuro (#09090b) com glow sutil roxo/azul no centro
- Logo no topo centralizado
- Headline grande centralizada: "Algo incrível está chegando"
- Subtítulo misterioso de 1 linha
- Campo de email centralizado com botão "Entrar na Lista VIP →"
- Contador: "2.847 pessoas na fila" (estático)
- 3 badges: "Acesso antecipado", "Preço especial", "Conteúdo exclusivo"
- Nada mais. O espaço vazio é o design.

Tipografia Sora. Mínimo de elementos. Máximo de impacto.`,
  },
  {
    id: "captura-quiz",
    label: "Quiz Interativo",
    description: "Captura gamificada com pergunta e opções visuais clicáveis",
    category: "captura",
    tags: ["quiz", "gamificação", "interativo"],
    prompt: `Crie uma página de CAPTURA baseada em quiz. Engajamento alto.

- Barra de progresso no topo (Etapa 1 de 3, 33% preenchido)
- Headline: "Descubra seu perfil de investidor"
- Pergunta em destaque com 4 opções em cards grandes clicáveis (sem JS, apenas visual com hover)
- Cada card: ícone, título bold, descrição curta
- Hover: borda colorida + scale sutil
- Abaixo: "Responda e receba seu resultado por email"
- Mini formulário de email
- Fundo branco com detalhes em roxo (#8b5cf6).
- Design gamificado mas profissional.`,
  },

  // ━━━ SaaS / PRODUTO ━━━
  {
    id: "saas-dashboard",
    label: "SaaS com Dashboard",
    description: "Landing page SaaS com hero, mockup de dashboard detalhado e features",
    category: "saas",
    tags: ["saas", "dashboard", "app", "software"],
    prompt: `Crie uma landing page de produto SaaS estilo Linear/Stripe/Vercel.

1. HEADER: Logo preto à esquerda, nav (Features, Pricing, Docs), botão "Get Started" preto pill.
2. HERO: Centralizado. Badge "Novo: API v2.0 disponível". Headline ENORME "The only platform built for your team" com uma palavra em itálico. Subtítulo cinza. Botão preto pill "Get started free →". Abaixo: mockup DETALHADO de dashboard — card com browser chrome (3 dots), sidebar com 5 items, área principal com 4 cards de métricas (números + labels + mini sparklines), tabela com 3 rows, e gráfico de barras colorido. Sombra sofisticada 3 camadas.
3. LOGOS: "Trusted by" + 6 logos em cinza.
4. FEATURES: Grid 2x2 de cards grandes. Cada card: stat grande no canto (100%, 2x, 0, AI), título, descrição, ícone.
5. CTA: "Start building today" + botão.
6. FOOTER minimalista.

Fundo: creme #f5f5f0. Tipografia: Inter ou Sora. Preto puro para textos. Zero gradientes vibrantes. Espaçamento CINEMATOGRÁFICO (140px+ entre seções).`,
  },
  {
    id: "saas-ai",
    label: "Produto de IA",
    description: "Landing page para produto de inteligência artificial com visual futurista",
    category: "saas",
    tags: ["ia", "ai", "inteligência artificial", "tech"],
    prompt: `Crie uma landing page para um produto de IA. Visual futurista mas elegante.

1. HEADER: Logo com gradiente, nav em branco, botão outline.
2. HERO: Fundo escuro (#0a0a0f) com glow roxo/azul sutil. Headline branca "Inteligência artificial que realmente entende seu negócio". Badge "Powered by AI". Botão gradiente. Abaixo: interface de chat simulada (card escuro com mensagens de usuário e respostas de IA com typing indicator).
3. COMO FUNCIONA: 3 steps visuais em row (1→2→3) com ícones, títulos e descrições.
4. FEATURES: Alternado esquerda/direita com mockups de interface.
5. PRICING: 2 planos (Free e Pro).
6. CTA com glow.

Cores: roxo (#8b5cf6) como acento, fundo escuro, glassmorphism nos cards.`,
  },

  // ━━━ BLOG / CONTEÚDO ━━━
  {
    id: "blog-home",
    label: "Blog Homepage",
    description: "Página inicial de blog com posts em destaque, grid de artigos e sidebar",
    category: "blog",
    tags: ["blog", "artigos", "conteúdo"],
    prompt: `Crie uma HOMEPAGE de blog profissional e clean.

1. HEADER: Logo + nome do blog, nav (Categorias, Sobre, Newsletter), busca, botão "Assinar".
2. POST DESTAQUE: Card hero com "imagem" (gradiente), badge de categoria, título grande, excerpt, autor com avatar, data.
3. GRID DE POSTS: 3 colunas, 6 cards de artigo. Cada card: imagem (gradiente placeholder), categoria badge, título bold, excerpt 2 linhas, autor + data + tempo de leitura. Hover: elevação.
4. SIDEBAR: Widget "Newsletter" com campo de email e botão, widget "Categorias" com lista e contagem, widget "Posts Populares" com 4 mini items.
5. PAGINAÇÃO: Botões Previous/Next estilizados.
6. FOOTER: Links e newsletter.

Fundo branco, tipografia Inter. Estilo editorial limpo como Medium ou Substack.`,
  },
  {
    id: "blog-post",
    label: "Artigo / Blog Post",
    description: "Layout de artigo com tipografia editorial, autor, compartilhamento e relacionados",
    category: "blog",
    tags: ["artigo", "post", "editorial"],
    prompt: `Crie o layout de um ARTIGO de blog com design editorial premium.

1. HEADER minimalista com logo e botão "Voltar ao blog".
2. HERO DO ARTIGO: Categoria badge, título enorme (font-size 48px, Playfair Display ou Sora 800), subtítulo/excerpt, autor com avatar + nome + data + "8 min de leitura".
3. IMAGEM HERO: Full-width com gradiente placeholder, border-radius, sombra.
4. CONTEÚDO: Max-width 680px centralizado. Tipografia editorial — H2 em 28px, parágrafos em 18px com line-height 1.8, blockquote estilizado com barra lateral colorida, lista com bullets customizados, destaque/callout box.
5. COMPARTILHAR: Barra lateral fixa (floating) com ícones de redes sociais.
6. AUTOR BOX: Card com avatar grande, bio, links sociais.
7. RELACIONADOS: Grid 3 colunas "Leia também" com 3 cards.

Fundo branco puro. Tipografia é o design. Espaçamento generoso.`,
  },

  // ━━━ PORTFOLIO ━━━
  {
    id: "portfolio-designer",
    label: "Portfolio Designer",
    description: "Portfolio minimalista para designer com grid de projetos e about",
    category: "portfolio",
    tags: ["portfolio", "designer", "criativo"],
    prompt: `Crie um site PORTFOLIO para designer/criativo. Ultra minimalista.

1. HEADER: Nome do designer como logo, nav (Work, About, Contact), sem botão.
2. HERO: "Design that speaks" em tipografia enorme (80px+), subtítulo "Creative Director & UI Designer", sem CTA.
3. PROJETOS: Grid 2 colunas com 4 projetos. Cada projeto: card com gradiente como "foto" (cada um cor diferente), título, cliente, ano. Hover: zoom sutil na imagem + overlay.
4. SOBRE: Duas colunas — esquerda foto placeholder, direita bio em parágrafo, skills como tags.
5. CONTATO: Email grande clicável, redes sociais como ícones.
6. FOOTER: Apenas "© 2026 Nome".

Fundo branco, tipografia Sora, preto puro. Sem cores de acento — monocromático. O espaço negativo é o protagonista.`,
  },
  {
    id: "portfolio-dev",
    label: "Portfolio Developer",
    description: "Portfolio para desenvolvedor com projetos, tech stack e terminal aesthetic",
    category: "portfolio",
    tags: ["portfolio", "developer", "dev", "programador"],
    prompt: `Crie um site PORTFOLIO para desenvolvedor. Estilo tech/terminal.

1. HEADER: "dev.nome" como logo em monospace, nav (Projects, Stack, Blog, Contact).
2. HERO: Fundo escuro. Simulação de terminal: "$ whoami" → nome. "$ cat about.txt" → bio curta. Cursor piscando. Botão "View Projects ↓".
3. PROJETOS: Grid 2x2. Cards escuros com border sutil. Cada projeto: nome em monospace bold, descrição, tags de tecnologia (React, Node, etc) como pills coloridas, link "View →".
4. TECH STACK: Grid de ícones/logos de tecnologias organizados por categoria (Frontend, Backend, Tools).
5. EXPERIÊNCIA: Timeline vertical com empresas, cargos, datas.
6. CONTATO: Email + GitHub + LinkedIn como links grandes.

Fundo #0a0a0f, texto branco/verde terminal (#10b981). Monospace + Sans-serif mix.`,
  },

  // ━━━ SECOES PRONTAS (hand-crafted) ━━━
  {
    id: "ready-hero-simples",
    label: "Hero Simples (Pronto)",
    description: "Hero centralizado com badge, headline, subheadline, CTA laranja e prova social. Design system padrao.",
    category: "sections",
    tags: ["pronto", "hero", "centralizado"],
    prompt: "READY:ready-hero-simples",
  },
  {
    id: "ready-urgencia",
    label: "Barra de Urgencia (Pronto)",
    description: "Barra de urgencia laranja com countdown animado. Ideal para topo de pagina de lancamento.",
    category: "sections",
    tags: ["pronto", "urgencia", "countdown", "timer"],
    prompt: "READY:ready-urgencia",
  },
  {
    id: "ready-para-quem",
    label: "Para Quem E (Pronto)",
    description: "Grid 3 colunas com cards de perfil ideal. Icones SVG, hover com borda laranja.",
    category: "sections",
    tags: ["pronto", "avatar", "perfil", "para quem"],
    prompt: "READY:ready-para-quem",
  },
  {
    id: "ready-depoimentos",
    label: "Depoimentos Grid (Pronto)",
    description: "Grid 3 colunas de depoimentos com estrelas, avatar, nome, nicho e badge de resultado.",
    category: "sections",
    tags: ["pronto", "depoimentos", "reviews", "social proof"],
    prompt: "READY:ready-depoimentos",
  },
  {
    id: "ready-oferta",
    label: "Oferta + Preco (Pronto)",
    description: "Card de oferta com ancora de preco, parcelas, lista de itens inclusos, bonus e CTA com garantia.",
    category: "sections",
    tags: ["pronto", "oferta", "preco", "checkout"],
    prompt: "READY:ready-oferta",
  },
  {
    id: "ready-faq",
    label: "FAQ Accordion (Pronto)",
    description: "Layout 2 colunas: titulo + contato a esquerda, 6 perguntas a direita. Estilo accordion.",
    category: "sections",
    tags: ["pronto", "faq", "perguntas"],
    prompt: "READY:ready-faq",
  },

  // ━━━ SECOES VIA IA ━━━
  {
    id: "section-hero-split",
    label: "Hero Split com Mockup",
    description: "Seção hero com texto + mockup de dashboard lado a lado",
    category: "sections",
    tags: ["hero", "split", "mockup"],
    prompt: `Crie APENAS uma hero section split (duas colunas 55/45). Fundo branco. Esquerda: badge, headline gigante, parágrafo, dois botões, stats. Direita: mockup de dashboard detalhado com browser chrome, sidebar, métricas e gráfico. Sombra 3 camadas. Scroll reveal. Responsivo.`,
  },
  {
    id: "section-pricing",
    label: "Seção de Preços",
    description: "3 planos com destaque, features e CTAs",
    category: "sections",
    tags: ["preços", "pricing", "planos"],
    prompt: `Crie APENAS uma seção de pricing com 3 planos (Starter R$47, Pro R$97 DESTAQUE, Premium R$197). Cards com lista de features com checks, botão CTA. Plano Pro com fundo escuro, badge "Popular", escala maior. Fundo #fafafa. Responsivo.`,
  },
  {
    id: "section-testimonials",
    label: "Depoimentos Premium",
    description: "3 cards de depoimento com estrelas, avatar e cargo",
    category: "sections",
    tags: ["depoimentos", "testimonials", "reviews"],
    prompt: `Crie APENAS uma seção de depoimentos. 3 cards premium com 5 estrelas douradas, texto em itálico, avatar circular com gradiente, nome bold, cargo/empresa. Card central elevado com sombra maior. Fundo branco. Scroll reveal com stagger.`,
  },
  {
    id: "section-features",
    label: "Features Grid",
    description: "Grid 3x2 de features com ícones, hover effects e stats",
    category: "sections",
    tags: ["features", "benefícios", "grid"],
    prompt: `Crie APENAS uma seção de features. Headline "Tudo que você precisa", grid 3x2 de 6 cards. Cada card: stat grande no canto (100%, 2x, etc), ícone em div com background colorido, título bold, descrição. Hover: elevação + borda colorida. Fundo #f8f8f8. Responsivo.`,
  },
  {
    id: "section-cta",
    label: "CTA com Urgência",
    description: "Call-to-action com countdown, garantia e botão grande",
    category: "sections",
    tags: ["cta", "urgência", "conversão"],
    prompt: `Crie APENAS uma seção CTA. Fundo escuro #111. Headline branca "Não perca essa oportunidade". Countdown estático (02d 14h 32m 08s) em cards. Botão ENORME gradiente verde. Garantia 7 dias com ícone de escudo. Badges de pagamento seguro. Responsivo.`,
  },
  {
    id: "section-faq",
    label: "FAQ Elegante",
    description: "Perguntas frequentes em 2 colunas com estilo accordion",
    category: "sections",
    tags: ["faq", "perguntas", "suporte"],
    prompt: `Crie APENAS uma seção FAQ. Layout 2 colunas: esquerda "Perguntas frequentes" + subtítulo + link "Fale conosco", direita 6 perguntas com respostas visíveis (sem JS). Cada pergunta: border-bottom, título bold, resposta cinza. Fundo branco. Responsivo.`,
  },
];
