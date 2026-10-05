import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const VERSAO_GRAPH = 'v21.0';
const BASE = `https://graph.facebook.com/${VERSAO_GRAPH}`;

export interface TokenMeta {
  accessToken: string;
  expiraEmSegundos?: number;
}

export interface AtivoMeta {
  id: string;
  nome: string;
}

// Cliente HTTP fino para a Graph API da Meta. Nada de lógica de conexão/persistência aqui
// (isso é do MetaConexaoService) — só transporte, igual ao TelegramApiService.
@Injectable()
export class MetaGraphService {
  private readonly logger = new Logger(MetaGraphService.name);

  constructor(private readonly config: ConfigService) {}

  private credenciais() {
    return {
      clientId: this.config.getOrThrow<string>('META_APP_ID'),
      clientSecret: this.config.getOrThrow<string>('META_APP_SECRET'),
    };
  }

  private async obter<T>(caminho: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE}${caminho}`);
    for (const [chave, valor] of Object.entries(params)) url.searchParams.set(chave, valor);

    const resposta = await fetch(url);
    const corpo = (await resposta.json().catch(() => null)) as
      | (T & { error?: { message: string; type: string; code: number } })
      | null;

    if (!resposta.ok || !corpo || corpo.error) {
      this.logger.error(`Erro na Graph API (${caminho}): ${corpo?.error?.message ?? resposta.statusText}`);
      throw new InternalServerErrorException('Não foi possível falar com a Meta agora. Tente novamente em instantes.');
    }
    return corpo;
  }

  async trocarCodigoPorToken(code: string, redirectUri: string): Promise<TokenMeta> {
    const { clientId, clientSecret } = this.credenciais();
    const dados = await this.obter<{ access_token: string; expires_in?: number }>('/oauth/access_token', {
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code,
    });
    return { accessToken: dados.access_token, expiraEmSegundos: dados.expires_in };
  }

  // Token de usuário de 60 dias a partir do de curta duração recebido na troca do código.
  async paraTokenDeLongaDuracao(tokenCurto: string): Promise<TokenMeta> {
    const { clientId, clientSecret } = this.credenciais();
    const dados = await this.obter<{ access_token: string; expires_in?: number }>('/oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: tokenCurto,
    });
    return { accessToken: dados.access_token, expiraEmSegundos: dados.expires_in };
  }

  // ID do usuário na Meta (específico do nosso app), o mesmo que a Meta manda nos avisos de desautorização.
  async obterUsuario(accessToken: string): Promise<{ id: string }> {
    const dados = await this.obter<{ id: string }>('/me', { fields: 'id', access_token: accessToken });
    return { id: dados.id };
  }

  async listarContasDeAnuncio(accessToken: string): Promise<AtivoMeta[]> {
    const dados = await this.obter<{ data: { id: string; name: string }[] }>('/me/adaccounts', {
      fields: 'id,name',
      access_token: accessToken,
    });
    return dados.data.map((c) => ({ id: c.id, nome: c.name }));
  }

  async listarPaginas(accessToken: string): Promise<AtivoMeta[]> {
    const dados = await this.obter<{ data: { id: string; name: string }[] }>('/me/accounts', {
      fields: 'id,name',
      access_token: accessToken,
    });
    return dados.data.map((p) => ({ id: p.id, nome: p.name }));
  }
}
