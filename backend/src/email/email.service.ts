import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_TRANSPORT, type EmailTransport } from './email.transport.js';
import {
  emailContaExistente,
  emailRecuperacao,
  emailSenhaAlterada,
  emailVerificacao,
} from './templates.js';

// Os links levam o token no fragmento (#token=...): o fragmento nunca é enviado a servidores,
// então o token não aparece em logs do proxy nem no cabeçalho Referer.
@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_TRANSPORT) private readonly transporte: EmailTransport,
    private readonly config: ConfigService,
  ) {}

  private url(caminho: string, token?: string): string {
    const base = this.config.getOrThrow<string>('WEB_ORIGIN').replace(/\/$/, '');
    return token ? `${base}${caminho}#token=${encodeURIComponent(token)}` : `${base}${caminho}`;
  }

  enviarVerificacao(para: string, nome: string, token: string) {
    return this.transporte.enviar({ para, ...emailVerificacao(nome, this.url('/verificar-email', token)) });
  }

  enviarContaExistente(para: string) {
    return this.transporte.enviar({
      para,
      ...emailContaExistente(this.url('/login'), this.url('/esqueci-senha')),
    });
  }

  enviarRecuperacao(para: string, nome: string, token: string) {
    return this.transporte.enviar({ para, ...emailRecuperacao(nome, this.url('/redefinir-senha', token)) });
  }

  enviarSenhaAlterada(para: string, nome: string) {
    return this.transporte.enviar({ para, ...emailSenhaAlterada(nome, this.url('/esqueci-senha')) });
  }
}
