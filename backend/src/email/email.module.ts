import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.js';
import { EMAIL_TRANSPORT, type EmailTransport } from './email.transport.js';
import { ArquivoTransport } from './transportes/arquivo.transport.js';
import { SmtpTransport } from './transportes/smtp.transport.js';

@Module({
  providers: [
    {
      provide: EMAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EmailTransport => {
        if (config.get<string>('EMAIL_TRANSPORT') === 'smtp') {
          return new SmtpTransport(
            {
              host: config.getOrThrow<string>('SMTP_HOST'),
              porta: Number(config.get<string>('SMTP_PORT') ?? 587),
              usuario: config.getOrThrow<string>('SMTP_USER'),
              senha: config.getOrThrow<string>('SMTP_PASS'),
            },
            config.getOrThrow<string>('EMAIL_FROM'),
          );
        }
        return new ArquivoTransport(config.get<string>('EMAIL_DEV_DIR') ?? '.emails-dev');
      },
    },
    EmailService,
  ],
  exports: [EmailService],
})
export class EmailModule {}
