import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PlanosModule } from './planos/planos.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ClientesModule } from './clientes/clientes.module.js';
import { StorageModule } from './storage/storage.module.js';
import { IaModule } from './ia/ia.module.js';
import { MetaAdsModule } from './meta-ads/meta-ads.module.js';
import { CriativosModule } from './criativos/criativos.module.js';
import { CampanhasModule } from './campanhas/campanhas.module.js';
import { RelatoriosModule } from './relatorios/relatorios.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PlanosModule,
    AuthModule,
    ClientesModule,
    StorageModule,
    IaModule,
    MetaAdsModule,
    CriativosModule,
    CampanhasModule,
    RelatoriosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
