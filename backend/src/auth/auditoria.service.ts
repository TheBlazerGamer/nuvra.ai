import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaSystemService } from '../database/prisma-system.service.js';

export type TipoEventoAuditoria =
  | 'cadastro'
  | 'cadastro_email_existente'
  | 'email_verificado'
  | 'verificacao_reenviada'
  | 'login_ok'
  | 'login_falha'
  | 'login_bloqueado'
  | 'conta_bloqueada'
  | 'logout'
  | 'recuperacao_solicitada'
  | 'recuperacao_email_desconhecido'
  | 'recuperacao_limitada'
  | 'senha_redefinida'
  | 'senha_alterada'
  | 'sessao_encerrada'
  | 'sessoes_encerradas'
  | 'canal_link_gerado'
  | 'canal_vinculado'
  | 'canal_desvinculado'
  | 'meta_conectado'
  | 'meta_erro_callback'
  | 'meta_ativos_selecionados'
  | 'meta_desconectado'
  | 'meta_desautorizado'
  | 'meta_exclusao_solicitada';

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
