import { resolveConfig, callOnce, parseApiError } from "../../lib/ai-client";

export const maxDuration = 60;

type EmailSequenceType = "cpl" | "vendas" | "recuperacao";

interface EmailItem {
  subject: string;
  subject_b?: string;
  subject_c?: string;
  preview: string;
  preview_b?: string;
  body: string;
  cta?: string;
  cta_b?: string;
  ps?: string;
}

const SEQUENCE_CONFIGS: Record<EmailSequenceType, { count: number; label: string; structure: string }> = {
  cpl: {
    count: 5,
    label: "Pré-Lançamento (CPL)",
    structure: `
Email 1 — História e Origem
  Ângulo emocional: empatia + identificação
  Objeção dominante: "Quem é você para me ensinar isso?"
  Conte a história real de transformação do criador — com vulnerabilidade genuína. Termine abrindo um loop sobre o método que será revelado depois.

Email 2 — Diagnóstico da Dor
  Ângulo emocional: medo de continuar como está
  Objeção dominante: "Já tentei antes e não funcionou"
  Descreva em detalhes a dor que o avatar vive todo dia. Faça-os sentirem que você sabe exatamente como é. Nomeie o inimigo real (sistema, mercado, crença limitante).

Email 3 — O Mecanismo Único
  Ângulo emocional: curiosidade + esperança
  Objeção dominante: "Mais um método igual aos outros"
  Revele o mecanismo diferenciador sem entregar o produto. Explique por que tudo que tentaram antes falhou e o que é diferente aqui.

Email 4 — Prova Social
  Ângulo emocional: desejo de pertencer + prova concreta
  Objeção dominante: "Funciona para outros mas não vai funcionar para mim"
  Use depoimentos específicos: resultado concreto + nome + contexto de vida real. Mostre diversidade de perfis que alcançaram a transformação.

Email 5 — Pré-anúncio
  Ângulo emocional: antecipação + escassez implícita
  Objeção dominante: "Vou pensar e compro depois"
  Crie antecipação real. Dê preview do que estará disponível amanhã. Prepare mentalmente para a oferta. Insira urgência sem revelar preço.`,
  },
  vendas: {
    count: 7,
    label: "Sequência de Vendas",
    structure: `
Email 1 — Abertura do Carrinho
  Ângulo emocional: conquista + alívio ("chegou a hora")
  Objeção dominante: "Preciso pensar melhor antes de decidir"
  Apresente a oferta completa com todo o stack de valor. Mostre o que está incluído. CTA direto ao checkout.

Email 2 — O Custo da Inação
  Ângulo emocional: medo do status quo / custo de não agir
  Objeção dominante: "Tenho medo de investir e não ter resultado"
  Calcule o custo real de continuar igual por mais 6 meses, 1 ano. Mostre o que perdem a cada dia que não agem.

Email 3 — Quebrando a Objeção Principal
  Ângulo emocional: compreensão + validação + solução
  Objeção dominante: adapte para o nicho — "não tenho tempo" / "já gastei muito" / "não é pra mim"
  Antecipe a objeção, valide a preocupação, quebre com dado ou história real. Nunca minimize a objeção.

Email 4 — Urgência Real
  Ângulo emocional: escassez crível
  Objeção dominante: "Posso comprar depois / na próxima turma"
  Mostre que existe prazo ou limite real com consequência concreta. Nunca invente urgência — contextualize a real.

Email 5 — Stack Completo de Valor
  Ângulo emocional: ganância estratégica + senso de vantagem
  Objeção dominante: "O preço está alto"
  Reapresente o stack com valores individuais de cada item. Ancoragem de preço. Bônus que expira antes do fechamento.

Email 6 — Últimas 24 Horas
  Ângulo emocional: FOMO + identidade
  Objeção dominante: "Deixo para amanhã"
  Escassez real, consequência concreta de não agir. Tom mais direto. Mostre o que perdem especificamente.

Email 7 — Último Chamado
  Ângulo emocional: decisão de identidade (quem você quer ser?)
  Objeção dominante: "Não é o momento certo"
  Email mais curto. Tom direto e final. Uma decisão sobre identidade e futuro. Fecha às [horário]. Sem apelo emocional manipulativo — apenas clareza.`,
  },
  recuperacao: {
    count: 3,
    label: "Recuperação de Carrinho",
    structure: `
Email 1 — 1h após abandono
  Ângulo emocional: remoção de fricção (neutro, sem pressão)
  Objeção dominante: "Tive um problema técnico" / "Mudei de ideia no último segundo"
  Tom leve, sem venda agressiva. "Vi que você começou mas não finalizou." Remova objeções técnicas. Link direto ao ponto onde parou.

Email 2 — 24h após abandono
  Ângulo emocional: bônus exclusivo + nova oportunidade
  Objeção dominante: "O preço estava alto / não vi valor suficiente"
  Adicione um bônus exclusivo para quem voltar agora — algo específico e valioso. Reforce urgência real.

Email 3 — 48h após abandono
  Ângulo emocional: última chance real + consequência de esperar
  Objeção dominante: "Vou esperar a próxima turma / próxima chance"
  Informe a data de fechamento real com horário. Mostre o custo real de esperar. CTA de máxima urgência — curto e direto.`,
  },
};

