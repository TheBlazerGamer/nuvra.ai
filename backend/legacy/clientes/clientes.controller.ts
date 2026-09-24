import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { CurrentCliente } from '../auth/current-cliente.decorator.js';
import { ClientesService } from './clientes.service.js';

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
}
