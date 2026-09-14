import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsInt, IsPositive, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentCliente } from '../auth/current-cliente.decorator.js';
import { ClientesService } from './clientes.service.js';

class VincularContaMetaDto {
  @IsString()
  metaBusinessManagerId: string;

  @IsString()
  metaContaAnuncioId: string;

  @IsString()
  metaPaginaId: string;
}

class DefinirTetoChecagemDto {
  @IsInt()
  @IsPositive()
  tetoCentavos: number;
}

@Controller('clientes')
@UseGuards(JwtAuthGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get('me')
  me(@CurrentCliente() cliente: { clienteId: string }) {
    return this.clientesService.findMe(cliente.clienteId);
  }

  @Get('me/uso-mensal')
  usoMensal(@CurrentCliente() cliente: { clienteId: string }) {
    return this.clientesService.contarUsoMensal(cliente.clienteId);
  }

  @Patch('me/conta-meta')
  vincularContaMeta(
    @CurrentCliente() cliente: { clienteId: string },
    @Body() dto: VincularContaMetaDto,
  ) {
    return this.clientesService.vincularContaMeta(
      cliente.clienteId,
      dto.metaBusinessManagerId,
      dto.metaContaAnuncioId,
      dto.metaPaginaId,
    );
  }

  @Patch('me/teto-checagem')
  definirTetoChecagem(
    @CurrentCliente() cliente: { clienteId: string },
    @Body() dto: DefinirTetoChecagemDto,
  ) {
    return this.clientesService.definirTetoChecagem(cliente.clienteId, dto.tetoCentavos);
  }
}
