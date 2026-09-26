import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailTransport, MensagemEmail } from '../email.transport.js';

export class SmtpTransport implements EmailTransport {
  private readonly transporter: Transporter;

  constructor(
    config: { host: string; porta: number; usuario: string; senha: string },
    private readonly remetente: string,
  ) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.porta,
      secure: config.porta === 465,
      // Em 587 exige STARTTLS: nunca envia credenciais nem e-mails em texto puro.
      requireTLS: config.porta !== 465,
      auth: { user: config.usuario, pass: config.senha },
      connectionTimeout: 10_000,
      socketTimeout: 15_000,
    });
  }

  // Confere conexão, criptografia e login no servidor SMTP sem enviar nada.
  async verificar(): Promise<void> {
    await this.transporter.verify();
  }

  async enviar(mensagem: MensagemEmail): Promise<void> {
    await this.transporter.sendMail({
      from: this.remetente,
      to: mensagem.para,
      subject: mensagem.assunto,
      text: mensagem.texto,
      html: mensagem.html,
    });
  }
}
