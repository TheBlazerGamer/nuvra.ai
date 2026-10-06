import { createHmac } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AtivoMeta, TokenMeta } from '../src/meta/meta-graph.service.js';
import type { MensagemEmail } from '../src/email/email.transport.js';
import { iniciarBancoDeTeste } from './helpers/banco-de-teste.js';

// Sobe a API inteira sobre um Postgres real e cobre o fluxo de login com a Meta: gerar o link de
// autorização, "voltar" da Meta (callback simulado), escolher a conta de anúncio e desconectar.
// A Graph API é trocada por um dublê controlável — não fazemos chamadas reais à Meta nos testes.

const ORIGEM = 'http://localhost:3000';
const API_ORIGIN = 'http://localhost:3001';
const SENHA = 'uma-senha-bem-longa-123';

let banco: Awaited<ReturnType<typeof iniciarBancoDeTeste>>;
let app: NestExpressApplication;
const caixa: MensagemEmail[] = [];
let aguardarTarefas: () => Promise<void>;

// Controla o que o dublê da Graph API devolve em cada teste.
let contasFake: AtivoMeta[] = [{ id: 'act_1', nome: 'Conta Única' }];
let paginasFake: AtivoMeta[] = [{ id: '1001', nome: 'Página Única' }]; // Páginas que podem anunciar pela conta
let paginasDoUsuarioFake: AtivoMeta[] = []; // Páginas que o usuário administra diretamente
let autorizadasFake: Set<string> | null = null; // contas liberadas na tela da Meta (null = Meta não informa restrição)
let usuarioMetaFake = 'meta_user_0';
let sequenciaUsuario = 0;
const chamadasGraph: string[] = [];

const SEGREDO_META = 'segredo-meta-fake';
const signedRequest = (userId: string, segredo = SEGREDO_META) => {
  const dados = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: userId, issued_at: 1 })).toString('base64url');
  return `${createHmac('sha256', segredo).update(dados).digest('base64url')}.${dados}`;
};
// Chamadas da própria Meta: sem cookie e sem Origin, corpo em formulário.
const avisoDaMeta = (caminho: string, corpo: Record<string, string>) => http().post(caminho).type('form').send(corpo);

const http = () => request(app.getHttpServer());
const post = (caminho: string, corpo: object, cookie?: string) => {
  let req = http().post(caminho).set('Origin', ORIGEM).send(corpo);
  if (cookie) req = req.set('Cookie', cookie);
  return req;
};
const get = (caminho: string, cookie?: string) => {
  const req = http().get(caminho);
  return cookie ? req.set('Cookie', cookie) : req;
};

const cookieDe = (res: request.Response): string => {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cookies?.find((c) => c.startsWith('nuvra_sessao='));
  if (!cookie) throw new Error('Resposta sem cookie de sessão.');
  return cookie.split(';')[0];
};
const tokenDoEmail = (email: MensagemEmail): string => {
  const achado = /#token=([^\s]+)/.exec(email.texto);
  if (!achado) throw new Error('E-mail sem link com token');
  return decodeURIComponent(achado[1]);
};

let contador = 0;
const novaContaComSessao = async (): Promise<string> => {
  const email = `cliente${++contador}@exemplo.com`;
  const antes = caixa.length;
  await post('/auth/cadastro', { nome: 'Fulana de Tal', email, senha: SENHA }).expect(202);
  await aguardarTarefas();
  const emailVerificacao = caixa.slice(antes).find((m) => m.para === email);
  if (!emailVerificacao) throw new Error('E-mail de verificação não enviado.');
  await post('/auth/verificar-email', { token: tokenDoEmail(emailVerificacao) }).expect(204);
  const login = await post('/auth/login', { email, senha: SENHA }).expect(200);
  return cookieDe(login);
};

