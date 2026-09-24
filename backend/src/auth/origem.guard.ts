import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

export const PERMITIR_SEM_ORIGEM = 'permitir-sem-origem';

// Para rotas chamadas por servidores (ex.: webhook do Telegram), que não são navegadores e não enviam Origin.
// Essas rotas precisam de outra autenticação própria (segredo do webhook).
export const PermitirSemOrigem = () => SetMetadata(PERMITIR_SEM_ORIGEM, true);

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Defesa contra CSRF: toda requisição que altera algo precisa vir do nosso site.
// O navegador sempre envia o cabeçalho Origin nesses casos e o site malicioso não consegue forjá-lo.
@Injectable()
export class OrigemGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(contexto: ExecutionContext): boolean {
    const req = contexto.switchToHttp().getRequest<Request>();
    if (METODOS_SEGUROS.has(req.method)) return true;

    const liberada = this.reflector.getAllAndOverride<boolean>(PERMITIR_SEM_ORIGEM, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (liberada) return true;

    const esperada = this.config.getOrThrow<string>('WEB_ORIGIN');
    if (req.headers.origin !== esperada) {
      throw new ForbiddenException('Origem da requisição não permitida.');
    }
    return true;
  }
}
