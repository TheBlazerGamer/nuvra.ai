import { Module } from '@nestjs/common';
import { CampanhasController } from './campanhas.controller.js';
import { CampanhasService } from './campanhas.service.js';
import { MetaAdsModule } from '../meta-ads/meta-ads.module.js';

@Module({
  imports: [MetaAdsModule],
  controllers: [CampanhasController],
  providers: [CampanhasService],
  exports: [CampanhasService],
})
export class CampanhasModule {}
