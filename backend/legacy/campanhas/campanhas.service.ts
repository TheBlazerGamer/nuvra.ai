import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, StatusPublicacao, TipoCriativo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { MetaAdsService } from '../meta-ads/meta-ads.service.js';
import { CriarCampanhaDto } from './dto/criar-campanha.dto.js';

@Injectable()
export class CampanhasService {
  private readonly logger = new Logger(CampanhasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaAdsService: MetaAdsService,
  ) {}

  async criar(clienteId: string, dto: CriarCampanhaDto) {
    const cliente = await this.prisma.cliente.findUniqueOrThrow({
      where: { id: clienteId },
      include: { plano: true },
    });

    if (!cliente.metaContaAnuncioId) {
      throw new ForbiddenException(
        'Conta de anúncio da Meta ainda não vinculada. Conclua o onboarding com a Nuvra.',
      );
    }

    const criativo = await this.prisma.criativo.findUnique({ where: { id: dto.criativoId } });
    if (!criativo || criativo.clienteId !== clienteId) {
      throw new NotFoundException('Criativo não encontrado.');
    }

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const campanhasNoMes = await this.prisma.campanha.count({
      where: { clienteId, criadoEm: { gte: inicioMes } },
    });

    if (campanhasNoMes >= cliente.plano.limiteCampanhasMes) {
      throw new ForbiddenException(
        `Limite de ${cliente.plano.limiteCampanhasMes} campanhas/mês do plano ${cliente.plano.nome} atingido.`,
      );
    }

    const requerChecagemManual =
      cliente.metaTetoChecagemCentavos == null ||
      dto.valorInvestidoCentavos > cliente.metaTetoChecagemCentavos;

    const campanha = await this.prisma.campanha.create({
      data: {
        clienteId,
        criativoId: dto.criativoId,
        objetivo: dto.objetivo,
        destinoConversa: dto.destinoConversa,
        valorInvestidoCentavos: dto.valorInvestidoCentavos,
        publicoAlvo: dto.publicoAlvo as Prisma.InputJsonValue,
        requerChecagemManual,
        statusPublicacao: requerChecagemManual
          ? StatusPublicacao.AGUARDANDO_CHECAGEM_MANUAL
          : StatusPublicacao.PENDENTE_ANALISE,
      },
    });

    if (!requerChecagemManual) {
      await this.publicar(campanha.id);
    }

    return this.prisma.campanha.findUniqueOrThrow({ where: { id: campanha.id } });
  }

  async aprovarChecagemManual(campanhaId: string, aprovadoPor: string) {
    const campanha = await this.prisma.campanha.findUniqueOrThrow({ where: { id: campanhaId } });

    if (campanha.statusPublicacao !== StatusPublicacao.AGUARDANDO_CHECAGEM_MANUAL) {
      throw new ForbiddenException('Esta campanha não está aguardando checagem manual.');
    }

    await this.prisma.campanha.update({
      where: { id: campanhaId },
      data: { checagemAprovadaPor: aprovadoPor, checagemAprovadaEm: new Date() },
    });

    await this.publicar(campanhaId);
    return this.prisma.campanha.findUniqueOrThrow({ where: { id: campanhaId } });
  }

  private async publicar(campanhaId: string) {
    await this.prisma.campanha.update({
      where: { id: campanhaId },
      data: { statusPublicacao: StatusPublicacao.PUBLICANDO },
    });

    try {
      const campanha = await this.prisma.campanha.findUniqueOrThrow({
        where: { id: campanhaId },
        include: { cliente: true, criativo: true },
      });

      const contaAnuncioId = campanha.cliente.metaContaAnuncioId!;
      const nomeBase = `Nuvra - ${campanha.objetivo} - ${campanha.id.slice(0, 8)}`;

      const metaCampaign = await this.metaAdsService.criarCampanha({
        contaAnuncioId,
        nome: nomeBase,
        objetivo: campanha.objetivo,
      });

      const metaAdSet = await this.metaAdsService.criarConjuntoAnuncios({
        contaAnuncioId,
        campanhaId: metaCampaign.id,
        nome: `${nomeBase} - Conjunto`,
        valorInvestidoCentavos: campanha.valorInvestidoCentavos,
        publicoAlvo: campanha.publicoAlvo as Record<string, unknown>,
        destinoConversa: campanha.destinoConversa,
      });

      if (!campanha.cliente.metaPaginaId) {
        throw new Error('Página do Facebook do cliente não está vinculada.');
      }
      const paginaId = campanha.cliente.metaPaginaId;

      let imageHash: string | undefined;
      let videoId: string | undefined;

      if (campanha.criativo.tipo === TipoCriativo.IMAGEM) {
        const upload = await this.metaAdsService.uploadImagem(
          contaAnuncioId,
          campanha.criativo.urlArquivo,
        );
        imageHash = upload.hash;
      } else {
        const upload = await this.metaAdsService.uploadVideo(
          contaAnuncioId,
          campanha.criativo.urlArquivo,
        );
        videoId = upload.id;
      }

      const metaCriativo = await this.metaAdsService.criarCriativo({
        contaAnuncioId,
        nome: `${nomeBase} - Criativo`,
        paginaId,
        mensagem: `Campanha ${campanha.objetivo} gerada automaticamente pela Nuvra.AI`,
        imageHash,
        videoId,
      });

      const metaAnuncio = await this.metaAdsService.criarAnuncio({
        contaAnuncioId,
        nome: `${nomeBase} - Anúncio`,
        adSetId: metaAdSet.id,
        criativoId: metaCriativo.id,
      });

      await this.metaAdsService.ativarCampanha(metaCampaign.id);

      await this.prisma.campanha.update({
        where: { id: campanhaId },
        data: {
          metaCampaignId: metaCampaign.id,
          metaAdSetId: metaAdSet.id,
          metaAdId: metaAnuncio.id,
          statusPublicacao: StatusPublicacao.PUBLICADA,
          publicadoEm: new Date(),
        },
      });
    } catch (erro) {
      this.logger.error(`Falha ao publicar campanha ${campanhaId}`, erro as Error);
      await this.prisma.campanha.update({
        where: { id: campanhaId },
        data: {
          statusPublicacao: StatusPublicacao.ERRO,
          erroPublicacao: (erro as Error).message,
        },
      });
    }
  }

  async listarPorCliente(clienteId: string) {
    return this.prisma.campanha.findMany({
      where: { clienteId },
      include: { criativo: true, resultados: true },
      orderBy: { criadoEm: 'desc' },
    });
  }
}