const EMAIL_SYSTEM = `Você é um copywriter sênior especialista em e-mail marketing de resposta direta para o mercado brasileiro de infoprodutos. Você domina a psicologia do avatar, escreve para uma única pessoa — nunca para uma lista — e sabe que o único objetivo de cada email é levar o leitor ao próximo passo.

PRINCÍPIO FUNDADOR:
"Assunto vende abertura. Abertura vende leitura. Leitura vende clique."
Um email = um objetivo = um link.

ETAPA 1 — DIAGNÓSTICO INTERNO (execute mentalmente antes de escrever cada email):
→ Qual é a promessa central do produto para este avatar específico?
→ Em que estágio de consciência a lista está neste email?
→ Qual é o objetivo único deste email?
→ Qual é a objeção dominante que este email precisa quebrar?
→ Qual é o ângulo emocional correto para este momento?
→ O que o leitor precisa sentir ao terminar a leitura?

ETAPA 2 — ARQUITETURA DE CADA EMAIL (estrutura obrigatória):

1. ASSUNTO (máx. 50 caracteres)
   — Não deve soar como marketing óbvio ou newsletter corporativa
   — Tipos que funcionam: pergunta que toca a dor | afirmação surpreendente | gancho de história incompleta | urgência implícita
   — Gere 3 variações com ângulos diferentes (A: curiosidade / B: benefício direto / C: urgência ou medo de perder)

2. PRÉ-HEADER (60-80 caracteres)
   — Complementa o assunto — nunca repete palavras do assunto
   — Abre um loop mental que só fecha quando o email é lido
   — Gere 2 variações

3. ABERTURA (1-3 linhas)
   — Começa IN MEDIA RES: no meio de uma situação real, emoção ou fato impactante
   — NUNCA comece com: "Olá", "Oi", "Espero que esteja bem", "Hoje quero falar", "Como vai você"
   — Abre um loop que obriga a continuar lendo

4. CORPO (200-300 palavras)
   — Parágrafos de no máximo 3 linhas, um raciocínio por parágrafo
   — Linguagem coloquial mas inteligente — português brasileiro direto, com personalidade
   — Fluxo: situação → complicação → insight → possibilidade → ação
   — Inclua 1 prova concreta quando relevante (dado, resultado, fragmento de depoimento)

5. PONTE
   — 1 frase de transição que cria expectativa lógica para o CTA

6. CTA ÚNICO (1 ação, 1 link)
   — Em 1ª pessoa, ação clara e específica
   — Exemplos: "Quero garantir minha vaga agora", "Sim, quero isso", "Continuar lendo aqui"
   — Gere 2 variações

7. P.S. ESTRATÉGICO
   — Reforça o benefício principal OU cria urgência final OU quebra a última objeção
   — 1-2 linhas. Nunca genérico ("Qualquer dúvida me chame").

REGRAS ABSOLUTAS:
1. Responda APENAS com JSON válido no formato abaixo — sem texto antes ou depois
2. Campos obrigatórios por email: subject, subject_b, subject_c, preview, preview_b, body, cta, cta_b, ps
3. body: parágrafos separados por \\n\\n. Sem HTML. Sem markdown.
4. Zero emojis em qualquer campo
5. Escreva como se fosse para uma única pessoa específica — nunca "vocês"
6. Nenhum email começa com saudação genérica
7. Nenhum email soa como newsletter corporativa ou automação óbvia
8. Português brasileiro natural — direto, humano, com personalidade

FORMATO DE SAÍDA:
{"emails":[{"subject":"...","subject_b":"...","subject_c":"...","preview":"...","preview_b":"...","body":"...","cta":"...","cta_b":"...","ps":"..."},...]}`;

