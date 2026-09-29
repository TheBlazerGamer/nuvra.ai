import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { MensagemEmail } from '../src/email/email.transport.js';
import { iniciarBancoDeTeste } from './helpers/banco-de-teste.js';

// Sobe a API inteira sobre um Postgres real e cobre o fluxo de conectar/desconectar o Telegram:
// gerar o link, "clicar" nele (webhook simulado), e as tentativas de abuso desse fluxo.

const ORIGEM = 'http://localhost:3000';
const SENHA = 'uma-senha-bem-longa-123';
const SEGREDO_WEBHOOK = 'segredo-de-teste-do-webhook';
const CABECALHO_SEGREDO = 'x-telegram-bot-api-secret-token';

let banco: Awaited<ReturnType<typeof iniciarBancoDeTeste>>;
let app: NestExpressApplication;
const mensagensEnviadas: { chatId: string; texto: string }[] = [];

const http = () => request(app.getHttpServer());

const post = (caminho: string, corpo: object, cookie?: string) => {
  let req = http().post(caminho).set('Origin', ORIGEM).send(corpo);
  if (cookie) req = req.set('Cookie', cookie);
  return req;
};
const del = (caminho: string, cookie: string) => http().delete(caminho).set('Origin', ORIGEM).set('Cookie', cookie);
const get = (caminho: string, cookie: string) => http().get(caminho).set('Cookie', cookie);

