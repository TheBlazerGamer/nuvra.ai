import { ObjetivoCampanha } from '@prisma/client';

export const OBJETIVO_META: Record<ObjetivoCampanha, string> = {
  RECONHECIMENTO: 'OUTCOME_AWARENESS',
  TRAFEGO: 'OUTCOME_TRAFFIC',
  ENGAJAMENTO: 'OUTCOME_ENGAGEMENT',
  LEADS: 'OUTCOME_LEADS',
  PROMOCAO_APP: 'OUTCOME_APP_PROMOTION',
  VENDAS: 'OUTCOME_SALES',
};

export interface CriarCampanhaMetaParams {
  contaAnuncioId: string;
  nome: string;
  objetivo: ObjetivoCampanha;
  valorInvestidoCentavos: number;
}

export interface CriarCampanhaMetaResultado {
  campaignId: string;
  adSetId: string;
  adId: string;
}
