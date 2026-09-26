import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { COOKIE_SESSAO } from './constantes.js';
import { SessaoService } from './sessao.service.js';

export type RequisicaoAutenticada = Request & { clienteId: string; sessaoId: string };

@Injectable()
export class SessaoGuard implements CanActivate {
  constructor(private readonly sessoes: SessaoService) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest<RequisicaoAutenticada>();
    const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE_SESSAO];

    const sessao = token ? await this.sessoes.validar(token) : null;
    if (!sessao) {
      throw new UnauthorizedException('Sessão inválida ou expirada. Entre novamente.');
    }

    req.clienteId = sessao.clienteId;
    req.sessaoId = sessao.sessaoId;
    return true;
  }
}
