import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { OrigemGuard } from './auth/origem.guard.js';
import { CanaisModule } from './canais/canais.module.js';
import { validarAmbiente } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';

// Resolvido a partir deste arquivo (não de process.cwd()): o .env é sempre o de backend/,
// não importa de qual diretório o processo é iniciado (ex.: um gerenciador de preview na raiz do projeto).
const RAIZ_BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..');

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validarAmbiente,
      envFilePath: join(RAIZ_BACKEND, '.env'),
    }),
    // Limite geral por IP; as rotas de login/cadastro têm um limite bem menor (ver AuthController).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    DatabaseModule,
    AuthModule,
    CanaisModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OrigemGuard },
  ],
})
export class AppModule {}
