import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const VERSAO_GRAPH = 'v21.0';
const BASE = `https://graph.facebook.com/${VERSAO_GRAPH}`;

const MAX_PAGINAS = 20;
// Vai dentro do caminho da URL: só aceitamos o formato real (act_ + números), nada que altere o caminho.
const ID_CONTA_ANUNCIO = /^act_\d+$/;

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
    return this.obterUrl<T>(url.toString(), caminho);
  }

  private async obterUrl<T>(endereco: string, caminho = '(próxima página)'): Promise<T> {
    const resposta = await fetch(endereco);
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

  // A Graph API entrega listas em páginas de 25; uma agência com dezenas de contas ficaria com a lista cortada.
  // Seguimos o link "próxima página" (só se for da própria Graph API) até um teto de segurança.
  private async obterTodos(caminho: string, params: Record<string, string>): Promise<{ id: string; name: string }[]> {
    type Pagina = { data: { id: string; name: string }[]; paging?: { next?: string } };
    const itens: { id: string; name: string }[] = [];
    let pagina = await this.obter<Pagina>(caminho, { ...params, limit: '100' });
    for (let i = 0; i < MAX_PAGINAS; i++) {
      itens.push(...pagina.data);
      const proxima = pagina.paging?.next;
      if (!proxima || !proxima.startsWith(`${BASE}/`)) break;
      pagina = await this.obterUrl<Pagina>(proxima);
    }
    return itens;
  }

  async listarContasDeAnuncio(accessToken: string): Promise<AtivoMeta[]> {
    const dados = await this.obterTodos('/me/adaccounts', { fields: 'id,name', access_token: accessToken });
    return dados.map((c) => ({ id: c.id, nome: c.name }));
  }

  // Contas de anúncio que a pessoa AUTORIZOU de verdade na tela da Meta ("todas" ou "só algumas"). A lista
  // /me/adaccounts mostra tudo o que o perfil enxerga e nem sempre respeita essa escolha; já o "debug_token"
  // traz os IDs liberados em cada permissão. Devolve null quando a Meta não informa restrição (sem filtro).
  async contasAutorizadas(accessToken: string): Promise<Set<string> | null> {
    const { clientId, clientSecret } = this.credenciais();
    const dados = await this.obter<{
      data?: { scopes?: string[]; granular_scopes?: { scope: string; target_ids?: string[] }[] };
    }>('/debug_token', { input_token: accessToken, access_token: `${clientId}|${clientSecret}` });

    const granulares = dados.data?.granular_scopes ?? [];
    // Só nomes de permissões e quantidades (nunca token nem IDs): serve para entender o que a Meta informa.
    this.logger.log(
      `Permissões da conexão: concedidas=[${(dados.data?.scopes ?? []).join(',')}] ` +
        `restritas=[${granulares.map((s) => `${s.scope}:${s.target_ids?.length ?? 0}`).join(',')}]`,
    );

    // A escolha de contas na tela da Meta vale para as permissões de anúncio; usa a primeira que tiver restrição.
    for (const nome of ['ads_management', 'ads_read']) {
      const escopo = granulares.find((s) => s.scope === nome && s.target_ids?.length);
      if (escopo?.target_ids) {
        return new Set(escopo.target_ids.map((id) => (id.startsWith('act_') ? id : `act_${id}`)));
      }
    }
    return null;
  }

  // Páginas do próprio usuário (as que ele administra diretamente).
  async listarPaginas(accessToken: string): Promise<AtivoMeta[]> {
    const dados = await this.obterTodos('/me/accounts', { fields: 'id,name', access_token: accessToken });
    return dados.map((p) => ({ id: p.id, nome: p.name }));
  }

  // Páginas que podem ser usadas para anunciar a partir desta conta de anúncio (inclui as que vêm pelo portfólio
  // empresarial). É a lista certa para a escolha, porque todo anúncio precisa de uma Página.
  async listarPaginasDaConta(accessToken: string, contaId: string): Promise<AtivoMeta[]> {
    if (!ID_CONTA_ANUNCIO.test(contaId)) throw new BadRequestException('Conta de anúncio inválida.');
    const dados = await this.obterTodos(`/${contaId}/promote_pages`, { fields: 'id,name', access_token: accessToken });
    return dados.map((p) => ({ id: p.id, nome: p.name }));
  }
}
