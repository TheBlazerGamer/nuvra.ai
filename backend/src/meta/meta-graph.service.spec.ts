import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MetaGraphService } from './meta-graph.service.js';

const config = {
  getOrThrow: (chave: string) => ({ META_APP_ID: '111', META_APP_SECRET: 'segredo-do-app' })[chave],
} as unknown as ConfigService;

const BASE = 'https://graph.facebook.com/v21.0';
const resposta = (corpo: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } }));

const servico = () => new MetaGraphService(config);

afterEach(() => vi.unstubAllGlobals());

describe('MetaGraphService.contasAutorizadas', () => {
  it('devolve só as contas liberadas na tela da Meta, aceitando IDs com ou sem o prefixo act_', async () => {
    vi.stubGlobal('fetch', () =>
      resposta({ data: { scopes: ['ads_management'], granular_scopes: [{ scope: 'ads_management', target_ids: ['2', 'act_3'] }] } }),
    );
    expect(await servico().contasAutorizadas('token-do-cliente')).toEqual(new Set(['act_2', 'act_3']));
  });

  it('usa ads_read quando só ele traz a restrição', async () => {
    vi.stubGlobal('fetch', () =>
      resposta({ data: { granular_scopes: [{ scope: 'ads_management' }, { scope: 'ads_read', target_ids: ['7'] }] } }),
    );
    expect(await servico().contasAutorizadas('t')).toEqual(new Set(['act_7']));
  });

  it('devolve null (sem filtro) quando a Meta não informa restrição', async () => {
    for (const data of [{}, { granular_scopes: [] }, { granular_scopes: [{ scope: 'ads_management', target_ids: [] }] }]) {
      vi.stubGlobal('fetch', () => resposta({ data }));
      expect(await servico().contasAutorizadas('t')).toBeNull();
    }
  });

  it('manda o token do cliente como input_token e o do app como access_token', async () => {
    const chamadas: string[] = [];
    vi.stubGlobal('fetch', (url: string | URL) => {
      chamadas.push(String(url));
      return resposta({ data: {} });
    });
    await servico().contasAutorizadas('token-do-cliente');

    const url = new URL(chamadas[0]);
    expect(url.pathname).toBe('/v21.0/debug_token');
    expect(url.searchParams.get('input_token')).toBe('token-do-cliente');
    expect(url.searchParams.get('access_token')).toBe('111|segredo-do-app');
  });

  it('propaga o erro da Meta como falha genérica, sem vazar o token', async () => {
    vi.stubGlobal('fetch', () => resposta({ error: { message: 'Invalid OAuth access token', type: 'OAuthException', code: 190 } }, 400));
    await expect(servico().contasAutorizadas('token-secreto')).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});

describe('MetaGraphService: listas', () => {
  it('segue as páginas de resultados da Meta até o fim (a Meta entrega 25 por vez)', async () => {
    const proxima = `${BASE}/me/adaccounts?after=cursor1&access_token=t`;
    vi.stubGlobal('fetch', (url: string | URL) =>
      String(url).includes('after=cursor1')
        ? resposta({ data: [{ id: 'act_3', name: 'C' }] })
        : resposta({ data: [{ id: 'act_1', name: 'A' }, { id: 'act_2', name: 'B' }], paging: { next: proxima } }),
    );
    expect(await servico().listarContasDeAnuncio('t')).toEqual([
      { id: 'act_1', nome: 'A' },
      { id: 'act_2', nome: 'B' },
      { id: 'act_3', nome: 'C' },
    ]);
  });

  it('nunca segue um link de "próxima página" que aponte para fora da Graph API', async () => {
    const chamadas: string[] = [];
    vi.stubGlobal('fetch', (url: string | URL) => {
      chamadas.push(String(url));
      return resposta({ data: [{ id: 'act_1', name: 'A' }], paging: { next: 'https://site-malicioso.example/roubar?x=1' } });
    });
    expect(await servico().listarContasDeAnuncio('t')).toEqual([{ id: 'act_1', nome: 'A' }]);
    expect(chamadas).toHaveLength(1);
  });

  it('recusa um ID de conta fora do formato act_ + números, sem chamar a Meta', async () => {
    const fetchEspiao = vi.fn();
    vi.stubGlobal('fetch', fetchEspiao);
    for (const ruim of ['', 'act_', 'act_12a', '123', 'act_1/../me', 'act_1?fields=x', '../act_1']) {
      await expect(servico().listarPaginasDaConta('t', ruim)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(fetchEspiao).not.toHaveBeenCalled();
  });

  it('lista as Páginas que podem anunciar pela conta', async () => {
    const chamadas: string[] = [];
    vi.stubGlobal('fetch', (url: string | URL) => {
      chamadas.push(String(url));
      return resposta({ data: [{ id: '1001', name: 'Página A' }] });
    });
    expect(await servico().listarPaginasDaConta('t', 'act_55')).toEqual([{ id: '1001', nome: 'Página A' }]);
    expect(new URL(chamadas[0]).pathname).toBe('/v21.0/act_55/promote_pages');
  });
});
