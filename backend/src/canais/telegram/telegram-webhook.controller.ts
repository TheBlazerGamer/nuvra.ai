import { Body, ConflictException, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuditoriaService } from '../../auth/auditoria.service.js';
import { PermitirSemOrigem } from '../../auth/origem.guard.js';
import { TokensCanalService } from '../tokens-canal.service.js';
import { VinculosCanalService } from '../vinculos-canal.service.js';
import { TelegramApiService } from './telegram-api.service.js';
import { TelegramWebhookGuard } from './telegram-webhook.guard.js';

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    from?: { id: number };
    text?: string;
  };
}

const COMANDO_START = /^\/start(?:@\w+)?(?:\s+(\S+))?$/;

const MSG_SEM_CODIGO = 'Para conectar sua conta, gere o link em nuvra.ai e clique nele — não é preciso digitar nada aqui.';
const MSG_CODIGO_INVALIDO = 'Este link expirou ou já foi usado. Gere um novo link em nuvra.ai e tente de novo.';
const MSG_CONECTADO = 'Conta conectada! A partir de agora você recebe seus relatórios e alertas por aqui.';
const MSG_AJUDA = 'Não entendi essa mensagem. Se você quer conectar sua conta, gere o link em nuvra.ai.';

// Só faz uma coisa por enquanto: ligar (ou recusar ligar) este chat do Telegram a uma conta da Nuvra.
// A conversa de verdade (análise de criativo, aprovação, relatórios) entra depois, num módulo à parte
// que fala com este só por mensagens normalizadas (ver docs/plano-migracao-whatsapp.md).
@Controller('canais/telegram')
export class TelegramWebhookController {
  constructor(
    private readonly tokens: TokensCanalService,
    private readonly vinculos: VinculosCanalService,
    private readonly telegram: TelegramApiService,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  @PermitirSemOrigem()
  @UseGuards(TelegramWebhookGuard)
  async webhook(@Body() update: TelegramUpdate): Promise<void> {
    const mensagem = update.message;
    const texto = mensagem?.text?.trim();
    if (!mensagem || !texto) return;

    const chatId = String(mensagem.chat.id);
    const idExterno = String(mensagem.from?.id ?? mensagem.chat.id);

    const comando = COMANDO_START.exec(texto);
    if (!comando) {
      await this.telegram.enviarMensagem(chatId, MSG_AJUDA);
      return;
    }

    const token = comando[1];
    if (!token) {
      await this.telegram.enviarMensagem(chatId, MSG_SEM_CODIGO);
      return;
    }

    const registro = await this.tokens.validar(token, 'TELEGRAM');
    if (!registro || !(await this.tokens.marcarUsado(registro.id))) {
      await this.telegram.enviarMensagem(chatId, MSG_CODIGO_INVALIDO);
      return;
    }

    try {
      await this.vinculos.vincular(registro.clienteId, 'TELEGRAM', idExterno, chatId);
    } catch (erro) {
      if (erro instanceof ConflictException) {
        await this.telegram.enviarMensagem(chatId, erro.message);
        return;
      }
      throw erro;
    }

    await this.auditoria.registrar('canal_vinculado', { clienteId: registro.clienteId, detalhes: { canal: 'TELEGRAM' } });
    await this.telegram.enviarMensagem(chatId, MSG_CONECTADO);
  }
}
