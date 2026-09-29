import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CanaisController } from './canais.controller.js';
import { TelegramApiService } from './telegram/telegram-api.service.js';
import { TelegramWebhookController } from './telegram/telegram-webhook.controller.js';
import { TelegramWebhookGuard } from './telegram/telegram-webhook.guard.js';
import { TokensCanalService } from './tokens-canal.service.js';
import { VinculosCanalService } from './vinculos-canal.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CanaisController, TelegramWebhookController],
  providers: [TokensCanalService, VinculosCanalService, TelegramApiService, TelegramWebhookGuard],
})
export class CanaisModule {}