export type { EmailItem };

export async function POST(request: Request) {
  const {
    brandInfo,
    sequenceType,
    apiKey,
    aiProvider,
    aiModel,
  }: {
    brandInfo: {
      productName: string;
      niche: string;
      targetAudience: string;
      transformation: string;
      primaryColor?: string;
      mecanismo?: string;
      preco?: string;
      provas?: string;
    };
    sequenceType: EmailSequenceType;
    apiKey?: string;
    aiProvider?: string;
    aiModel?: string;
  } = await request.json();

  if (!brandInfo || !sequenceType) {
    return Response.json({ error: "brandInfo e sequenceType são obrigatórios" }, { status: 400 });
  }

  const cfg = SEQUENCE_CONFIGS[sequenceType];
  if (!cfg) {
    return Response.json({ error: "sequenceType inválido" }, { status: 400 });
  }

  const aiConfig = resolveConfig(apiKey, aiProvider, aiModel);

  const copyLines = [
    brandInfo.mecanismo ? `— Mecanismo único: ${brandInfo.mecanismo}` : "",
    brandInfo.preco     ? `— Preço + âncora: ${brandInfo.preco}` : "",
    brandInfo.provas    ? `— Provas e resultados: ${brandInfo.provas}` : "",
  ].filter(Boolean).join("\n");

  const userMsg = `BRIEFING DO PRODUTO:
— Nome: ${brandInfo.productName}
— Nicho: ${brandInfo.niche}
— Público-alvo: ${brandInfo.targetAudience}
— Transformação prometida: ${brandInfo.transformation}${copyLines ? `\n${copyLines}` : ""}

SEQUÊNCIA: ${cfg.label} — ${cfg.count} emails

Cada email deve ser escrito especificamente para este produto, este nicho e este avatar. Nunca use linguagem genérica — cada palavra deve ressoar com "${brandInfo.targetAudience}" no contexto de "${brandInfo.niche}".${brandInfo.mecanismo ? `\n\nO MECANISMO ÚNICO é "${brandInfo.mecanismo}" — referenciá-lo nas sequências cria consistência e credibilidade.` : ""}${brandInfo.provas ? `\n\nUse as PROVAS REAIS ("${brandInfo.provas}") sempre que possível — nunca invente depoimentos ou números.` : ""}

ESTRUTURA DESTA SEQUÊNCIA — siga a ordem e o ângulo de cada email exatamente:
${cfg.structure}

Gere exatamente ${cfg.count} emails. Para cada email, siga a arquitetura completa dos 7 elementos: subject (3 variações), preview (2 variações), body, cta (2 variações), ps.`;

  try {
    const raw = await callOnce(aiConfig, EMAIL_SYSTEM, userMsg, 8000);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Resposta inválida da IA");
    const parsed = JSON.parse(match[0]) as { emails: EmailItem[] };
    if (!Array.isArray(parsed.emails) || parsed.emails.length === 0) {
      throw new Error("Nenhum email gerado");
    }
    return Response.json({ emails: parsed.emails.slice(0, cfg.count) });
  } catch (e: unknown) {
    const { status, message } = parseApiError(e, aiConfig.provider);
    return Response.json({ error: message }, { status });
  }
}
