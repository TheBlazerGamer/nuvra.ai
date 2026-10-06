import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ClienteAtual } from '../auth/cliente-atual.decorator.js';
import { SessaoGuard } from '../auth/sessao.guard.js';
import { ConfirmarEtapaDto, PerguntaDto } from './dto/prontidao.dto.js';
import { MetaProntidaoService } from './meta-prontidao.service.js';

// Assistente de preparação da conta. Só exige sessão (e não e-mail confirmado): "confirmar o e-mail" é uma das etapas.
@Controller('meta/prontidao')
@UseGuards(SessaoGuard)
export class MetaProntidaoController {
  constructor(private readonly prontidao: MetaProntidaoService) {}

  // Consulta a Meta a cada chamada; o limite evita que alguém use isso para martelar a API deles.
  @Get()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  avaliar(@ClienteAtual() clienteId: string) {
    return this.prontidao.avaliar(clienteId);
  }

  @Post('pergunta')
  @HttpCode(204)
  async pergunta(@ClienteAtual() clienteId: string, @Body() dto: PerguntaDto): Promise<void> {
    await this.prontidao.responderPergunta(clienteId, dto.resposta);
  }

  @Post('confirmar')
  @HttpCode(204)
  async confirmar(@ClienteAtual() clienteId: string, @Body() dto: ConfirmarEtapaDto): Promise<void> {
    await this.prontidao.confirmar(clienteId, dto.etapa, dto.feito ?? true);
  }
}
