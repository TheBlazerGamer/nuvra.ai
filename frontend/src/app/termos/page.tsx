import type { Metadata } from "next";
import { DocumentoLegal, Lista, P, Secao } from "@/components/legal/documento-legal";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Termos de uso · Nuvra.AI",
  description: "As regras de uso do serviço de gestão de anúncios com inteligência artificial da Nuvra.AI.",
};

export default function PaginaTermos() {
  return (
    <DocumentoLegal titulo="Termos de uso">
      <Secao titulo="1. Aceitação">
        <P>
          Ao criar uma conta ou usar a {EMPRESA.nomeFantasia}, operada por {EMPRESA.razaoSocial} (CNPJ {EMPRESA.cnpj}),
          você concorda com estes termos e com a{" "}
          <a className="text-accent hover:underline" href="/privacidade">
            Política de privacidade
          </a>
          . Se não concordar, não use o serviço.
        </P>
      </Secao>

      <Secao titulo="2. O que é o serviço">
        <P>
          A Nuvra.AI usa inteligência artificial para analisar seus criativos, propor campanhas de anúncios no
          Facebook e Instagram (público, posicionamento, texto e orçamento), publicá-las na sua conta de anúncio
          depois da sua aprovação, e acompanhar os resultados, tudo por conversa (texto ou áudio) e por um site de
          acompanhamento.
        </P>
      </Secao>

      <Secao titulo="3. Sua conta">
        <Lista
          itens={[
            "É preciso ter 18 anos ou mais e informar dados verdadeiros.",
            "Você é responsável por manter a senha em segredo e por tudo o que acontece na sua conta. Avise-nos imediatamente se suspeitar de uso indevido.",
            "Precisamos que você confirme seu e-mail para liberar alguns recursos.",
          ]}
        />
      </Secao>

      <Secao titulo="4. Nada é publicado sem a sua aprovação">
        <P>
          Antes de enviar qualquer anúncio à Meta, mostramos a você o criativo, o texto, a estratégia e o orçamento.
          A campanha só é publicada depois da sua confirmação. Confira sempre a proposta com atenção: ao aprovar, você
          assume o conteúdo e o valor.
        </P>
      </Secao>

      <Secao titulo="5. Sua conta de anúncio e seus gastos">
        <Lista
          itens={[
            "A conta de anúncio é sua. O pagamento dos anúncios é cobrado pela Meta no método de pagamento que você cadastrou nela; a Nuvra não movimenta o dinheiro dos seus anúncios.",
            "Você define um limite de gasto. Ao chegar nele, pausamos os anúncios. Como a Meta atualiza os relatórios de gasto com algum atraso, pode haver uma pequena diferença até a pausa, e o valor final é o que a Meta apurar.",
            "Você é responsável por manter saldo/forma de pagamento válidos na Meta e por acompanhar os gastos.",
          ]}
        />
      </Secao>

      <Secao titulo="6. Conteúdo e regras da Meta">
        <P>
          Você declara ter direito de usar as imagens, vídeos e textos que enviar (incluindo imagens de pessoas e
          marcas de terceiros) e se compromete a cumprir as Políticas de Publicidade da Meta e a lei. Não use o serviço
          para conteúdo ilegal, enganoso ou proibido. Podemos recusar propostas que violem essas regras e suspender
          contas em caso de abuso.
        </P>
      </Secao>

      <Secao titulo="7. Limites da inteligência artificial">
        <P>
          A IA pode errar e as análises são recomendações, não garantias. Não prometemos resultados específicos de
          vendas, leads ou alcance: o desempenho depende do mercado, do orçamento, do criativo e de decisões da própria
          Meta.
        </P>
      </Secao>

      <Secao titulo="8. Planos e pagamento">
        <P>
          Os planos, preços e condições (como período de teste e reembolso) são os exibidos na página de planos no
          momento da contratação. Não cobramos taxa de implantação. Reajustes serão comunicados com antecedência.
        </P>
      </Secao>

      <Secao titulo="9. Cancelamento">
        <P>
          Você pode cancelar quando quiser, sem multa. Ao cancelar, o acesso segue até o fim do período já pago.
          Campanhas ativas na sua conta de anúncio continuam sob seu controle na Meta; pause-as se não quiser que
          continuem gastando.
        </P>
      </Secao>

      <Secao titulo="10. Disponibilidade">
        <P>
          Trabalhamos para manter o serviço disponível, mas ele pode ficar indisponível por manutenção ou por falhas de
          terceiros (como a Meta, o Telegram e provedores de infraestrutura).
        </P>
      </Secao>

      <Secao titulo="11. Propriedade intelectual">
        <P>
          A marca, o software e a identidade visual da Nuvra.AI pertencem à Nuvra. Você mantém a propriedade dos seus
          conteúdos e nos autoriza a usá-los apenas para prestar o serviço.
        </P>
      </Secao>

      <Secao titulo="12. Limitação de responsabilidade">
        <P>
          Na extensão permitida pela lei, a Nuvra não responde por lucros cessantes, perda de oportunidades ou por
          decisões de plataformas de terceiros (como bloqueio de contas de anúncio pela Meta). Nada aqui limita direitos
          que a lei do consumidor garante a você.
        </P>
      </Secao>

      <Secao titulo="13. Alterações, lei aplicável e contato">
        <P>
          Podemos atualizar estes termos e avisaremos sobre mudanças relevantes. Estes termos são regidos pela lei
          brasileira, e fica eleito o foro de {EMPRESA.cidadeForo}, ressalvado o foro do consumidor. Contato:{" "}
          {EMPRESA.emailContato}.
        </P>
      </Secao>
    </DocumentoLegal>
  );
}
