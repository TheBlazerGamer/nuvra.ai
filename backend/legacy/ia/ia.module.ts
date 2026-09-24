import { Module } from '@nestjs/common';
import { IaService } from './ia.service.js';

@Module({
  providers: [IaService],
  exports: [IaService],
})
export class IaModule {}
