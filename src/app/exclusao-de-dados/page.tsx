import type { Metadata } from "next";
import { LegalPage } from "../components/LegalPage";
import { LEGAL } from "../lib/legal";

export const metadata: Metadata = { title: "Exclusão de Dados | WevyFlow" };

export default function Page() {
  return (
    <LegalPage
      title="Exclusão de Dados"
      intro={`Você pode apagar os dados que a ${LEGAL.product} guarda sobre você, no todo ou só os que vieram do Meta ou do YouTube. Veja as opções abaixo.`}
    >
      <section>
        <h2>1. Apagar os dados do Meta ou do YouTube (imediato)</h2>
        <ol>
          <li>Entre na {LEGAL.product} e abra <strong>Anúncios</strong>.</li>
          <li>Escolha a aba <strong>Facebook</strong> ou <strong>YouTube</strong>.</li>
          <li>Clique em <strong>Desconectar</strong>.</li>
        </ol>
        <p className="mt-3">
          Ao desconectar, apagamos na hora a conexão e tudo o que veio dela: anúncios, vídeos, resultados, análises, registros de testes e as cópias de imagens guardadas.
          Também revogamos o acesso no Meta ou no Google.
        </p>
      </section>

      <section>
        <h2>2. Remover o acesso direto na sua conta Meta ou Google</h2>
        <ul>
          <li><strong>Facebook:</strong> em Configurações, Integrações empresariais, remova o aplicativo <strong>WevyFlow</strong>. Ao fazer isso, a Meta nos avisa e apagamos automaticamente os dados dessa conexão.</li>
          <li><strong>Google/YouTube:</strong> em <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">myaccount.google.com/permissions</a>, remova o acesso do <strong>WevyFlow</strong>. Depois, use o passo 1 ou o pedido abaixo para apagar o que já foi guardado.</li>
        </ul>
      </section>

      <section>
        <h2>3. Apagar a conta e todos os dados</h2>
        <p>
          Envie um e-mail para <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> com o assunto <strong>&quot;Exclusão de dados&quot;</strong>, a partir do e-mail cadastrado na sua conta.
          Apagamos a conta, os briefings, as copies, as imagens e todos os dados associados, e confirmamos por e-mail em até <strong>15 dias</strong>.
        </p>
      </section>

      <section>
        <h2>4. Pedidos pelo Facebook</h2>
        <p>
          Quando a exclusão é solicitada pelo próprio Facebook, devolvemos um <strong>código de confirmação</strong> e um endereço para acompanhar o andamento. A exclusão dos dados
          do Meta é concluída no ato do pedido.
        </p>
      </section>

      <section>
        <h2>5. O que não conseguimos apagar de imediato</h2>
        <p>
          Registros mínimos de segurança e de cobrança podem ser mantidos pelo prazo exigido por lei. Cópias de segurança são substituídas em ciclos regulares e deixam de conter os dados
          apagados em até 30 dias.
        </p>
      </section>

      <section>
        <h2>Mais informações</h2>
        <p>Veja também a <a href="/privacidade">Política de Privacidade</a> e os <a href="/termos">Termos de Uso</a>.</p>
      </section>
    </LegalPage>
  );
}
