import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";
import { LEGAL } from "../lib/legal";

export const metadata: Metadata = { title: "Política de Privacidade | WevyFlow" };

export default function Page() {
  return (
    <LegalPage
      title="Política de Privacidade"
      intro={`Esta política explica quais dados a ${LEGAL.product} coleta, para que usa, com quem compartilha e como você pode controlá-los. A ${LEGAL.product} é operada por ${LEGAL.operator} e está disponível em ${LEGAL.site.replace("https://", "")}.`}
    >
      <section>
        <h2>1. Dados que coletamos</h2>
        <ul>
          <li><strong>Conta:</strong> e-mail e identificador de acesso, usados para entrar na plataforma (por e-mail ou pela sua conta Google).</li>
          <li><strong>Conteúdo que você cria ou envia:</strong> briefings de lançamento, textos, imagens, logotipos, fotos de referência e as peças geradas.</li>
          <li><strong>Dados de anúncios do Meta (Facebook e Instagram), se você conectar:</strong> anúncios da conta escolhida (textos, imagens, status, datas) e seus resultados diários (gasto, impressões, cliques, compras, receita e métricas de vídeo).</li>
          <li><strong>Dados do YouTube, se você conectar:</strong> informações públicas e de desempenho do seu canal: lista de vídeos, títulos, thumbnails, visualizações, tempo assistido, retenção, curtidas, comentários e inscritos ganhos.</li>
          <li><strong>Arquivos que você importa:</strong> o relatório CSV do YouTube Studio (impressões e taxa de cliques) e os registros de testes A/B que você anota.</li>
          <li><strong>Uso e créditos:</strong> quantidade de gerações e créditos consumidos, para controlar o seu plano.</li>
        </ul>
      </section>

      <section>
        <h2>2. Como usamos esses dados</h2>
        <ul>
          <li>Para entregar as funções que você pediu: gerar copy, imagens e emails, analisar criativos e thumbnails, e mostrar o desempenho dos seus anúncios e vídeos.</li>
          <li>Para manter a sua conta, o seu plano e a segurança do serviço.</li>
          <li>Não vendemos os seus dados, não os usamos para publicidade e não os compartilhamos com terceiros para fins de marketing.</li>
        </ul>
      </section>

      <section>
        <h2>3. Acesso ao Meta e ao YouTube (somente leitura)</h2>
        <p>
          A conexão com o Meta usa apenas a permissão <strong>ads_read</strong>, e a conexão com o YouTube usa apenas as permissões
          <strong> youtube.readonly</strong> e <strong>yt-analytics.readonly</strong>. A {LEGAL.product} <strong>não publica, não edita e não exclui</strong> nada
          nos seus anúncios nem no seu canal. As chaves de acesso ficam guardadas de forma criptografada e só o nosso servidor consegue usá-las.
        </p>
        <p className="mt-3">
          O uso e a transferência, para qualquer outro aplicativo, das informações recebidas das APIs do Google seguirão a
          {" "}<a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">Política de Dados do Usuário dos Serviços de API do Google</a>,
          incluindo os requisitos de Uso Limitado. (The use and transfer to any other app of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.)
        </p>
        <p className="mt-3">Os dados do YouTube são usados somente para mostrar o desempenho do seu canal e analisar as suas thumbnails dentro da {LEGAL.product}. Não são usados para publicidade nem vendidos.</p>
      </section>

      <section>
        <h2>4. Inteligência artificial</h2>
        <p>
          Para gerar e analisar conteúdo, enviamos o necessário (por exemplo, o briefing, uma imagem de anúncio ou uma thumbnail) a provedores de IA contratados por API,
          como Anthropic, OpenAI e Google (Gemini). Esses provedores processam o conteúdo para devolver o resultado e seguem os próprios termos de uso de API.
          A {LEGAL.product} não usa os seus dados para treinar modelos próprios.
        </p>
      </section>

      <section>
        <h2>5. Onde os dados ficam e quem os processa</h2>
        <ul>
          <li><strong>Supabase:</strong> banco de dados, autenticação e armazenamento de arquivos.</li>
          <li><strong>Vercel:</strong> hospedagem da aplicação.</li>
          <li><strong>Provedores de IA</strong> citados acima, no momento de cada geração ou análise.</li>
        </ul>
        <p className="mt-3">Esses serviços podem processar dados fora do Brasil. Adotamos apenas provedores que oferecem salvaguardas adequadas de segurança.</p>
      </section>

      <section>
        <h2>6. Por quanto tempo guardamos</h2>
        <p>
          Guardamos os dados enquanto a sua conta estiver ativa. Ao <strong>desconectar o Meta ou o YouTube</strong>, apagamos os anúncios, vídeos, resultados, análises e as cópias de
          imagens que vieram dessa conexão. Você também pode pedir a exclusão completa da conta (veja a página de{" "}
          <a href="/exclusao-de-dados">exclusão de dados</a>).
        </p>
      </section>

      <section>
        <h2>7. Segurança</h2>
        <p>
          Usamos conexão criptografada (HTTPS), controle de acesso por usuário no banco de dados (cada pessoa só acessa os próprios dados) e criptografia das chaves de acesso
          ao Meta e ao Google. Nenhum sistema é totalmente imune a falhas; em caso de incidente relevante, avisaremos os usuários afetados.
        </p>
      </section>

      <section>
        <h2>8. Cookies</h2>
        <p>Usamos apenas cookies essenciais, para manter a sua sessão e proteger o fluxo de login com Meta e Google. Não usamos cookies de publicidade.</p>
      </section>

      <section>
        <h2>9. Seus direitos (LGPD)</h2>
        <p>Você pode, a qualquer momento, confirmar se tratamos seus dados, acessá-los, corrigi-los, pedir a portabilidade, a anonimização ou a exclusão, e revogar consentimentos. Para isso, escreva para <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>. Respondemos em até 15 dias.</p>
      </section>

      <section>
        <h2>10. Crianças e adolescentes</h2>
        <p>A {LEGAL.product} é voltada a profissionais e empresas. Não coletamos dados de menores de 18 anos de forma intencional.</p>
      </section>

      <section>
        <h2>11. Mudanças nesta política</h2>
        <p>Podemos atualizar esta política. A data da última atualização fica no topo da página, e mudanças relevantes serão comunicadas dentro da plataforma.</p>
      </section>

      <section>
        <h2>12. Contato</h2>
        <p>Dúvidas ou pedidos sobre privacidade: <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.</p>
      </section>
    </LegalPage>
  );
}
