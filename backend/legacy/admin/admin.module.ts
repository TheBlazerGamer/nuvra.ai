import { Module } from '@nestjs/common';
import { AdminClientesController } from './admin-clientes.controller.js';
import { AdminCampanhasController } from './admin-campanhas.controller.js';
import { ClientesModule } from '../clientes/clientes.module.js';
import { CampanhasModule } from '../campanhas/campanhas.module.js';

@Module({
  imports: [ClientesModule, CampanhasModule],
  controllers: [AdminClientesController, AdminCampanhasController],
})
export class AdminModule {}
