import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RequisicaoAutenticada } from './sessao.guard.js';

// Só use em rotas protegidas por SessaoGuard: entregam o id do cliente e o da sessão em uso.
export const ClienteAtual = createParamDecorator((_dados: unknown, contexto: ExecutionContext) => {
  return contexto.switchToHttp().getRequest<RequisicaoAutenticada>().clienteId;
});

export const SessaoAtual = createParamDecorator((_dados: unknown, contexto: ExecutionContext) => {
  return contexto.switchToHttp().getRequest<RequisicaoAutenticada>().sessaoId;
});
