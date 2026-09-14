import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TipoCriativo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { IaService } from '../ia/ia.service.js';

const TIPOS_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const TIPOS_VIDEO = new Set(['video/mp4', 'video/quicktime']);

@Injectable()
export class CriativosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly iaService: IaService,
  ) {}

  async upload(
    clienteId: string,
    arquivo: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ) {
    const cliente = await this.prisma.cliente.findUniqueOrThrow({
      where: { id: clienteId },
      include: { plano: true },
    });

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const criativosNoMes = await this.prisma.criativo.count({
      where: { clienteId, criadoEm: { gte: inicioMes } },
    });

    if (criativosNoMes >= cliente.plano.limiteCriativosMes) {
      throw new ForbiddenException(
        `Limite de ${cliente.plano.limiteCriativosMes} criativos/mês do plano ${cliente.plano.nome} atingido.`,
      );
    }

    let tipo: TipoCriativo;
    if (TIPOS_IMAGEM.has(arquivo.mimetype)) {
      tipo = TipoCriativo.IMAGEM;
    } else if (TIPOS_VIDEO.has(arquivo.mimetype)) {
      tipo = TipoCriativo.VIDEO;
    } else {
      throw new BadRequestException('Formato de arquivo não suportado. Envie imagem ou vídeo.');
    }

    const { url } = await this.storageService.enviarCriativo(clienteId, arquivo);

    return this.prisma.criativo.create({
      data: {
        clienteId,
        tipo,
        urlArquivo: url,
        nomeArquivo: arquivo.originalname,
        tamanhoBytes: arquivo.size,
      },
    });
  }

  async analisar(clienteId: string, criativoId: string, objetivoCampanha: string) {
    const criativo = await this.prisma.criativo.findUnique({ where: { id: criativoId } });
    if (!criativo || criativo.clienteId !== clienteId) {
      throw new NotFoundException('Criativo não encontrado.');
    }

    const historicoCliente = await this.prisma.campanha.findMany({
      where: { clienteId },
      include: { resultados: true },
      orderBy: { criadoEm: 'desc' },
      take: 10,
    });

    let imagemBase64: string | undefined;
    let imagemMimeType: string | undefined;

    if (criativo.tipo === TipoCriativo.IMAGEM) {
      const resposta = await fetch(criativo.urlArquivo);
      imagemBase64 = Buffer.from(await resposta.arrayBuffer()).toString('base64');
      imagemMimeType = resposta.headers.get('content-type') ?? 'image/jpeg';
    }

    const analise = await this.iaService.analisarCriativo({
      tipo: criativo.tipo,
      imagemBase64,
      imagemMimeType,
      historicoCliente,
      objetivoCampanha,
    });

    return this.prisma.criativo.update({
      where: { id: criativo.id },
      data: { analiseIA: analise as object, analisadoEm: new Date() },
    });
  }

  async listarPorCliente(clienteId: string) {
    return this.prisma.criativo.findMany({
      where: { clienteId },
      orderBy: { criadoEm: 'desc' },
    });
  }
}
