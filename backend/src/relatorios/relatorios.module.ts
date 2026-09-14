import { Module } from '@nestjs/common';
import { RelatoriosController } from './relatorios.controller.js';
import { RelatoriosService } from './relatorios.service.js';
import { MetaAdsModule } from '../meta-ads/meta-ads.module.js';

@Module({
  imports: [MetaAdsModule],
  controllers: [RelatoriosController],
  providers: [RelatoriosService],
})
export class RelatoriosModule {}
