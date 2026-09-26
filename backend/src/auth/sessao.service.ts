import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaSystemService } from '../database/prisma-system.service.js';
import { SESSAO_DURACAO_MAXIMA_MS, SESSAO_INATIVIDADE_MS } from './constantes.js';

const ATUALIZAR_USO_A_CADA_MS = 5 * 60 * 1000;

@Injectable()
export class SessaoService {
  constructor(private readonly system: PrismaSystemService) {}

  // O navegador guarda o token; o banco guarda só o hash. Um vazamento do banco não entrega sessões válidas.
  static hashDoToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async criar(clienteId: string, userAgent?: string) {
    const token = randomBytes(32).toString('base64url');
    const expiraEm = new Date(Date.now() + SESSAO_INATIVIDADE_MS);

    await this.system.sessao.create({
      data: {
        clienteId,
        tokenHash: SessaoService.hashDoToken(token),
        expiraEm,
        userAgent: userAgent?.slice(0, 300),
      },
      select: { id: true },
    });

    return { token, expiraEm };
  }

  async validar(token: string): Promise<{ clienteId: string; sessaoId: string } | null> {
    if (!token || token.length > 200) return null;

    const sessao = await this.system.sessao.findUnique({
      where: { tokenHash: SessaoService.hashDoToken(token) },
      select: {
        id: true,
        clienteId: true,
        criadoEm: true,
        expiraEm: true,
        ultimoUsoEm: true,
        revogadaEm: true,
        cliente: { select: { status: true } },
      },
    });

    const agora = Date.now();
    if (
      !sessao ||
      sessao.revogadaEm ||
      sessao.expiraEm.getTime() <= agora ||
      sessao.criadoEm.getTime() + SESSAO_DURACAO_MAXIMA_MS <= agora ||
      sessao.cliente.status !== 'ATIVO'
    ) {
      return null;
    }

    if (agora - sessao.ultimoUsoEm.getTime() > ATUALIZAR_USO_A_CADA_MS) {
      const limiteAbsoluto = sessao.criadoEm.getTime() + SESSAO_DURACAO_MAXIMA_MS;
      await this.system.sessao.update({
        where: { id: sessao.id },
        data: {
          ultimoUsoEm: new Date(agora),
          expiraEm: new Date(Math.min(agora + SESSAO_INATIVIDADE_MS, limiteAbsoluto)),
        },
        select: { id: true },
      });
    }

    return { clienteId: sessao.clienteId, sessaoId: sessao.id };
  }

  async revogar(token: string): Promise<void> {
    if (!token || token.length > 200) return;
    await this.system.sessao.updateMany({
      where: { tokenHash: SessaoService.hashDoToken(token), revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }
}
