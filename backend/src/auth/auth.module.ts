import { Module } from '@nestjs/common';
import { AuditoriaService } from './auditoria.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SenhaService } from './senha.service.js';
import { SessaoGuard } from './sessao.guard.js';
import { SessaoService } from './sessao.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SenhaService, SessaoService, SessaoGuard, AuditoriaService],
  // Outros módulos protegem rotas com @UseGuards(SessaoGuard) importando este módulo.
  exports: [SessaoService, SessaoGuard, AuditoriaService],
})
export class AuthModule {}
