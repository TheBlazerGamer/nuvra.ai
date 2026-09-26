// Dados da empresa exibidos nas páginas legais (privacidade, termos, exclusão de dados).
// Preencha TODOS os campos com [PREENCHER...] antes de publicar: `npm run verificar:legal` acusa o que faltar.
export const EMPRESA = {
  nomeFantasia: "Nuvra.AI",
  razaoSocial: "NUVRA LTDA",
  cnpj: "65.310.433/0001-99",
  endereco: "Avenida Tupinambás, 734, sala 734, bairro Lagoa do Meio, CEP 29904-025, Linhares/ES",
  emailContato: "vinicius.pellegrino@gruponuvra.com.br",
  emailPrivacidade: "pedro.casteluber@gruponuvra.com.br",
  cidadeForo: "Linhares/ES",
  provedorTranscricao: "[PREENCHER: empresa que transcreve as mensagens de voz]",
} as const;

export const ATUALIZADO_EM = "26 de setembro de 2026";

export const DADOS_PENDENTES = Object.values(EMPRESA).some((v) => v.includes("PREENCHER"));
