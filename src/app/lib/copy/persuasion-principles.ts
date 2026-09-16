/**
 * Princípios de persuasão de Cialdini (reciprocidade, compromisso e
 * coerência, prova social, autoridade, afeição, escassez, unidade),
 * reescritos como diretrizes aplicáveis a copy de anúncios, e-mails,
 * landing pages e criativos — não como citação do livro.
 *
 * Fonte única de verdade: os prompts de geração importam
 * CIALDINI_PRINCIPLES_BLOCK. CIALDINI_PRINCIPLES_DETAILED é a referência
 * completa para quem for revisar ou ajustar esse bloco.
 */

export interface PersuasionPrinciple {
  id: string;
  nome: string;
  mecanismo: string;
  aplicacao: {
    ads: string;
    email: string;
    landingPage: string;
    criativo: string;
  };
  exemplo: string;
  alerta: string;
}

export const CIALDINI_PRINCIPLES_DETAILED: PersuasionPrinciple[] = [
  {
    id: "reciprocidade",
    nome: "Reciprocidade",
    mecanismo:
      "Quem recebe algo de valor real primeiro sente a necessidade social de retribuir — com atenção, confiança ou ação.",
    aplicacao: {
      ads: "Leve com um insight ou dado útil antes da promessa, não só hype.",
      email: "Abra entregando algo prático (checklist, resposta a uma dúvida comum, diagnóstico) antes de pedir o clique.",
      landingPage: "A seção de 'o que você recebe' deve parecer generosa e específica, não uma lista genérica de features.",
      criativo: "Se houver espaço para texto de apoio, use-o para uma dica rápida real, não só urgência.",
    },
    exemplo: "\"Antes de falar do curso: esse é o erro nº1 que trava 90% de quem tenta sozinho.\"",
    alerta: "Prometer valor e não entregar queima a confiança mais rápido do que simplesmente não usar o gatilho.",
  },
  {
    id: "compromisso-coerencia",
    nome: "Compromisso e Coerência",
    mecanismo:
      "Depois de concordar com algo pequeno, a pessoa tende a manter suas decisões futuras coerentes com esse primeiro 'sim'.",
    aplicacao: {
      ads: "Ângulo de dor específica funciona melhor quando o leitor se reconhece nela antes de ver a oferta.",
      email: "Faça o leitor admitir mentalmente a dor ou o objetivo antes de apresentar o CTA.",
      landingPage: "Sequência hero → dor → mecanismo → oferta segue essa lógica: cada seção é um 'sim' pequeno rumo ao maior.",
      criativo: "Headline que nomeia a dor com precisão já é o primeiro 'sim' antes do CTA.",
    },
    exemplo: "\"Se você já tentou 3 métodos diferentes e nenhum colou, o problema não é disciplina.\"",
    alerta: "Não force uma concordância artificial — se o 'sim' inicial não for genuíno, o leitor sente a manipulação.",
  },
  {
    id: "prova-social",
    nome: "Prova Social",
    mecanismo:
      "As pessoas olham para o comportamento de outras pessoas parecidas com elas para decidir o que é certo fazer.",
    aplicacao: {
      ads: "Ângulo de número/resultado só entra quando o briefing fornece uma prova real.",
      email: "Fragmento de depoimento ou resultado concreto reforça a ponte antes do CTA.",
      landingPage: "Seção de depoimentos/resultados usa nomes e números exatamente como vieram do briefing.",
      criativo: "Um número ou selo de prova social pode ser o elemento central quando o briefing sustenta isso.",
    },
    exemplo: "\"Foi assim que 340 alunos da turma passada saíram do zero.\" (só se o número vier do briefing)",
    alerta: "PROIBIDO inventar número, nome ou depoimento. Sem prova real no briefing, use outro princípio.",
  },
  {
    id: "autoridade",
    nome: "Autoridade",
    mecanismo:
      "Sinais de domínio real (método, especificidade, critério) pesam mais na decisão do que autoelogio.",
    aplicacao: {
      ads: "Ângulo de lógica/objeção é o lugar certo para demonstrar método, não para se autodeclarar 'o melhor'.",
      email: "Mostre o raciocínio por trás da recomendação, não só a conclusão.",
      landingPage: "Seção de mecanismo/metodologia é onde a autoridade se constrói com clareza, não com adjetivos.",
      criativo: "Autoridade em criativo é visual: credencial ou selo real, nunca inflar título ou cargo.",
    },
    exemplo: "\"O método tem 4 etapas. A maioria trava na etapa 2 — é a que ninguém ensina.\"",
    alerta: "Autoridade se prova com especificidade. \"Sou especialista\" sem contexto soa vazio e é ignorado.",
  },
  {
    id: "afeicao",
    nome: "Afeição / Semelhança",
    mecanismo:
      "Confiamos mais em quem se parece com a gente ou demonstra entender exatamente a nossa realidade.",
    aplicacao: {
      ads: "Tom e vocabulário devem soar como o avatar fala, não como marketing genérico.",
      email: "Escreva para uma pessoa específica, nunca 'vocês' — a segunda pessoa do singular sustenta a semelhança.",
      landingPage: "A dor descrita no hero precisa ser hiperespecífica ao avatar, não uma dor genérica de nicho.",
      criativo: "Linguagem visual (cores, tipografia, tom) deve refletir a identidade do público, não um padrão genérico.",
    },
    exemplo: "\"Você não precisa de mais um curso de 40 horas — precisa de 20 minutos que resolvam isso hoje.\"",
    alerta: "Semelhança forçada ou caricata (gírias fora de contexto) soa artificial e quebra a confiança.",
  },
  {
    id: "escassez",
    nome: "Escassez",
    mecanismo:
      "O medo de perder uma oportunidade pesa mais na decisão do que a chance de ganhar algo equivalente.",
    aplicacao: {
      ads: "Ângulo de escassez só usa prazo/vaga real do briefing — sem dado real, vira 'medo de perder' genérico sem data inventada.",
      email: "Reforce o custo real de esperar, com data e hora reais quando o briefing tiver.",
      landingPage: "Contador ou aviso de vagas só aparece quando o dado é real e verificável.",
      criativo: "Badge de urgência (ex.: 'últimas vagas') só quando o briefing confirma isso.",
    },
    exemplo: "\"As inscrições fecham quinta às 23h59 — depois disso a turma não reabre esse ano.\"",
    alerta: "PROIBIDO inventar prazo, vaga ou contador regressivo que não veio do briefing — urgência falsa é o gatilho que mais corrói confiança a médio prazo.",
  },
  {
    id: "unidade",
    nome: "Unidade",
    mecanismo:
      "Pertencer a um grupo ou identidade compartilhada ('gente como a gente') pesa mais do que um argumento racional isolado.",
    aplicacao: {
      ads: "Use quando o briefing sustentar uma identidade de grupo clara (ex.: 'pra quem decidiu levar isso a sério').",
      email: "Reforce que o leitor faz parte de um grupo que já deu o primeiro passo (a lista, a comunidade, os inscritos).",
      landingPage: "Seção de posicionamento pode nomear o grupo/identidade que o produto serve, não só o problema que resolve.",
      criativo: "Frase de identidade curta funciona bem como legenda ou apoio visual.",
    },
    exemplo: "\"Isso aqui é pra quem já cansou de terceirizar o próprio crescimento.\"",
    alerta: "Só use se o briefing sustentar essa identidade — identidade genérica ('pessoas de sucesso') não gera pertencimento real.",
  },
];

export const CIALDINI_PRINCIPLES_BLOCK = `PRINCÍPIOS DE PERSUASÃO (Cialdini) — use 2-3 por peça, nunca todos de uma vez:
- RECIPROCIDADE: entregue um valor real (insight, diagnóstico, dica) antes de pedir a ação.
- COMPROMISSO E COERÊNCIA: leve o leitor a concordar com algo pequeno (a dor, o objetivo) antes do pedido grande.
- PROVA SOCIAL: mostre que pessoas parecidas com o avatar já agiram — SOMENTE com dado real do briefing, nunca invente número, nome ou depoimento.
- AUTORIDADE: demonstre domínio com especificidade e método, nunca com autoelogio ("sou o melhor").
- AFEIÇÃO: fale a língua do avatar e nomeie a dor dele com precisão cirúrgica.
- ESCASSEZ: destaque o custo real de não agir agora — SOMENTE com prazo/vaga real do briefing, nunca urgência genérica ou inventada.
- UNIDADE: reforce pertencimento a um grupo/identidade ("pra quem decidiu...") quando o briefing sustentar esse ângulo.
Regra de ouro: 2-3 gatilhos bem aplicados convertem; empilhar todos na mesma peça soa manipulador e derruba a confiança.`;
