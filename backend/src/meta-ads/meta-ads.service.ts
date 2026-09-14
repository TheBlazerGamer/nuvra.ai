import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DestinoConversa, ObjetivoCampanha } from '@prisma/client';
import { OBJETIVO_META } from './meta-ads.types.js';

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

@Injectable()
export class MetaAdsService {
  private readonly logger = new Logger(MetaAdsService.name);
  private readonly accessToken: string;

  constructor(private readonly configService: ConfigService) {
    this.accessToken = this.configService.getOrThrow<string>('META_SYSTEM_USER_TOKEN');
  }

  private async chamarGraphApi<T>(
    path: string,
    metodo: 'GET' | 'POST' | 'DELETE',
    corpo?: Record<string, unknown>,
  ): Promise<T> {
    const url = new URL(`${GRAPH_API_BASE}/${path}`);

    const opcoes: RequestInit = { method: metodo };

    if (metodo === 'GET') {
      url.searchParams.set('access_token', this.accessToken);
      if (corpo) {
        for (const [chave, valor] of Object.entries(corpo)) {
          url.searchParams.set(chave, typeof valor === 'string' ? valor : JSON.stringify(valor));
        }
      }
    } else {
      const params = new URLSearchParams();
      params.set('access_token', this.accessToken);
      if (corpo) {
        for (const [chave, valor] of Object.entries(corpo)) {
          params.set(chave, typeof valor === 'string' ? valor : JSON.stringify(valor));
        }
      }
      opcoes.body = params;
    }

    const resposta = await fetch(url, opcoes);
    const dados = (await resposta.json()) as T & { error?: { message: string; type: string } };

    if (!resposta.ok || (dados as { error?: unknown }).error) {
      const erro = (dados as { error?: { message: string } }).error;
      this.logger.error(`Erro na Meta Marketing API (${path}): ${erro?.message}`);
      throw new Error(erro?.message ?? 'Erro desconhecido na Meta Marketing API.');
    }

    return dados;
  }

  async criarCampanha(params: {
    contaAnuncioId: string;
    nome: string;
    objetivo: ObjetivoCampanha;
  }): Promise<{ id: string }> {
    return this.chamarGraphApi(`act_${params.contaAnuncioId}/campaigns`, 'POST', {
      name: params.nome,
      objective: OBJETIVO_META[params.objetivo],
      status: 'PAUSED',
      special_ad_categories: [],
    });
  }

  async criarConjuntoAnuncios(params: {
    contaAnuncioId: string;
    campanhaId: string;
    nome: string;
    valorInvestidoCentavos: number;
    publicoAlvo: Record<string, unknown>;
    destinoConversa?: DestinoConversa | null;
  }): Promise<{ id: string }> {
    return this.chamarGraphApi(`act_${params.contaAnuncioId}/adsets`, 'POST', {
      name: params.nome,
      campaign_id: params.campanhaId,
      daily_budget: params.valorInvestidoCentavos,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'REACH',
      targeting: params.publicoAlvo,
      status: 'PAUSED',
    });
  }

  async uploadImagem(contaAnuncioId: string, urlImagem: string): Promise<{ hash: string }> {
    const imagem = await fetch(urlImagem);
    const bytes = Buffer.from(await imagem.arrayBuffer()).toString('base64');

    const resultado = await this.chamarGraphApi<{ images: Record<string, { hash: string }> }>(
      `act_${contaAnuncioId}/adimages`,
      'POST',
      { bytes },
    );

    const [primeiraImagem] = Object.values(resultado.images);
    return { hash: primeiraImagem.hash };
  }

  async uploadVideo(contaAnuncioId: string, urlVideo: string): Promise<{ id: string }> {
    return this.chamarGraphApi(`act_${contaAnuncioId}/advideos`, 'POST', {
      file_url: urlVideo,
    });
  }

  async criarCriativo(params: {
    contaAnuncioId: string;
    nome: string;
    paginaId: string;
    mensagem: string;
    linkDestino?: string;
    imageHash?: string;
    videoId?: string;
  }): Promise<{ id: string }> {
    const objectStorySpec: Record<string, unknown> = {
      page_id: params.paginaId,
    };

    if (params.videoId) {
      objectStorySpec.video_data = {
        video_id: params.videoId,
        message: params.mensagem,
        call_to_action: params.linkDestino
          ? { type: 'LEARN_MORE', value: { link: params.linkDestino } }
          : undefined,
      };
    } else {
      objectStorySpec.link_data = {
        image_hash: params.imageHash,
        message: params.mensagem,
        link: params.linkDestino ?? 'https://www.facebook.com',
      };
    }

    return this.chamarGraphApi(`act_${params.contaAnuncioId}/adcreatives`, 'POST', {
      name: params.nome,
      object_story_spec: objectStorySpec,
    });
  }

  async criarAnuncio(params: {
    contaAnuncioId: string;
    nome: string;
    adSetId: string;
    criativoId: string;
  }): Promise<{ id: string }> {
    return this.chamarGraphApi(`act_${params.contaAnuncioId}/ads`, 'POST', {
      name: params.nome,
      adset_id: params.adSetId,
      creative: { creative_id: params.criativoId },
      status: 'PAUSED',
    });
  }

  async ativarCampanha(campanhaId: string): Promise<{ success: boolean }> {
    return this.chamarGraphApi(campanhaId, 'POST', { status: 'ACTIVE' });
  }

  async pausarCampanha(campanhaId: string): Promise<{ success: boolean }> {
    return this.chamarGraphApi(campanhaId, 'POST', { status: 'PAUSED' });
  }

  async atualizarTetoContaAnuncio(
    contaAnuncioId: string,
    tetoCentavos: number,
  ): Promise<{ success: boolean }> {
    return this.chamarGraphApi(`act_${contaAnuncioId}`, 'POST', {
      spend_cap: tetoCentavos,
    });
  }

  async obterInsightsSemanais(
    campanhaId: string,
    dataInicio: string,
    dataFim: string,
  ): Promise<{
    data: Array<{
      impressions: string;
      clicks: string;
      spend: string;
      cpc: string;
      cpm: string;
      ctr: string;
      actions?: Array<{ action_type: string; value: string }>;
    }>;
  }> {
    return this.chamarGraphApi(`${campanhaId}/insights`, 'GET', {
      time_range: { since: dataInicio, until: dataFim },
      fields: 'impressions,clicks,spend,cpc,cpm,ctr,actions',
    });
  }
}