// segredo: null pede uma requisição sem o cabeçalho do segredo (diferente de "não informado" = usa o certo).
const webhook = (corpo: object, segredo: string | null = SEGREDO_WEBHOOK) => {
  let req = http().post('/canais/telegram/webhook').send(corpo);
  if (segredo !== null) req = req.set(CABECALHO_SEGREDO, segredo);
  return req;
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

let contadorContas = 0;
const novaContaComSessao = async (): Promise<string> => {
  const email = `cliente${++contadorContas}@exemplo.com`;
  const caixaAntes = caixa.length;
  await post('/auth/cadastro', { nome: 'Fulana de Tal', email, senha: SENHA }).expect(202);
  await aguardarTarefas();
  const emailVerificacao = caixa.slice(caixaAntes).find((m) => m.para === email);
  if (!emailVerificacao) throw new Error('E-mail de verificação não enviado.');
  await post('/auth/verificar-email', { token: tokenDoEmail(emailVerificacao) }).expect(204);
  const login = await post('/auth/login', { email, senha: SENHA }).expect(200);
  return cookieDe(login);
};

const caixa: MensagemEmail[] = [];
let aguardarTarefas: () => Promise<void>;

beforeAll(async () => {
  banco = await iniciarBancoDeTeste(54393);

  process.env.NODE_ENV = 'test';
  process.env.WEB_ORIGIN = ORIGEM;
  process.env.DB_APP_URL = banco.urls.app;
  process.env.DB_SYSTEM_URL = banco.urls.system;
  process.env.AUTH_RATE_LIMIT_PER_MIN = '1000';
  process.env.SENHAS_VAZADAS = 'desligado';
  process.env.TELEGRAM_BOT_TOKEN = 'token-fake-de-teste';
  process.env.TELEGRAM_BOT_USERNAME = 'nuvra_bot';
  process.env.TELEGRAM_WEBHOOK_SECRET = SEGREDO_WEBHOOK;

  const { AppModule } = await import('../src/app.module.js');
  const { AuthService } = await import('../src/auth/auth.service.js');
  const { SenhaVazadaService } = await import('../src/auth/senha-vazada.service.js');
  const { EMAIL_TRANSPORT } = await import('../src/email/email.transport.js');
  const { TelegramApiService } = await import('../src/canais/telegram/telegram-api.service.js');
  const { configurarApp } = await import('../src/app.setup.js');

  const modulo = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EMAIL_TRANSPORT)
    .useValue({ enviar: async (m: MensagemEmail) => void caixa.push(m) })
    .overrideProvider(SenhaVazadaService)
    .useValue({ estaVazada: async () => false })
    .overrideProvider(TelegramApiService)
    .useValue({
      enviarMensagem: async (chatId: string, texto: string) => void mensagensEnviadas.push({ chatId, texto }),
    })
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

describe('conectar e desconectar o Telegram', () => {
  it('gera o link, o webhook confirma o vínculo e o perfil passa a mostrar telegramConectado', async () => {
    const cookie = await novaContaComSessao();

    const { body } = await post('/canais/telegram/vincular', {}, cookie).expect(200);
    expect(body.link).toMatch(/^https:\/\/t\.me\/nuvra_bot\?start=[\w-]+$/);
    const token = new URL(body.link).searchParams.get('start')!;

    await webhook({ message: { chat: { id: 999 }, from: { id: 999 }, text: `/start ${token}` } }).expect(200);
    expect(mensagensEnviadas.at(-1)).toEqual({ chatId: '999', texto: expect.stringContaining('Conta conectada') });

    const perfil = await get('/auth/eu', cookie).expect(200);
    expect(perfil.body.telegramConectado).toBe(true);

    await del('/canais/telegram', cookie).expect(204);
    const perfilDepois = await get('/auth/eu', cookie).expect(200);
    expect(perfilDepois.body.telegramConectado).toBe(false);
  });

  it('recusa o webhook sem o segredo certo', async () => {
    await webhook({ message: { chat: { id: 1 }, text: '/start x' } }, 'segredo-errado').expect(403);
    await webhook({ message: { chat: { id: 1 }, text: '/start x' } }, null).expect(403);
  });

  it('um token inválido, expirado ou já usado não vincula nada', async () => {
    const cookie = await novaContaComSessao();
    const antes = mensagensEnviadas.length;

    await webhook({ message: { chat: { id: 1001 }, from: { id: 1001 }, text: '/start token-que-nao-existe' } }).expect(
      200,
    );
    expect(mensagensEnviadas.at(-1)?.texto).toMatch(/expirou|inválido/i);

    const { body } = await post('/canais/telegram/vincular', {}, cookie).expect(200);
    const token = new URL(body.link).searchParams.get('start')!;

    // primeiro clique vincula, o segundo (mesmo token) já não vale mais
    await webhook({ message: { chat: { id: 1002 }, from: { id: 1002 }, text: `/start ${token}` } }).expect(200);
    await webhook({ message: { chat: { id: 1003 }, from: { id: 1003 }, text: `/start ${token}` } }).expect(200);
    expect(mensagensEnviadas.at(-1)?.texto).toMatch(/expirou|inválido/i);
    expect(mensagensEnviadas.length).toBe(antes + 3);
  });

  it('recusa vincular a mesma conta do Telegram a dois clientes diferentes', async () => {
    const clienteA = await novaContaComSessao();
    const clienteB = await novaContaComSessao();

    const linkA = (await post('/canais/telegram/vincular', {}, clienteA).expect(200)).body.link;
    await webhook({
      message: { chat: { id: 2001 }, from: { id: 2001 }, text: `/start ${new URL(linkA).searchParams.get('start')}` },
    }).expect(200);

    const linkB = (await post('/canais/telegram/vincular', {}, clienteB).expect(200)).body.link;
    await webhook({
      message: { chat: { id: 2001 }, from: { id: 2001 }, text: `/start ${new URL(linkB).searchParams.get('start')}` },
    }).expect(200);

    expect(mensagensEnviadas.at(-1)?.texto).toMatch(/já está conectada/i);
    const perfilB = await get('/auth/eu', clienteB).expect(200);
    expect(perfilB.body.telegramConectado).toBe(false);
  });

  it('limita quantos links de conexão podem ser gerados por hora', async () => {
    const cookie = await novaContaComSessao();
    for (let i = 0; i < 5; i++) {
      await post('/canais/telegram/vincular', {}, cookie).expect(200);
    }
    await post('/canais/telegram/vincular', {}, cookie).expect(429);
  });

  it('duas cliques simultâneos no mesmo link só vinculam uma vez (corrida de verdade, não sequencial)', async () => {
    const cookie = await novaContaComSessao();
    const { body } = await post('/canais/telegram/vincular', {}, cookie).expect(200);
    const token = new URL(body.link).searchParams.get('start')!;

    const respostas = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        webhook({ message: { chat: { id: 4000 + i }, from: { id: 4000 + i }, text: `/start ${token}` } }),
      ),
    );
    expect(respostas.every((r) => r.status === 200)).toBe(true);

    const mensagensDesteToken = mensagensEnviadas.filter((m) => Number(m.chatId) >= 4000 && Number(m.chatId) < 4008);
    const sucessos = mensagensDesteToken.filter((m) => m.texto.includes('Conta conectada'));
    expect(sucessos).toHaveLength(1);

    const perfil = await get('/auth/eu', cookie).expect(200);
    expect(perfil.body.telegramConectado).toBe(true);
  });

  it('uma mensagem qualquer sem /start recebe uma resposta de ajuda, sem vincular nada', async () => {
    await webhook({ message: { chat: { id: 3001 }, from: { id: 3001 }, text: 'oi' } }).expect(200);
    expect(mensagensEnviadas.at(-1)?.texto).toMatch(/não entendi/i);
  });
});