// Simula a ida e volta da Meta: pega o "state" gerado por /meta/conectar e chama /meta/callback com ele.
const conectarESimularVolta = async (cookie: string, code = 'codigo-fake') => {
  const conectar = await get('/meta/conectar', cookie).expect(302);
  const url = new URL(conectar.headers.location);
  const state = url.searchParams.get('state')!;
  return { url, callback: () => http().get(`/meta/callback?state=${state}&code=${code}`) };
};

beforeAll(async () => {
  banco = await iniciarBancoDeTeste(54394);

  process.env.NODE_ENV = 'test';
  process.env.WEB_ORIGIN = ORIGEM;
  process.env.API_ORIGIN = API_ORIGIN;
  process.env.DB_APP_URL = banco.urls.app;
  process.env.DB_SYSTEM_URL = banco.urls.system;
  process.env.AUTH_RATE_LIMIT_PER_MIN = '1000';
  process.env.SENHAS_VAZADAS = 'desligado';
  process.env.TELEGRAM_BOT_TOKEN = 'token-fake';
  process.env.TELEGRAM_BOT_USERNAME = 'nuvra_bot';
  process.env.TELEGRAM_WEBHOOK_SECRET = 'segredo-fake';
  process.env.META_APP_ID = '999888777';
  process.env.META_APP_SECRET = SEGREDO_META;
  process.env.META_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');

  const { AppModule } = await import('../src/app.module.js');
  const { AuthService } = await import('../src/auth/auth.service.js');
  const { SenhaVazadaService } = await import('../src/auth/senha-vazada.service.js');
  const { EMAIL_TRANSPORT } = await import('../src/email/email.transport.js');
  const { MetaGraphService } = await import('../src/meta/meta-graph.service.js');
  const { configurarApp } = await import('../src/app.setup.js');

  const dublemGraph = {
    trocarCodigoPorToken: async (code: string): Promise<TokenMeta> => {
      chamadasGraph.push(`trocarCodigo:${code}`);
      return { accessToken: 'curto-fake' };
    },
    paraTokenDeLongaDuracao: async (): Promise<TokenMeta> => {
      chamadasGraph.push('longaDuracao');
      return { accessToken: 'longo-fake', expiraEmSegundos: 5_184_000 };
    },
    obterUsuario: async () => {
      chamadasGraph.push('obterUsuario');
      return { id: usuarioMetaFake };
    },
    listarContasDeAnuncio: async (): Promise<AtivoMeta[]> => {
      chamadasGraph.push('listarContas');
      return contasFake;
    },
    contasAutorizadas: async () => {
      chamadasGraph.push('contasAutorizadas');
      return autorizadasFake;
    },
    listarPaginas: async (): Promise<AtivoMeta[]> => {
      chamadasGraph.push('listarPaginas');
      return paginasDoUsuarioFake;
    },
    listarPaginasDaConta: async (_token: string, contaId: string): Promise<AtivoMeta[]> => {
      chamadasGraph.push(`listarPaginasDaConta:${contaId}`);
      return paginasFake;
    },
  };

  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EMAIL_TRANSPORT)
    .useValue({ enviar: async (m: MensagemEmail) => void caixa.push(m) })
    .overrideProvider(SenhaVazadaService)
    .useValue({ estaVazada: async () => false })
    .overrideProvider(MetaGraphService)
    .useValue(dublemGraph)
    .compile();

  app = modulo.createNestApplication<NestExpressApplication>();
  configurarApp(app);
  await app.init();
  aguardarTarefas = () => app.get(AuthService, { strict: false }).aguardarTarefas();
}, 180_000);

afterAll(async () => {
  await app?.close();
  await banco?.parar();
}, 60_000);

beforeEach(() => {
  contasFake = [{ id: 'act_1', nome: 'Conta Única' }];
  paginasFake = [{ id: '1001', nome: 'Página Única' }];
  paginasDoUsuarioFake = [];
  autorizadasFake = null;
  chamadasGraph.length = 0;
  usuarioMetaFake = `meta_user_${++sequenciaUsuario}`;
});

