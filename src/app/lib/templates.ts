import { TemplateItem } from "./types";

export const TEMPLATE_CATEGORIES = [
  { id: "vendas" as const, label: "Página de Vendas" },
  { id: "captura" as const, label: "Captura de Leads" },
  { id: "evento" as const, label: "Evento / Workshop" },
  { id: "servico" as const, label: "Serviço / Consultoria" },
  { id: "blog" as const, label: "Blog / Conteúdo" },
];

export const TEMPLATES: TemplateItem[] = [
  // ━━━ PÁGINA DE VENDAS ━━━
  {
    id: "ready-vendas-premium-completa",
    label: "LP Vendas Premium Completa · Âmbar (Pronto)",
    description: "Página de vendas de alto nível com 15 seções: Nav sticky, Hero 2col com VSL, Prova Social, Problema, Transformação, 6 Módulos em grid, Para Quem, Depoimentos, Bônus, Pricing dark com CTA, Garantia, FAQ accordion, CTA Final e Footer. Paleta âmbar/marrom com fundos alternados branco e cinza.",
    category: "vendas",
    tags: ["pronto", "vendas", "premium", "completa", "âmbar", "curso", "infoproduto", "15 seções", "vsl", "accordion", "garantia"],
    prompt: "READY:ready-vendas-premium-completa",
  },
  {
    id: "ready-metodo-rmx",
    label: "Método RMX 5.0 · Dark Purple Premium (Pronto)",
    description: "Página de vendas premium para método/curso. Hero dark com glow roxo e grid animado, stats strip, 3 pilares com hover animado, resultados em grid 2x3, módulos em accordion interativo, seção de upgrade em vermelho com bonus cards, oferta com preço e CTA, garantia e fechamento com contador animado.",
    category: "vendas",
    tags: ["pronto", "vendas", "dark", "roxo", "purple", "método", "curso", "infoproduto", "premium", "accordion", "animado"],
    prompt: "READY:ready-metodo-rmx",
  },
  {
    id: "ready-metodo-rmx-light",
    label: "Método RMX 5.0 · Light Purple (Pronto)",
    description: "Versão clara da página do Método RMX. Fundo branco/lavanda com accent roxo, cards com hover lift e sombra roxa, quote break em roxo sólido, upgrade em dark com bonus cards, módulos em accordion e oferta com card gradient roxo no topo.",
    category: "vendas",
    tags: ["pronto", "vendas", "light", "branco", "roxo", "purple", "método", "curso", "infoproduto", "premium", "accordion"],
    prompt: "READY:ready-metodo-rmx-light",
  },
  {
    id: "ready-stories10x-dark",
    label: "LP Vendas · Stories 10x Dark Pink (Pronto)",
    description: "Página de vendas dark roxo/pink estilo Stories 10x. Hero com badge + 4 benefícios em grade, player VSL, CTA pink com glow, faixa de bônus horizontal, para quem é em 6 cards, 4 depoimentos de video e CTA final.",
    category: "vendas",
    tags: ["pronto", "vendas", "dark", "pink", "vsl", "stories", "instagram", "social media", "rosa", "roxo"],
    prompt: "READY:ready-stories10x-dark",
  },
  {
    id: "ready-novomercado-dark",
    label: "LP Vendas · Novo Mercado Dark Navy (Pronto)",
    description: "Página de vendas dark navy estilo plataforma premium. Nav sticky com CTA de borda, hero fullscreen com painéis de UI decorativos, badge de prova social com avatares, headline accent pink, CTA pill arredondado, features em 3 colunas, números e depoimentos.",
    category: "vendas",
    tags: ["pronto", "vendas", "dark", "navy", "saas", "plataforma", "premium", "tech", "pink"],
    prompt: "READY:ready-novomercado-dark",
  },
  {
    id: "ready-vendas-black-boutique",
    label: "LP Vendas Black Boutique (Pronto)",
    description: "Pagina de vendas premium estilo editorial com blocos arredondados, hero dark com video VSL, urgencia, manifesto, 3 steps, depoimentos grid, bonus cards, pricing com selos, mentor, FAQ accordion, sticky mobile CTA. Paleta mauve/dark.",
    category: "vendas",
    tags: ["pronto", "vendas", "infoproduto", "editorial", "dark", "mauve", "vsl", "premium", "boutique"],
    prompt: "READY:ready-vendas-black-boutique",
  },
  {
    id: "ready-vendas-white-boutique",
    label: "LP Vendas White Boutique (Pronto)",
    description: "Versao light da boutique editorial: blocos claros e escuros intercalados, hero dark com video VSL, urgencia, oportunidade, manifesto com estrelas, plan steps, depoimentos com hierarquia, bonus cards com corner markers, pricing white com selos, mentor, FAQ, sticky mobile CTA. Paleta mauve sobre fundo claro.",
    category: "vendas",
    tags: ["pronto", "vendas", "infoproduto", "editorial", "light", "white", "mauve", "vsl", "premium", "boutique"],
    prompt: "READY:ready-vendas-white-boutique",
  },
  {
    id: "ready-lp-vendas-spe",
    label: "LP Vendas Completa 13 Secoes (Pronto)",
    description: "Pagina de vendas completa com 13 secoes: Hero, Depoimentos dark, Traits, Metodo, Para Quem, 6 Etapas, Bonus, Pricing, Garantia, Criador, FAQ, CTA Final. Estilo clean light com green accent.",
    category: "vendas",
    tags: ["pronto", "completa", "13 secoes", "curso", "infoproduto", "light"],
    prompt: "READY:ready-lp-vendas-spe",
  },
  {
    id: "ready-lp-vendas",
    label: "LP Vendas Completa (Pronto)",
    description: "Landing page completa com 11 secoes: Hero, Autoridade, Para quem, Pilares, Depoimentos, Especialista, Garantia, Oferta, FAQ, Footer. Carrega instantaneamente.",
    category: "vendas",
    tags: ["pronto", "completa", "11 secoes", "alta conversao"],
    prompt: "READY:ready-lp-vendas",
  },

  {
    id: "ready-lp-workshop",
    label: "LP Workshop / Imersao (Pronto)",
    description: "Pagina de vendas completa para workshop/imersao online. 16 secoes: Hero, marquee, depoimentos, problema, solucao, para quem, beneficios, conteudo com VIP, cronograma, pricing 2 cards (Start+VIP), instrutores, garantia, contato WhatsApp, FAQ accordion, CTA final. Estilo clean white.",
    category: "vendas",
    tags: ["pronto", "workshop", "imersao", "evento", "white", "clean", "pricing", "faq"],
    prompt: "READY:ready-lp-workshop",
  },

  // ━━━ CAPTURA DE LEADS ━━━
  {
    id: "ready-captura-minimal-premium",
    label: "LP Captura Minimal Premium · Azul-Petróleo (Pronto)",
    description: "Página de captura premium e limpa com 8 seções: Nav sticky com CTA, Hero com badge + H1 + form inline, Logos strip de confiança, Problema em 3 cards, Benefícios com ícones, Steps numerados, Depoimentos e CTA dark final. Paleta azul-petróleo #0A2540 sobre fundo branco. Design clean e profissional.",
    category: "captura",
    tags: ["pronto", "captura", "premium", "azul", "petróleo", "minimal", "clean", "formulário", "infoproduto", "lançamento"],
    prompt: "READY:ready-captura-minimal-premium",
  },
  {
    id: "ready-captura-comunidade",
    label: "Captura Comunidade / Clube (Pronto)",
    description: "Pagina de captura para comunidade/clube. Hero dark com foto do especialista e glow roxo, formulario integrado, secao de pilares split, CTA com circulos de avatares. Estilo clube premium.",
    category: "captura",
    tags: ["pronto", "comunidade", "clube", "dark", "purple", "formulario", "pilares"],
    prompt: "READY:ready-captura-comunidade",
  },
  {
    id: "ready-captura-light",
    label: "Captura Premium Light (Pronto)",
    description: "Pagina de captura light premium. Hero split com foto e cards flutuantes, formulario com labels, prova social em 4 stats, 3 beneficios com icones, CTA final com trust badges. Fundo claro elegante, accent verde.",
    category: "captura",
    tags: ["pronto", "captura", "light", "premium", "foto", "formulario", "stats", "beneficios"],
    prompt: "READY:ready-captura-light",
  },
  {
    id: "ready-captura-dark",
    label: "Captura Premium Dark (Pronto)",
    description: "Pagina de captura dark premium. Hero split com foto, glow dourado, 3 cards flutuantes, formulario com labels, prova social dourada, 3 beneficios, CTA final. Fundo escuro, accent dourado.",
    category: "captura",
    tags: ["pronto", "captura", "dark", "premium", "gold", "foto", "formulario", "glow"],
    prompt: "READY:ready-captura-dark",
  },
  {
    id: "ready-captura-infoprodutor",
    label: "Captura Infoprodutor (Pronto)",
    description: "Template pronto estilo personal brand premium. Dark com formulario completo (nome, email, whatsapp, data, genero), CTA verde animado, stats, depoimentos. Carrega instantaneamente.",
    category: "captura",
    tags: ["pronto", "infoprodutor", "dark", "formulario completo", "lancamento", "green cta"],
    prompt: "READY:ready-captura-infoprodutor",
  },
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
    description: "Página de captura de alto impacto com foto hero full-screen, overlay escuro e formulário. Estilo páginas de lançamento premium do mercado digital BR.",
    category: "captura",
    tags: ["premium", "foto", "high-ticket", "lançamento"],
    prompt: `Crie uma página de CAPTURA de leads de ALTO IMPACTO, estilo página premium de lançamento digital brasileiro.

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

  {
    id: "ready-quiz-funnel",
    label: "Quiz Funnel — Perfil Digital (Pronto)",
    description: "Funil de quiz completo com 5 perguntas interativas, barra de progresso animada, 4 resultados personalizados (Criador, Builder, Agencia, E-commerce), formulario de captura no resultado, prova social. Dark premium com accent roxo. JS funcional.",
    category: "captura",
    tags: ["pronto", "quiz", "funnel", "interativo", "gamificacao", "captura", "dark", "roxo", "js"],
    prompt: "READY:ready-quiz-funnel",
  },

  // ━━━ EVENTO / WORKSHOP ━━━
  {
    id: "ready-evento-premium",
    label: "LP Evento / Webinar Premium · Dark Dourado (Pronto)",
    description: "Página completa para evento online ou webinar premium. 10 seções: Nav com badge 'Ao vivo', Hero 2col com form + data/local, Countdown timer JS em tempo real, Apresentador com credenciais, O que vai aprender, Para quem é, Depoimentos, Agenda com timeline, FAQ accordion e CTA final dark. Paleta escura #0A0A0A com accent dourado #D4A017.",
    category: "evento",
    tags: ["pronto", "evento", "webinar", "dark", "dourado", "countdown", "formulário", "agenda", "timeline", "lançamento"],
    prompt: "READY:ready-evento-premium",
  },
  {
    id: "ready-evento-presencial-dark",
    label: "Evento Presencial · Dark Red (Pronto)",
    description: "Página completa para congresso/evento presencial. Hero com data/local/lote, marquee vermelho, prova social + vídeo, depoimentos de quem viveu, carrossel de palestrantes auto-scroll, features da experiência, seção de data/venue em destaque, alcance mundial com bandeiras, 3 tiers de ingresso (com barra de disponibilidade e estado esgotado), FAQ, manifesto do mentor e CTA final. Dark #131313 com accent vermelho intenso — inspirado no Subido ao Vivo.",
    category: "evento",
    tags: ["pronto", "evento", "presencial", "congresso", "workshop", "dark", "red", "ingressos", "palestrantes", "lote", "marquee"],
    prompt: "READY:evento-presencial-dark",
  },
  // ━━━ SERVIÇO / CONSULTORIA ━━━
  {
    id: "ready-servico-premium",
    label: "LP Serviço Premium · Verde Consultoria (Pronto)",
    description: "Landing page de consultoria/serviço de alto ticket com 13 seções: Nav, Hero 2col com floating cards de resultados, Logo strip, Problema em dark, Serviços com entregáveis, Processo em timeline, Cases com resultados reais, Especialista, Depoimentos, Formulário de proposta, Garantia, FAQ e Footer. Paleta off-white #FAFAF8 + verde escuro #1B4332 + dourado para resultados.",
    category: "servico",
    tags: ["pronto", "serviço", "consultoria", "alto ticket", "verde", "premium", "formulário", "cases", "timeline", "processo"],
    prompt: "READY:ready-servico-premium",
  },

  // ━━━ BLOG / CONTEÚDO ━━━
  {
    id: "ready-blog-premium",
    label: "Blog Premium — Estilo Apple (Pronto)",
    description: "Blog completo com hero split, icones de categoria, post destaque grande, grid 4col de recentes, populares 3col, newsletter, topicos em pills, autores, footer. Estilo Apple Store editorial.",
    category: "blog",
    tags: ["pronto", "blog", "editorial", "apple", "newsletter", "categorias", "autores"],
    prompt: "READY:ready-blog-premium",
  },
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

];
