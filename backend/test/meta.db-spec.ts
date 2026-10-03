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
let paginasFake: AtivoMeta[] = [{ id: 'pg_1', nome: 'Página Única' }];
const chamadasGraph: string[] = [];

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
  process.env.META_APP_SECRET = 'segredo-meta-fake';
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
    listarContasDeAnuncio: async (): Promise<AtivoMeta[]> => {
      chamadasGraph.push('listarContas');
      return contasFake;
    },
    listarPaginas: async (): Promise<AtivoMeta[]> => {
      chamadasGraph.push('listarPaginas');
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
  paginasFake = [{ id: 'pg_1', nome: 'Página Única' }];
  chamadasGraph.length = 0;
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

  it('com uma única conta de anúncio, conecta e já seleciona automaticamente', async () => {
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
      paginaId: 'pg_1',
      paginaNome: 'Página Única',
    });
    expect(JSON.stringify(status.body)).not.toMatch(/longo-fake|curto-fake|token_criptografado/i);
  });

  it('com mais de uma conta, conecta mas deixa o cliente escolher depois', async () => {
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
    expect(ativos.body.contas).toEqual(contasFake);

    await post('/meta/selecionar', { contaAnuancioId: 'ignorado' }, cookie).expect(400);
    await post(
      '/meta/selecionar',
      { contaAnuncioId: 'act_2', contaAnuncioNome: 'Conta 2', paginaId: 'pg_1', paginaNome: 'Página Única' },
      cookie,
    ).expect(204);

    const statusDepois = await get('/meta/status', cookie).expect(200);
    expect(statusDepois.body.contaAnuncioId).toBe('act_2');
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
});
