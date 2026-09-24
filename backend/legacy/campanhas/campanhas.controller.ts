import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentCliente } from '../auth/current-cliente.decorator.js';
import { CampanhasService } from './campanhas.service.js';
import { CriarCampanhaDto } from './dto/criar-campanha.dto.js';

@Controller('campanhas')
@UseGuards(JwtAuthGuard)
export class CampanhasController {
  constructor(private readonly campanhasService: CampanhasService) {}

  @Get()
  listar(@CurrentCliente() cliente: { clienteId: string }) {
    return this.campanhasService.listarPorCliente(cliente.clienteId);
  }

  @Post()
  criar(@CurrentCliente() cliente: { clienteId: string }, @Body() dto: CriarCampanhaDto) {
    return this.campanhasService.criar(cliente.clienteId, dto);
  }
}