describe('login com a Meta', () => {
  it('gera o link de autorização com o state amarrado ao cliente e o redirect_uri certo', async () => {
    const cookie = await novaContaComSessao();
    const res = await get('/meta/conectar', cookie).expect(302);
    const url = new URL(res.headers.location);

    expect(url.origin + url.pathname).toBe('https://www.facebook.com/v21.0/dialog/oauth');
    expect(url.searchParams.get('client_id')).toBe('999888777');
    expect(url.searchParams.get('redirect_uri')).toBe(`${API_ORIGIN}/meta/callback`);
    expect(url.searchParams.get('scope')).toContain('ads_management');
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('callback com state inválido redireciona pra tela de erro sem chamar a Graph API', async () => {
    const res = await http().get('/meta/callback?state=lixo-nunca-existiu&code=abc');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${ORIGEM}/conta?meta=erro`);
    expect(chamadasGraph).toHaveLength(0);
  });

  it('erro vindo da própria Meta (ex.: usuário cancelou) redireciona pra erro sem tentar nada', async () => {
    const res = await http().get('/meta/callback?error=access_denied&error_message=O+usu%C3%A1rio+cancelou');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${ORIGEM}/conta?meta=erro`);
    expect(chamadasGraph).toHaveLength(0);
  });

  it('com uma única conta de anúncio e uma única Página, conecta e já seleciona as duas', async () => {
    const cookie = await novaContaComSessao();
    const { callback } = await conectarESimularVolta(cookie);

    const res = await callback();
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(`${ORIGEM}/conta?meta=conectado`);

    const status = await get('/meta/status', cookie).expect(200);
    expect(status.body).toMatchObject({
      tipoToken: 'USUARIO',
      contaAnuncioId: 'act_1',
      contaAnuncioNome: 'Conta Única',
      paginaId: '1001',
      paginaNome: 'Página Única',
    });
    expect(JSON.stringify(status.body)).not.toMatch(/longo-fake|curto-fake|token_criptografado/i);
  });

  it('com uma conta e várias Páginas, escolhe a conta mas NÃO adivinha a Página', async () => {
    paginasFake = [
      { id: '1001', nome: 'Página A' },
      { id: '1002', nome: 'Página B' },
    ];
    const cookie = await novaContaComSessao();
    const { callback } = await conectarESimularVolta(cookie);
    await callback().expect(302);

    const status = await get('/meta/status', cookie).expect(200);
    expect(status.body.contaAnuncioId).toBe('act_1');
    expect(status.body.paginaId).toBeNull();
  });

  it('só mostra e só usa as contas que o cliente liberou na tela da Meta (mesmo que o perfil enxergue mais)', async () => {
    contasFake = [
      { id: 'act_1', nome: 'Conta de outro cliente da agência' },
      { id: 'act_2', nome: 'Conta da Nuvra' },
      { id: 'act_3', nome: 'Outra conta da agência' },
    ];
    autorizadasFake = new Set(['act_2']);
    const cookie = await novaContaComSessao();
    const { callback } = await conectarESimularVolta(cookie);
    await callback().expect(302);

    // só uma foi liberada, então já vem escolhida
    expect((await get('/meta/status', cookie).expect(200)).body.contaAnuncioId).toBe('act_2');
    expect((await get('/meta/ativos', cookie).expect(200)).body.contas).toEqual([
      { id: 'act_2', nome: 'Conta da Nuvra' },
    ]);

    // tentar escolher uma conta que não foi liberada é recusado e nada muda
    await post('/meta/selecionar', { contaAnuncioId: 'act_1' }, cookie).expect(400);
    await get('/meta/paginas?conta=act_1', cookie).expect(400);
    expect((await get('/meta/status', cookie).expect(200)).body.contaAnuncioId).toBe('act_2');
  });

  it('com mais de uma conta, conecta mas deixa o cliente escolher conta e Página depois', async () => {
    contasFake = [
      { id: 'act_1', nome: 'Conta 1' },
      { id: 'act_2', nome: 'Conta 2' },
    ];
    const cookie = await novaContaComSessao();
    const { callback } = await conectarESimularVolta(cookie);
    await callback().expect(302);

    const statusAntes = await get('/meta/status', cookie).expect(200);
    expect(statusAntes.body.contaAnuncioId).toBeNull();

    const ativos = await get('/meta/ativos', cookie).expect(200);
    expect(ativos.body).toEqual({ contas: contasFake });

    // sem o ID da conta, ou com um ID fora do formato, a API recusa
    await post('/meta/selecionar', { contaAnuancioId: 'ignorado' }, cookie).expect(400);
    await post('/meta/selecionar', { contaAnuncioId: '../../me/accounts' }, cookie).expect(400);

    await post('/meta/selecionar', { contaAnuncioId: 'act_2', paginaId: '1001' }, cookie).expect(204);

    // nomes vêm da Meta, não do navegador
    const statusDepois = await get('/meta/status', cookie).expect(200);
    expect(statusDepois.body).toMatchObject({
      contaAnuncioId: 'act_2',
      contaAnuncioNome: 'Conta 2',
      paginaId: '1001',
      paginaNome: 'Página Única',
    });
  });

  it('lista as Páginas da conta escolhida (sem repetir) e recusa Página que a conta não pode usar', async () => {
    contasFake = [
      { id: 'act_1', nome: 'Conta 1' },
      { id: 'act_2', nome: 'Conta 2' },
    ];
    paginasFake = [{ id: '1001', nome: 'Página A' }];
    paginasDoUsuarioFake = [
      { id: '1001', nome: 'Página A' },
      { id: '1002', nome: 'Página B' },
    ];
    const cookie = await novaContaComSessao();
    const { callback } = await conectarESimularVolta(cookie);
    await callback().expect(302);

    const paginas = await get('/meta/paginas?conta=act_1', cookie).expect(200);
    expect(paginas.body.paginas).toEqual([
      { id: '1001', nome: 'Página A' },
      { id: '1002', nome: 'Página B' },
    ]);
    expect(chamadasGraph).toContain('listarPaginasDaConta:act_1');

    await get('/meta/paginas', cookie).expect(400);
    await get('/meta/paginas?conta=lixo', cookie).expect(400);

    await post('/meta/selecionar', { contaAnuncioId: 'act_1', paginaId: '9999' }, cookie).expect(400);
    expect((await get('/meta/status', cookie).expect(200)).body.contaAnuncioId).toBeNull();
  });

  it('trocar para uma conta sem Página apaga a Página antiga (não deixa a anterior para trás)', async () => {
    const cookie = await novaContaComSessao();
    const { callback } = await conectarESimularVolta(cookie);
    await callback().expect(302);
    expect((await get('/meta/status', cookie).expect(200)).body.paginaId).toBe('1001');

    await post('/meta/selecionar', { contaAnuncioId: 'act_1' }, cookie).expect(204);
    const status = await get('/meta/status', cookie).expect(200);
    expect(status.body.paginaId).toBeNull();
    expect(status.body.paginaNome).toBeNull();
  });

  it('reenviar o mesmo callback (state já usado) na segunda vez dá erro', async () => {
    const cookie = await novaContaComSessao();
    const { callback } = await conectarESimularVolta(cookie);

    await callback().expect(302).expect('Location', `${ORIGEM}/conta?meta=conectado`);
    const segunda = await callback();
    expect(segunda.headers.location).toBe(`${ORIGEM}/conta?meta=erro`);
  });

  it('oito voltas simultâneas com o mesmo state só completam a conexão uma vez (corrida de verdade)', async () => {
    const cookie = await novaContaComSessao();
    const { callback } = await conectarESimularVolta(cookie);

    const respostas = await Promise.all(Array.from({ length: 8 }, () => callback()));
    const sucessos = respostas.filter((r) => r.headers.location === `${ORIGEM}/conta?meta=conectado`);
    expect(sucessos).toHaveLength(1);
    expect(chamadasGraph.filter((c) => c === 'longaDuracao')).toHaveLength(1);
  });

  it('desconectar apaga a conexão', async () => {
    const cookie = await novaContaComSessao();
    const { callback } = await conectarESimularVolta(cookie);
    await callback().expect(302);
    expect((await get('/meta/status', cookie).expect(200)).body).not.toBeNull();

    await http().delete('/meta/conexao').set('Origin', ORIGEM).set('Cookie', cookie).expect(204);
    // Handler retorna null: o Nest manda corpo vazio (sem Content-Type), não o literal "null".
    const depois = await get('/meta/status', cookie).expect(200);
    expect(depois.text).toBe('');
  });

  it('sem conexão, /meta/ativos dá 404 em vez de estourar chamando a Meta sem token', async () => {
    const cookie = await novaContaComSessao();
    await get('/meta/ativos', cookie).expect(404);
    expect(chamadasGraph).toHaveLength(0);
  });

  describe('avisos da própria Meta (desautorização e exclusão de dados)', () => {
    const conectar = async () => {
      usuarioMetaFake = `meta_user_${++sequenciaUsuario}`;
      const cookie = await novaContaComSessao();
      const { callback } = await conectarESimularVolta(cookie);
      await callback().expect(302);
      return { cookie, metaUserId: usuarioMetaFake };
    };
    const temConexao = async (cookie: string) => (await get('/meta/status', cookie).expect(200)).text !== '';

    it('desautorização assinada apaga a conexão de quem removeu o app, e só a dele', async () => {
      const a = await conectar();
      const b = await conectar();

      const res = await avisoDaMeta('/meta/desautorizacao', { signed_request: signedRequest(a.metaUserId) });
      expect(res.status).toBe(200);

      expect(await temConexao(a.cookie)).toBe(false);
      expect(await temConexao(b.cookie)).toBe(true);
    });

    it('recusa assinatura forjada, sem signed_request ou de outro segredo — e nada é apagado', async () => {
      const a = await conectar();

      await avisoDaMeta('/meta/desautorizacao', { signed_request: signedRequest(a.metaUserId, 'segredo-de-um-atacante') }).expect(400);
      await avisoDaMeta('/meta/desautorizacao', { signed_request: 'lixo.lixo' }).expect(400);
      await avisoDaMeta('/meta/desautorizacao', {}).expect(400);
      await avisoDaMeta('/meta/exclusao-dados', { signed_request: signedRequest(a.metaUserId, 'segredo-de-um-atacante') }).expect(400);

      expect(await temConexao(a.cookie)).toBe(true);
    });

    it('exclusão de dados apaga a conexão e responde com a URL e o código que a Meta exige', async () => {
      const a = await conectar();

      const res = await avisoDaMeta('/meta/exclusao-dados', { signed_request: signedRequest(a.metaUserId) }).expect(200);
      expect(res.body.confirmation_code).toMatch(/^[0-9a-f]{24}$/);
      expect(res.body.url).toBe(`${ORIGEM}/exclusao-de-dados?codigo=${res.body.confirmation_code}`);
      expect(await temConexao(a.cookie)).toBe(false);
    });

    it('usuário que não conhecemos recebe a mesma resposta normal (não revela quem é cliente)', async () => {
      const res = await avisoDaMeta('/meta/exclusao-dados', { signed_request: signedRequest('ninguem-conhecido') }).expect(200);
      expect(res.body.confirmation_code).toBeTruthy();
      await avisoDaMeta('/meta/desautorizacao', { signed_request: signedRequest('ninguem-conhecido') }).expect(200);
    });
  });
});
