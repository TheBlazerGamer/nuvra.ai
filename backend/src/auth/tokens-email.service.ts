import { Injectable } from '@nestjs/common';
import { TipoTokenEmail } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaSystemService } from '../database/prisma-system.service.js';

const HORA_MS = 60 * 60 * 1000;
const VALIDADE_MS: Record<TipoTokenEmail, number> = {
  VERIFICACAO_EMAIL: 24 * HORA_MS,
  RECUPERACAO_SENHA: HORA_MS,
};

// Tokens de uso único enviados por e-mail. O banco guarda só o hash; um vazamento do banco não permite
// verificar e-mails nem redefinir senhas.
@Injectable()
export class TokensEmailService {
  constructor(private readonly system: PrismaSystemService) {}

  private static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // Gerar um novo token invalida os anteriores do mesmo tipo: só o link mais recente funciona.
  async criar(clienteId: string, tipo: TipoTokenEmail): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.system.$transaction([
      this.system.tokenEmail.updateMany({
        where: { clienteId, tipo, usadoEm: null },
        data: { usadoEm: new Date() },
      }),
      this.system.tokenEmail.create({
        data: {
          clienteId,
          tipo,
          tokenHash: TokensEmailService.hash(token),
          expiraEm: new Date(Date.now() + VALIDADE_MS[tipo]),
        },
        select: { id: true },
      }),
    ]);
    return token;
  }

  async validar(token: string, tipo: TipoTokenEmail): Promise<{ id: string; clienteId: string } | null> {
    if (!token || token.length > 200) return null;

    const registro = await this.system.tokenEmail.findUnique({
      where: { tokenHash: TokensEmailService.hash(token) },
      select: { id: true, clienteId: true, tipo: true, expiraEm: true, usadoEm: true },
    });

    if (!registro || registro.tipo !== tipo || registro.usadoEm || registro.expiraEm.getTime() <= Date.now()) {
      return null;
    }
    return { id: registro.id, clienteId: registro.clienteId };
  }

  // Atômico: se duas requisições tentarem usar o mesmo link ao mesmo tempo, só uma vence.
  async marcarUsado(id: string): Promise<boolean> {
    const { count } = await this.system.tokenEmail.updateMany({
      where: { id, usadoEm: null },
      data: { usadoEm: new Date() },
    });
    return count === 1;
  }

  contarRecentes(clienteId: string, tipo: TipoTokenEmail, janelaMs = HORA_MS): Promise<number> {
    return this.system.tokenEmail.count({
      where: { clienteId, tipo, criadoEm: { gt: new Date(Date.now() - janelaMs) } },
    });
  }
}
