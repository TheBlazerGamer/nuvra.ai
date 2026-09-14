import { Injectable, Logger } from '@nestjs/common';
import { StatusPublicacao } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MetaAdsService } from '../meta-ads/meta-ads.service.js';

function inicioDaSemana(data: Date): Date {
  const referencia = new Date(data);
  const diaSemana = referencia.getDay();
  const diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana;
  referencia.setDate(referencia.getDate() + diffParaSegunda);
  referencia.setHours(0, 0, 0, 0);
  return referencia;
}

@Injectable()
export class RelatoriosService {
  private readonly logger = new Logger(RelatoriosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaAdsService: MetaAdsService,
  ) {}

  async gerarRelatoriosDaSemana() {
    const clientes = await this.prisma.cliente.findMany({
      where: { campanhas: { some: { statusPublicacao: StatusPublicacao.PUBLICADA } } },
    });

    const resultados = [];
    for (const cliente of clientes) {
      resultados.push(await this.gerarRelatorioCliente(cliente.id));
    }
    return resultados;
  }

  async gerarRelatorioCliente(clienteId: string) {
    const semanaReferencia = inicioDaSemana(new Date());
    const fimSemana = new Date(semanaReferencia);
    fimSemana.setDate(fimSemana.getDate() + 6);

    const desde = semanaReferencia.toISOString().slice(0, 10);
    const ate = fimSemana.toISOString().slice(0, 10);

    const campanhas = await this.prisma.campanha.findMany({
      where: { clienteId, statusPublicacao: StatusPublicacao.PUBLICADA },
    });

    const resumoCampanhas = [];

    for (const campanha of campanhas) {
      if (!campanha.metaCampaignId) continue;

      try {
        const insights = await this.metaAdsService.obterInsightsSemanais(
          campanha.metaCampaignId,
          desde,
          ate,
        );

        const dados = insights.data[0];
        if (!dados) continue;

        const conversoes =
          dados.actions?.reduce((total, acao) => total + Number(acao.value), 0) ?? 0;

        const resultado = await this.prisma.resultadoCampanha.upsert({
          where: { campanhaId_semanaReferencia: { campanhaId: campanha.id, semanaReferencia } },
          create: {
            campanhaId: campanha.id,
            semanaReferencia,
            impressoes: Number(dados.impressions ?? 0),
            cliques: Number(dados.clicks ?? 0),
            gastoCentavos: Math.round(Number(dados.spend ?? 0) * 100),
            conversoes,
            cpcCentavos: dados.cpc ? Math.round(Number(dados.cpc) * 100) : null,
            cpmCentavos: dados.cpm ? Math.round(Number(dados.cpm) * 100) : null,
            ctr: dados.ctr ? Number(dados.ctr) : null,
            dadosBrutosMeta: dados as object,
          },
          update: {
            impressoes: Number(dados.impressions ?? 0),
            cliques: Number(dados.clicks ?? 0),
            gastoCentavos: Math.round(Number(dados.spend ?? 0) * 100),
            conversoes,
            cpcCentavos: dados.cpc ? Math.round(Number(dados.cpc) * 100) : null,
            cpmCentavos: dados.cpm ? Math.round(Number(dados.cpm) * 100) : null,
            ctr: dados.ctr ? Number(dados.ctr) : null,
            dadosBrutosMeta: dados as object,
          },
        });

        resumoCampanhas.push({ campanhaId: campanha.id, objetivo: campanha.objetivo, resultado });
      } catch (erro) {
        this.logger.error(`Falha ao buscar insights da campanha ${campanha.id}`, erro as Error);
      }
    }

    return this.prisma.relatorioSemanal.upsert({
      where: { clienteId_semanaReferencia: { clienteId, semanaReferencia } },
      create: {
        clienteId,
        semanaReferencia,
        dadosConsolidados: { campanhas: resumoCampanhas } as object,
      },
      update: {
        dadosConsolidados: { campanhas: resumoCampanhas } as object,
      },
    });
  }

  async listarPorCliente(clienteId: string) {
    return this.prisma.relatorioSemanal.findMany({
      where: { clienteId },
      orderBy: { semanaReferencia: 'desc' },
    });
  }
}
