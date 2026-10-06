import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";
import { LEGAL } from "../lib/legal";

export const metadata: Metadata = { title: "Termos de Uso | WevyFlow" };

export default function Page() {
  return (
    <LegalPage
      title="Termos de Uso"
      intro={`Ao criar uma conta ou usar a ${LEGAL.product}, você concorda com estes termos. A plataforma é operada por ${LEGAL.operator}. Se não concordar, não use o serviço.`}
    >
      <section>
        <h2>1. O que é a {LEGAL.product}</h2>
        <p>
          Uma plataforma para criar e organizar a comunicação de lançamentos digitais: narrativa e marca do lançamento, copy, emails, imagens e criativos, e análise do
          desempenho de anúncios e vídeos conectados por você. A geração de conteúdo é feita com apoio de inteligência artificial.
        </p>
      </section>

      <section>
        <h2>2. Conta e responsabilidade de acesso</h2>
        <ul>
          <li>Você é responsável pelas informações da sua conta e por tudo o que acontece com ela.</li>
          <li>Você deve ter 18 anos ou mais, ou estar representando uma empresa.</li>
          <li>Não compartilhe o acesso com terceiros sem autorização.</li>
        </ul>
      </section>

      <section>
        <h2>3. Planos, créditos e pagamento</h2>
        <p>
          O uso das funções de geração e análise consome créditos do plano contratado, conforme a tabela exibida na plataforma. Créditos não utilizados no mês não se acumulam.
          Gerações que falham são devolvidas. Podemos alterar preços e limites de planos, com aviso prévio dentro da plataforma.
        </p>
      </section>

      <section>
        <h2>4. Conteúdo gerado por IA</h2>
        <ul>
          <li>O resultado da IA pode conter erros, imprecisões e variações. <strong>Revise tudo antes de publicar.</strong></li>
          <li>Você é o responsável pelo uso do conteúdo gerado e por cumprir as regras das plataformas onde ele for publicado (como as políticas de anúncios do Meta e as diretrizes do YouTube), além da legislação aplicável.</li>
          <li>Não gere nem envie conteúdo que viole direitos de terceiros, use a imagem de pessoas sem autorização, faça promessas enganosas de renda, saúde ou resultado, ou seja ilegal.</li>
          <li>Análises de desempenho e hipóteses sugeridas são apoio à decisão e <strong>não garantem aumento de vendas, visualizações ou cliques</strong>.</li>
        </ul>
      </section>

      <section>
        <h2>5. Seu conteúdo</h2>
        <p>
          O que você envia e cria continua sendo seu. Você nos autoriza a processá-lo, inclusive por provedores de IA, apenas para prestar o serviço, conforme a{" "}
          <a href="/privacidade">Política de Privacidade</a>. Você declara ter os direitos necessários sobre os arquivos que envia.
        </p>
      </section>

      <section>
        <h2>6. Conexões com Meta e YouTube</h2>
        <p>
          Ao conectar o Meta Ads ou o YouTube, você autoriza a leitura dos dados descritos na política de privacidade, somente para uso dentro da sua conta. A conexão é só de leitura:
          a {LEGAL.product} não publica nem altera nada. Você pode desconectar quando quiser, e os dados dessa conexão serão apagados. O uso desses serviços também está sujeito aos termos do Meta e do Google/YouTube.
        </p>
      </section>

      <section>
        <h2>7. Uso aceitável</h2>
        <ul>
          <li>Não tente burlar limites, créditos ou mecanismos de segurança.</li>
          <li>Não faça engenharia reversa, scraping do serviço ou uso que sobrecarregue a plataforma.</li>
          <li>Não use a plataforma para enviar spam, fraudes ou conteúdo que cause dano a terceiros.</li>
        </ul>
        <p className="mt-3">Podemos suspender contas que violem estes termos.</p>
      </section>

      <section>
        <h2>8. Disponibilidade e limitação de responsabilidade</h2>
        <p>
          Fazemos o possível para manter o serviço no ar, mas ele é oferecido &quot;como está&quot;, e pode haver interrupções, inclusive de serviços de terceiros dos quais dependemos
          (Meta, Google, provedores de IA e de hospedagem). Na medida permitida pela lei, a {LEGAL.product} não responde por lucros cessantes, perda de verba de anúncios,
          reprovações de anúncios ou danos indiretos decorrentes do uso do serviço.
        </p>
      </section>

      <section>
        <h2>9. Cancelamento e exclusão</h2>
        <p>Você pode parar de usar a plataforma a qualquer momento e pedir a exclusão dos seus dados pela página de <a href="/exclusao-de-dados">exclusão de dados</a>.</p>
      </section>

      <section>
        <h2>10. Mudanças nos termos</h2>
        <p>Podemos atualizar estes termos. Se as mudanças forem relevantes, avisaremos dentro da plataforma. Continuar usando o serviço significa aceitar a nova versão.</p>
      </section>

      <section>
        <h2>11. Lei aplicável e contato</h2>
        <p>Estes termos seguem a legislação brasileira. Dúvidas: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.</p>
      </section>
    </LegalPage>
  );
}
