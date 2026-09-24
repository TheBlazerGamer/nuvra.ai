import { Module } from '@nestjs/common';
import { CriativosController } from './criativos.controller.js';
import { CriativosService } from './criativos.service.js';
import { StorageModule } from '../storage/storage.module.js';
import { IaModule } from '../ia/ia.module.js';

@Module({
  imports: [StorageModule, IaModule],
  controllers: [CriativosController],
  providers: [CriativosService],
  exports: [CriativosService],
})
export class CriativosModule {}
