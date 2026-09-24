import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaSystemService } from './prisma-system.service.js';
import { PrismaTenantService } from './prisma-tenant.service.js';

@Global()
@Module({
  providers: [
    {
      provide: PrismaTenantService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new PrismaTenantService(config.getOrThrow<string>('DB_APP_URL')),
    },
    {
      provide: PrismaSystemService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new PrismaSystemService(config.getOrThrow<string>('DB_SYSTEM_URL')),
    },
  ],
  exports: [PrismaTenantService, PrismaSystemService],
})
export class DatabaseModule {}
