import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Cliente HTTP fino para a Bot API do Telegram. Nada de lógica de conversa aqui — só transporte
// (ver docs/plano-migracao-whatsapp.md: o núcleo não conhece o canal).
@Injectable()
export class TelegramApiService {
  private readonly logger = new Logger(TelegramApiService.name);

  constructor(private readonly config: ConfigService) {}

  private base(): string {
    return `https://api.telegram.org/bot${this.config.getOrThrow<string>('TELEGRAM_BOT_TOKEN')}`;
  }

  async enviarMensagem(chatId: string, texto: string): Promise<void> {
    const resposta = await fetch(`${this.base()}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto }),
    });

    if (!resposta.ok) {
      this.logger.error(`Falha ao enviar mensagem ao Telegram (chat ${chatId}): ${resposta.status} ${await resposta.text()}`);
    }
  }
}
