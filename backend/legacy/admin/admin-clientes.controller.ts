import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { FuncionarioAuthGuard } from '../auth/funcionario-auth.guard.js';
import { ClientesService } from '../clientes/clientes.service.js';
import { VincularContaMetaDto } from '../clientes/dto/vincular-conta-meta.dto.js';
import { DefinirTetoChecagemDto } from '../clientes/dto/definir-teto-checagem.dto.js';

@Controller('admin/clientes')
@UseGuards(FuncionarioAuthGuard)
export class AdminClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Patch(':clienteId/conta-meta')
  vincularContaMeta(
    @Param('clienteId') clienteId: string,
    @Body() dto: VincularContaMetaDto,
  ) {
    return this.clientesService.vincularContaMeta(
      clienteId,
      dto.metaBusinessManagerId,
      dto.metaContaAnuncioId,
      dto.metaPaginaId,
    );
  }

  @Patch(':clienteId/teto-checagem')
  definirTetoChecagem(
    @Param('clienteId') clienteId: string,
    @Body() dto: DefinirTetoChecagemDto,
  ) {
    return this.clientesService.definirTetoChecagem(clienteId, dto.tetoCentavos);
  }
}
