import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaSystemService } from '../database/prisma-system.service.js';

// "state" do OAuth: amarra o retorno da Meta à sessão que iniciou o login (defesa contra CSRF —
// sem isso, um atacante poderia conectar a PRÓPRIA conta de anúncio na conta de outra pessoa).
// Curto de propósito: o cliente vai e volta da Meta em segundos, não em horas.
const VALIDADE_MS = 10 * 60 * 1000;

@Injectable()
export class MetaOAuthEstadoService {
  constructor(private readonly system: PrismaSystemService) {}

  private static hash(estado: string): string {
    return createHash('sha256').update(estado).digest('hex');
  }

  async criar(clienteId: string): Promise<string> {
    const estado = randomBytes(32).toString('base64url');
    await this.system.estadoOAuthMeta.create({
      data: { clienteId, estadoHash: MetaOAuthEstadoService.hash(estado), expiraEm: new Date(Date.now() + VALIDADE_MS) },
      select: { id: true },
    });
    return estado;
  }

  async validar(estado: string): Promise<{ id: string; clienteId: string } | null> {
    if (!estado || estado.length > 64) return null;

    const registro = await this.system.estadoOAuthMeta.findUnique({
      where: { estadoHash: MetaOAuthEstadoService.hash(estado) },
      select: { id: true, clienteId: true, expiraEm: true, usadoEm: true },
    });

    if (!registro || registro.usadoEm || registro.expiraEm.getTime() <= Date.now()) return null;
    return { id: registro.id, clienteId: registro.clienteId };
  }

  // Atômico: o navegador nunca deveria voltar duas vezes com o mesmo "state", mas se voltar, só uma vence.
  async marcarUsado(id: string): Promise<boolean> {
    const { count } = await this.system.estadoOAuthMeta.updateMany({
      where: { id, usadoEm: null },
      data: { usadoEm: new Date() },
    });
    return count === 1;
  }
}
