import type { Metadata } from "next";
import { DocumentoLegal, Lista, P, Secao } from "@/components/legal/documento-legal";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Exclusão de dados · Nuvra.AI",
  description: "Como pedir a exclusão dos seus dados e desconectar a Nuvra.AI da sua conta do Facebook.",
};

export default function PaginaExclusaoDeDados() {
  return (
    <DocumentoLegal titulo="Exclusão de dados">
      <Secao titulo="Opção 1: desconectar a Nuvra.AI do seu Facebook">
        <P>Você pode remover o acesso a qualquer momento, sem falar com a gente:</P>
        <Lista
          itens={[
            "No Facebook: Configurações e privacidade > Configurações > Integrações comerciais (ou Apps e sites) > selecione Nuvra.AI > Remover.",
            "Ou, na Nuvra.AI, no onboarding/painel, use a opção Desconectar conta de anúncio.",
          ]}
        />
        <P>
          Quando você remove o acesso, a Meta nos avisa e nós apagamos os tokens de acesso e os dados da sua conta de
          anúncio que estavam guardados.
        </P>
      </Secao>

      <Secao titulo="Opção 2: excluir a sua conta e todos os seus dados">
        <Lista
          itens={[
            <>
              Envie um e-mail para <strong>{EMPRESA.emailPrivacidade}</strong> com o assunto &quot;Exclusão de dados&quot;,
              a partir do e-mail cadastrado na sua conta.
            </>,
            "Confirmaremos que o pedido é seu (por segurança) e responderemos em até 15 dias.",
            "Apagamos ou anonimizamos os dados da conta, conversas, criativos, transcrições, tokens e histórico de campanhas.",
          ]}
        />
      </Secao>

      <Secao titulo="O que pode ser mantido">
        <P>
          Alguns dados precisam ser guardados por exigência legal (por exemplo, registros fiscais e de acesso) ou para
          defesa em processos. Eles ficam restritos e são apagados assim que o prazo legal terminar.
        </P>
      </Secao>

      <Secao titulo="Dúvidas">
        <P>
          Fale com {EMPRESA.emailPrivacidade}. Veja também a{" "}
          <a className="text-accent hover:underline" href="/privacidade">
            Política de privacidade
          </a>
          .
        </P>
      </Secao>
    </DocumentoLegal>
  );
}
