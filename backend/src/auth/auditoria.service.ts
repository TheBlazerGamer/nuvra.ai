import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaSystemService } from '../database/prisma-system.service.js';

export type TipoEventoAuditoria =
  | 'cadastro'
  | 'login_ok'
  | 'login_falha'
  | 'login_bloqueado'
  | 'conta_bloqueada'
  | 'logout';

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly system: PrismaSystemService) {}

  // Nunca registrar senha, token ou hash aqui. Uma falha de auditoria não pode derrubar o login.
  async registrar(
    tipo: TipoEventoAuditoria,
    dados: { clienteId?: string; ip?: string; detalhes?: Record<string, unknown> } = {},
  ): Promise<void> {
    try {
      await this.system.eventoAuditoria.create({
        data: {
          tipo,
          clienteId: dados.clienteId,
          detalhes: { ip: dados.ip ?? null, ...dados.detalhes } as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
    } catch (erro) {
      this.logger.error(`Falha ao registrar evento de auditoria "${tipo}"`, erro as Error);
    }
  }
}
