export type ObjetivoCampanha =
  | "RECONHECIMENTO"
  | "TRAFEGO"
  | "ENGAJAMENTO"
  | "LEADS"
  | "PROMOCAO_APP"
  | "VENDAS";

export const OBJETIVOS: {
  valor: ObjetivoCampanha;
  titulo: string;
  descricao: string;
}[] = [
  {
    valor: "RECONHECIMENTO",
    titulo: "Reconhecimento",
    descricao:
      "Mostra o anúncio ao maior número possível de pessoas do público escolhido, para tornar a marca ou o produto conhecidos. Não busca ação imediata.",
  },
  {
    valor: "TRAFEGO",
    titulo: "Tráfego",
    descricao:
      "Leva o maior número possível de pessoas até um destino escolhido por você (site, página de vendas, link externo).",
  },
  {
    valor: "ENGAJAMENTO",
    titulo: "Engajamento",
    descricao:
      "Busca curtidas, comentários, compartilhamentos, visualizações de vídeo até o fim, ou início de conversas.",
  },
  {
    valor: "LEADS",
    titulo: "Leads",
    descricao:
      "Capta nome, telefone e e-mail da pessoa interessada direto dentro do próprio anúncio, via formulário rápido, sem sair do Instagram/Facebook.",
  },
  {
    valor: "PROMOCAO_APP",
    titulo: "Promoção do app",
    descricao: "Voltado a quem tem aplicativo próprio; busca instalações ou retorno de uso.",
  },
  {
    valor: "VENDAS",
    titulo: "Vendas",
    descricao:
      "Busca o máximo de vendas possível com a verba investida, no site, dentro do Instagram/Facebook, ou via WhatsApp.",
  },
];

export const DESTINOS_CONVERSA = [
  { valor: "WHATSAPP", titulo: "WhatsApp" },
  { valor: "INSTAGRAM_DIRECT", titulo: "Instagram Direct" },
  { valor: "MESSENGER", titulo: "Messenger" },
] as const;
