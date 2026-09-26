import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaTenantService } from '../database/prisma-tenant.service.js';
import type { RequisicaoAutenticada } from './sessao.guard.js';

// Usar DEPOIS do SessaoGuard: @UseGuards(SessaoGuard, EmailVerificadoGuard).
// Recursos sensíveis (vincular Telegram, pedir campanha, conectar conta de anúncio) exigem e-mail confirmado.
@Injectable()
export class EmailVerificadoGuard implements CanActivate {
  constructor(private readonly tenant: PrismaTenantService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const { clienteId } = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();

    const cliente = await this.tenant.comTenant(clienteId, (tx) =>
      tx.cliente.findUnique({ where: { id: clienteId }, select: { emailVerificadoEm: true } }),
    );

    if (!cliente?.emailVerificadoEm) {
      throw new ForbiddenException('Confirme seu e-mail para usar este recurso.');
    }
    return true;
  }
}
