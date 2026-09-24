import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentCliente } from '../auth/current-cliente.decorator.js';
import { RelatoriosService } from './relatorios.service.js';

@Controller('relatorios')
export class RelatoriosController {
  constructor(
    private readonly relatoriosService: RelatoriosService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  listar(@CurrentCliente() cliente: { clienteId: string }) {
    return this.relatoriosService.listarPorCliente(cliente.clienteId);
  }

  @Post('gerar-semana')
  gerarSemana(@Headers('x-webhook-secret') segredoRecebido?: string) {
    const segredoEsperado = this.configService.get<string>('N8N_WEBHOOK_SECRET');
    if (!segredoEsperado || segredoRecebido !== segredoEsperado) {
      throw new ForbiddenException('Assinatura de webhook inválida.');
    }
    return this.relatoriosService.gerarRelatoriosDaSemana();
  }
}
