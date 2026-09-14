import { Injectable, NotFoundException } from '@nestjs/common';
import { StatusOnboarding } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(clienteId: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      include: { plano: true },
    });

    if (!cliente) {
      throw new NotFoundException('Cliente não encontrado.');
    }

    const { senhaHash: _senhaHash, ...clienteSemSenha } = cliente;
    return clienteSemSenha;
  }

  async vincularContaMeta(
    clienteId: string,
    metaBusinessManagerId: string,
    metaContaAnuncioId: string,
    metaPaginaId: string,
  ) {
    return this.prisma.cliente.update({
      where: { id: clienteId },
      data: {
        metaBusinessManagerId,
        metaContaAnuncioId,
        metaPaginaId,
        statusOnboarding: StatusOnboarding.CONCLUIDO,
      },
    });
  }

  async definirTetoChecagem(clienteId: string, tetoCentavos: number) {
    return this.prisma.cliente.update({
      where: { id: clienteId },
      data: { metaTetoChecagemCentavos: tetoCentavos },
    });
  }

  async contarUsoMensal(clienteId: string) {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const [criativos, campanhas] = await Promise.all([
      this.prisma.criativo.count({
        where: { clienteId, criadoEm: { gte: inicioMes } },
      }),
      this.prisma.campanha.count({
        where: { clienteId, criadoEm: { gte: inicioMes } },
      }),
    ]);

    return { criativos, campanhas };
  }
}
