import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequisicaoAutenticada } from './sessao.guard.js';

// Só use em rotas protegidas por SessaoGuard: entrega o id do cliente dono da sessão.
export const ClienteAtual = createParamDecorator((_dados: unknown, contexto: ExecutionContext) => {
  return contexto.switchToHttp().getRequest<RequisicaoAutenticada>().clienteId;
});
