import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { AuditoriaService } from './auditoria.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailVerificadoGuard } from './email-verificado.guard.js';
import { PoliticaSenhaService } from './politica-senha.service.js';
import { SenhaService } from './senha.service.js';
import { SenhaVazadaService } from './senha-vazada.service.js';
import { SessaoGuard } from './sessao.guard.js';
import { SessaoService } from './sessao.service.js';
import { TokensEmailService } from './tokens-email.service.js';

@Module({
  imports: [EmailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SenhaService,
    SenhaVazadaService,
    PoliticaSenhaService,
    SessaoService,
    SessaoGuard,
    EmailVerificadoGuard,
    TokensEmailService,
    AuditoriaService,
  ],
  // Outros módulos protegem rotas com @UseGuards(SessaoGuard, EmailVerificadoGuard) importando este módulo.
  exports: [SessaoService, SessaoGuard, EmailVerificadoGuard, AuditoriaService, AuthService],
})
export class AuthModule {}
