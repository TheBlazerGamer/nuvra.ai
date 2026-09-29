import { Controller, Delete, HttpCode, HttpException, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuditoriaService } from '../auth/auditoria.service.js';
import { ClienteAtual } from '../auth/cliente-atual.decorator.js';
import { EmailVerificadoGuard } from '../auth/email-verificado.guard.js';
import { SessaoGuard } from '../auth/sessao.guard.js';
import { TokensCanalService } from './tokens-canal.service.js';
import { VinculosCanalService } from './vinculos-canal.service.js';

const MAX_LINKS_POR_HORA = 5;

@Controller('canais')
@UseGuards(SessaoGuard, EmailVerificadoGuard)
export class CanaisController {
  constructor(
    private readonly tokens: TokensCanalService,
    private readonly vinculos: VinculosCanalService,
    private readonly config: ConfigService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Post('telegram/vincular')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async gerarLinkTelegram(@ClienteAtual() clienteId: string) {
    if ((await this.tokens.contarRecentes(clienteId, 'TELEGRAM')) >= MAX_LINKS_POR_HORA) {
      throw new HttpException('Muitos links gerados. Aguarde um pouco e tente de novo.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const token = await this.tokens.criar(clienteId, 'TELEGRAM');
    await this.auditoria.registrar('canal_link_gerado', { clienteId, detalhes: { canal: 'TELEGRAM' } });

    const usuario = this.config.getOrThrow<string>('TELEGRAM_BOT_USERNAME');
    return { link: `https://t.me/${usuario}?start=${token}` };
  }

  @Delete('telegram')
  @HttpCode(204)
  async desvincularTelegram(@ClienteAtual() clienteId: string): Promise<void> {
    const removeu = await this.vinculos.desvincular(clienteId, 'TELEGRAM');
    if (removeu) {
      await this.auditoria.registrar('canal_desvinculado', { clienteId, detalhes: { canal: 'TELEGRAM' } });
    }
  }
}
