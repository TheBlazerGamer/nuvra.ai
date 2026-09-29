import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

// O Telegram devolve, em cada chamada ao webhook, o segredo configurado em setWebhook
// (secret_token) no cabeçalho abaixo. Sem isso, qualquer um poderia forjar mensagens de clientes.
const CABECALHO_SEGREDO = 'x-telegram-bot-api-secret-token';

@Injectable()
export class TelegramWebhookGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(contexto: ExecutionContext): boolean {
    const req = contexto.switchToHttp().getRequest<Request>();
    const recebido = req.headers[CABECALHO_SEGREDO];
    const esperado = this.config.getOrThrow<string>('TELEGRAM_WEBHOOK_SECRET');

    const bufferRecebido = Buffer.from(typeof recebido === 'string' ? recebido : '');
    const bufferEsperado = Buffer.from(esperado);

    const valido =
      bufferRecebido.length === bufferEsperado.length && timingSafeEqual(bufferRecebido, bufferEsperado);

    if (!valido) throw new ForbiddenException('Segredo do webhook inválido.');
    return true;
  }
}
