import type { Metadata } from "next";
import { DocumentoLegal, Lista, P, Secao } from "@/components/legal/documento-legal";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Política de privacidade · Nuvra.AI",
  description: "Como a Nuvra.AI coleta, usa, protege e exclui os seus dados.",
};

export default function PaginaPrivacidade() {
  return (
    <DocumentoLegal titulo="Política de privacidade">
      <Secao titulo="1. Quem somos">
        <P>
          A {EMPRESA.nomeFantasia} é operada por {EMPRESA.razaoSocial}, CNPJ {EMPRESA.cnpj}, com sede em{" "}
          {EMPRESA.endereco} (&quot;Nuvra&quot;). Esta política explica quais dados pessoais tratamos, para quê, com quem
          compartilhamos e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados (LGPD, Lei
          13.709/2018). Para assuntos de privacidade, fale com {EMPRESA.emailPrivacidade}.
        </P>
      </Secao>

      <Secao titulo="2. Dados que coletamos">
        <Lista
          itens={[
            "Dados da conta: nome, e-mail e senha. Guardamos apenas uma versão protegida (hash) da senha, nunca a senha em si.",
            "Dados da sua conta de anúncio, quando você a conecta pelo Login do Facebook: identificadores das contas de anúncio e Páginas que você autorizar, campanhas, gastos e métricas de desempenho. Nunca recebemos a sua senha do Facebook.",
            "Conteúdo que você envia: imagens e vídeos de anúncios, textos e mensagens de voz. O áudio é usado apenas para gerar a transcrição e não é armazenado; guardamos o texto transcrito.",
            "Identificador da sua conta no Telegram (e, no futuro, o número do WhatsApp) para conversar com você.",
            "Dados técnicos e de segurança: endereço IP, tipo de navegador e registros de acessos e ações na conta.",
          ]}
        />
      </Secao>

      <Secao titulo="3. Para que usamos os dados">
        <Lista
          itens={[
            "Prestar o serviço contratado: analisar seus criativos, montar propostas de campanha, publicar após a sua aprovação, acompanhar resultados e enviar relatórios (execução de contrato).",
            "Manter a segurança da conta, prevenir fraudes e abusos (legítimo interesse e proteção do crédito e da segurança).",
            "Cumprir obrigações legais e regulatórias, como as fiscais.",
            "Melhorar as recomendações do serviço com dados de desempenho agregados e anonimizados, que não identificam você nem o seu negócio (legítimo interesse).",
          ]}
        />
        <P>Não vendemos os seus dados pessoais nem os usamos para publicidade de terceiros.</P>
      </Secao>

      <Secao titulo="4. Com quem compartilhamos">
        <P>Compartilhamos dados apenas com empresas que nos ajudam a prestar o serviço, na medida necessária:</P>
        <Lista
          itens={[
            "Meta Platforms (Facebook e Instagram): para criar e gerenciar os seus anúncios e ler resultados, sempre com a sua autorização.",
            "Provedores de infraestrutura e hospedagem (DigitalOcean).",
            "Anthropic (inteligência artificial): processa criativos, textos e transcrições para gerar análises e propostas.",
            "Envio de e-mails (Brevo): confirmação de conta, recuperação de senha e avisos de segurança.",
            "Telegram (e, no futuro, WhatsApp/Meta): canal de conversa com você.",
            "Autoridades, quando houver obrigação legal ou ordem judicial.",
          ]}
        />
      </Secao>

      <Secao titulo="5. Transferência internacional">
        <P>
          Alguns desses provedores estão fora do Brasil. Nesses casos, adotamos as salvaguardas previstas na LGPD para
          que os seus dados tenham nível de proteção adequado.
        </P>
      </Secao>

      <Secao titulo="6. Como protegemos os seus dados">
        <Lista
          itens={[
            "Conexão protegida por HTTPS.",
            "Senhas armazenadas com algoritmo de hash forte (Argon2id); verificamos também se a senha escolhida já apareceu em vazamentos públicos, sem enviar a senha a ninguém.",
            "Os dados de cada cliente são isolados uns dos outros no banco de dados.",
            "Tokens de acesso à sua conta de anúncio armazenados de forma criptografada.",
            "Controle de acesso, limite de tentativas de login, sessões que você pode encerrar e registro de auditoria.",
          ]}
        />
        <P>Nenhum sistema é totalmente imune a riscos. Se ocorrer um incidente relevante, avisaremos você e a autoridade competente, como a lei exige.</P>
      </Secao>

      <Secao titulo="7. Por quanto tempo guardamos">
        <P>
          Enquanto a sua conta estiver ativa e, depois, pelo tempo necessário para cumprir obrigações legais, exercer
          direitos em processos e resolver disputas. Ao excluir a conta, apagamos ou anonimizamos os dados, exceto os
          que a lei nos obriga a manter.
        </P>
      </Secao>

      <Secao titulo="8. Seus direitos">
        <P>Você pode pedir, a qualquer momento e gratuitamente:</P>
        <Lista
          itens={[
            "confirmação de que tratamos seus dados e acesso a eles;",
            "correção de dados incompletos ou desatualizados;",
            "anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei;",
            "portabilidade dos dados;",
            "informação sobre com quem compartilhamos;",
            "revogação de consentimentos e revisão de decisões automatizadas.",
          ]}
        />
        <P>
          Escreva para {EMPRESA.emailPrivacidade}. Para excluir seus dados, veja também a página{" "}
          <a className="text-accent hover:underline" href="/exclusao-de-dados">
            Exclusão de dados
          </a>
          . Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).
        </P>
      </Secao>

      <Secao titulo="9. Conexão com o Facebook">
        <P>
          Ao conectar sua conta de anúncio, você escolhe na tela da Meta quais contas de anúncio e Páginas autoriza.
          Usamos essa autorização somente para as funções descritas acima. Você pode revogá-la a qualquer momento: na
          Nuvra, em &quot;Desconectar&quot;, ou no Facebook, em Configurações &gt; Integrações comerciais, removendo a Nuvra.AI.
        </P>
      </Secao>

      <Secao titulo="10. Cookies">
        <P>
          Usamos apenas um cookie essencial para manter você conectado com segurança. Não usamos cookies de
          publicidade nem de rastreamento de terceiros.
        </P>
      </Secao>

      <Secao titulo="11. Público e alterações">
        <P>
          O serviço é destinado a maiores de 18 anos. Podemos atualizar esta política; a data no topo da página indica a
          última versão e, em mudanças relevantes, avisaremos por e-mail.
        </P>
      </Secao>
    </DocumentoLegal>
  );
}
