import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { TipoCriativo } from '@prisma/client';

export interface AnaliseCriativo {
  qualidade: number; // 0-10
  apeloVisual: number; // 0-10
  adequacaoNicho: number; // 0-10
  performanceEsperada: 'baixa' | 'media' | 'alta';
  observacoes: string;
  sugestaoPublico?: string;
  sugestaoPosicionamento?: string[];
}

const PROMPT_ANALISE = `Você é um especialista em tráfego pago (Meta Ads). Analise o criativo enviado e o histórico de performance do cliente fornecido.
Responda EXCLUSIVAMENTE em JSON válido, sem markdown, no formato:
{
  "qualidade": <0-10>,
  "apeloVisual": <0-10>,
  "adequacaoNicho": <0-10>,
  "performanceEsperada": "baixa" | "media" | "alta",
  "observacoes": "<texto curto explicando a nota>",
  "sugestaoPublico": "<descrição sucinta do público sugerido>",
  "sugestaoPosicionamento": ["Feed", "Reels", "Stories"]
}`;

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
    this.model = this.configService.get<string>('ANTHROPIC_MODEL', 'claude-sonnet-5');
  }

  async analisarCriativo(params: {
    tipo: TipoCriativo;
    imagemBase64?: string;
    imagemMimeType?: string;
    historicoCliente: unknown;
    objetivoCampanha: string;
  }): Promise<AnaliseCriativo> {
    const contexto = `Histórico de campanhas anteriores do cliente (JSON): ${JSON.stringify(
      params.historicoCliente,
    )}\nObjetivo da campanha atual: ${params.objetivoCampanha}`;

    const content: Anthropic.MessageParam['content'] = [];

    if (params.tipo === TipoCriativo.IMAGEM && params.imagemBase64 && params.imagemMimeType) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: params.imagemMimeType as
            | 'image/jpeg'
            | 'image/png'
            | 'image/gif'
            | 'image/webp',
          data: params.imagemBase64,
        },
      });
    }

    content.push({ type: 'text', text: `${PROMPT_ANALISE}\n\n${contexto}` });

    const resposta = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
    });

    const bloco = resposta.content.find((b) => b.type === 'text');
    if (!bloco || bloco.type !== 'text') {
      throw new Error('Resposta da IA não retornou conteúdo textual.');
    }

    try {
      return JSON.parse(bloco.text) as AnaliseCriativo;
    } catch (erro) {
      this.logger.error(`Falha ao interpretar JSON da IA: ${bloco.text}`, erro as Error);
      throw new Error('Não foi possível interpretar a análise da IA.');
    }
  }
}
