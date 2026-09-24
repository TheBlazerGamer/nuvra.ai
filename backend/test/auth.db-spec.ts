import { createHash } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { PrismaSystemService } from '../src/database/prisma-system.service.js';
import { iniciarBancoDeTeste } from './helpers/banco-de-teste.js';

// Sobe a API inteira (mesma configuração de produção) sobre um Postgres real e tenta atacar o login.

const ORIGEM = 'http://localhost:3000';
const SENHA = 'uma-senha-bem-longa-123';

let banco: Awaited<ReturnType<typeof iniciarBancoDeTeste>>;
let app: NestExpressApplication;
let system: PrismaSystemService;

const http = () => request(app.getHttpServer());

const post = (caminho: string, corpo: object, cookie?: string) => {
  let req = http().post(caminho).set('Origin', ORIGEM).send(corpo);
  if (cookie) req = req.set('Cookie', cookie);
  return req;
};

const cookieDe = (res: request.Response): string => {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cookies?.find((c) => c.startsWith('nuvra_sessao='));
  if (!cookie) throw new Error('Resposta sem cookie de sessão.');
  return cookie;
};
const tokenDe = (cookie: string) => cookie.split(';')[0].split('=')[1];
const paraEnvio = (cookie: string) => cookie.split(';')[0];

const cadastrar = (email: string, nome = 'Fulana de Tal') =>
  post('/auth/cadastro', { nome, email, senha: SENHA });

beforeAll(async () => {
  banco = await iniciarBancoDeTeste(54391);

  process.env.NODE_ENV = 'test';
  process.env.WEB_ORIGIN = ORIGEM;
  process.env.DB_APP_URL = banco.urls.app;
  process.env.DB_SYSTEM_URL = banco.urls.system;
  process.env.AUTH_RATE_LIMIT_PER_MIN = '1000';

  const { AppModule } = await import('../src/app.module.js');
  const { configurarApp } = await import('../src/app.setup.js');
  const { PrismaSystemService } = await import('../src/database/prisma-system.service.js');

  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = modulo.createNestApplication<NestExpressApplication>();
  configurarApp(app);
  await app.init();
  system = app.get(PrismaSystemService);
}, 180_000);

afterAll(async () => {
  await app?.close();
  await banco?.parar();
}, 60_000);

describe('cadastro', () => {
  it('cria a conta, devolve só dados públicos e define um cookie httpOnly', async () => {
    const res = await cadastrar('ana@exemplo.com');

    expect(res.status).toBe(201);
    expect(Object.keys(res.body.cliente).sort()).toEqual(['email', 'id', 'nome']);
    expect(JSON.stringify(res.body)).not.toMatch(/senha|hash/i);

    const cookie = cookieDe(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
  });

  it('guarda a senha com argon2id e nunca em texto', async () => {
    await cadastrar('bia@exemplo.com');
    const { senhaHash } = await system.cliente.findUniqueOrThrow({
      where: { email: 'bia@exemplo.com' },
      select: { senhaHash: true },
    });
    expect(senhaHash.startsWith('$argon2id$')).toBe(true);
    expect(senhaHash).not.toContain(SENHA);
  });

  it('guarda no banco só o hash do token da sessão, nunca o token', async () => {
    const res = await cadastrar('caio@exemplo.com');
    const token = tokenDe(cookieDe(res));
    const hashEsperado = createHash('sha256').update(token).digest('hex');

    const sessoes = await system.sessao.findMany({ select: { tokenHash: true } });
    expect(sessoes.map((s) => s.tokenHash)).toContain(hashEsperado);
    expect(sessoes.map((s) => s.tokenHash)).not.toContain(token);
  });

  it('normaliza o e-mail para minúsculas e recusa e-mail repetido', async () => {
    const primeiro = await cadastrar('  Diana@Exemplo.COM ');
    expect(primeiro.status).toBe(201);
    expect(primeiro.body.cliente.email).toBe('diana@exemplo.com');

    const repetido = await cadastrar('diana@exemplo.com');
    expect(repetido.status).toBe(409);
  });

  it('recusa senha curta, senha igual ao e-mail e dados inválidos', async () => {
    expect((await post('/auth/cadastro', { nome: 'X Y', email: 'e1@exemplo.com', senha: 'curta' })).status).toBe(400);
    expect(
      (await post('/auth/cadastro', { nome: 'X Y', email: 'longo-email-igual@exemplo.com', senha: 'longo-email-igual@exemplo.com' })).status,
    ).toBe(400);
    expect((await post('/auth/cadastro', { nome: 'X Y', email: 'nao-e-email', senha: SENHA })).status).toBe(400);
    expect((await post('/auth/cadastro', { nome: 'X Y', email: 'e2@exemplo.com', senha: 'a'.repeat(5000) })).status).toBe(400);
  });

  it('recusa campos extras (não dá para se cadastrar já como suspenso ou escolher o id)', async () => {
    const res = await post('/auth/cadastro', {
      nome: 'Intruso',
      email: 'intruso@exemplo.com',
      senha: SENHA,
      status: 'SUSPENSO',
      id: '00000000-0000-0000-0000-000000000000',
    });
    expect(res.status).toBe(400);
  });
});

describe('sessão e isolamento', () => {
  it('/auth/eu exige sessão e cada cliente só vê a si mesmo', async () => {
    expect((await http().get('/auth/eu')).status).toBe(401);

    const a = await cadastrar('eva@exemplo.com', 'Eva');
    const b = await cadastrar('fabio@exemplo.com', 'Fabio');

    const euA = await http().get('/auth/eu').set('Cookie', paraEnvio(cookieDe(a)));
    const euB = await http().get('/auth/eu').set('Cookie', paraEnvio(cookieDe(b)));

    expect(euA.status).toBe(200);
    expect(euA.body.cliente.email).toBe('eva@exemplo.com');
    expect(euA.body.telegramConectado).toBe(false);
    expect(euB.body.cliente.email).toBe('fabio@exemplo.com');
  });

  it('rejeita cookie inventado ou adulterado', async () => {
    const res = await http().get('/auth/eu').set('Cookie', 'nuvra_sessao=token-inventado');
    expect(res.status).toBe(401);
  });

  it('logout revoga a sessão: o mesmo cookie deixa de funcionar', async () => {
    const cad = await cadastrar('gabi@exemplo.com');
    const cookie = paraEnvio(cookieDe(cad));

    expect((await http().get('/auth/eu').set('Cookie', cookie)).status).toBe(200);
    expect((await post('/auth/logout', {}, cookie)).status).toBe(204);
    expect((await http().get('/auth/eu').set('Cookie', cookie)).status).toBe(401);
  });

  it('sessão expirada não funciona', async () => {
    const cad = await cadastrar('hugo@exemplo.com');
    const cookie = paraEnvio(cookieDe(cad));
    await system.sessao.updateMany({
      where: { cliente: { email: 'hugo@exemplo.com' } },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });
    expect((await http().get('/auth/eu').set('Cookie', cookie)).status).toBe(401);
  });

  it('conta suspensa perde o acesso imediatamente, mesmo com sessão aberta', async () => {
    const cad = await cadastrar('iris@exemplo.com');
    const cookie = paraEnvio(cookieDe(cad));
    expect((await http().get('/auth/eu').set('Cookie', cookie)).status).toBe(200);

    await system.cliente.update({ where: { email: 'iris@exemplo.com' }, data: { status: 'SUSPENSO' } });

    expect((await http().get('/auth/eu').set('Cookie', cookie)).status).toBe(401);
    const login = await post('/auth/login', { email: 'iris@exemplo.com', senha: SENHA });
    expect(login.status).toBe(401);
  });
});

describe('login', () => {
  it('senha errada e e-mail inexistente recebem exatamente a mesma resposta', async () => {
    await cadastrar('joao@exemplo.com');
    const senhaErrada = await post('/auth/login', { email: 'joao@exemplo.com', senha: 'senha-errada-123456' });
    const semConta = await post('/auth/login', { email: 'ninguem@exemplo.com', senha: 'senha-errada-123456' });

    expect(senhaErrada.status).toBe(401);
    expect(semConta.status).toBe(401);
    expect(senhaErrada.body).toEqual(semConta.body);
  });

  it('login correto abre uma sessão nova', async () => {
    const cad = await cadastrar('karla@exemplo.com');
    const login = await post('/auth/login', { email: 'KARLA@exemplo.com', senha: SENHA });

    expect(login.status).toBe(200);
    expect(tokenDe(cookieDe(login))).not.toBe(tokenDe(cookieDe(cad)));
    expect((await http().get('/auth/eu').set('Cookie', paraEnvio(cookieDe(login)))).status).toBe(200);
  });

  it('bloqueia a conta após 5 senhas erradas, inclusive para a senha certa (força bruta)', async () => {
    await cadastrar('leo@exemplo.com');

    for (let i = 0; i < 5; i++) {
      const res = await post('/auth/login', { email: 'leo@exemplo.com', senha: `errada-numero-${i}-xxxx` });
      expect(res.status).toBe(401);
    }

    const bloqueado = await post('/auth/login', { email: 'leo@exemplo.com', senha: SENHA });
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.headers['set-cookie']).toBeUndefined();

    // Passado o tempo de bloqueio, a senha certa volta a funcionar.
    await system.cliente.update({ where: { email: 'leo@exemplo.com' }, data: { bloqueadoAte: new Date(Date.now() - 1000) } });
    expect((await post('/auth/login', { email: 'leo@exemplo.com', senha: SENHA })).status).toBe(200);
  });
});

describe('proteções da API', () => {
  it('exige a origem do nosso site em requisições que alteram dados (CSRF)', async () => {
    const corpo = { email: 'qualquer@exemplo.com', senha: SENHA };

    const deOutroSite = await http().post('/auth/login').set('Origin', 'http://site-malicioso.example').send(corpo);
    const semOrigem = await http().post('/auth/login').send(corpo);

    expect(deOutroSite.status).toBe(403);
    expect(semOrigem.status).toBe(403);
  });

  it('envia cabeçalhos de segurança e não revela o framework', async () => {
    const res = await http().get('/saude');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('a trilha de auditoria registra os eventos sem senha nem token', async () => {
    const eventos = await system.eventoAuditoria.findMany({ select: { tipo: true, detalhes: true } });
    const tipos = new Set(eventos.map((e) => e.tipo));

    for (const esperado of ['cadastro', 'login_ok', 'login_falha', 'conta_bloqueada', 'login_bloqueado', 'logout']) {
      expect(tipos).toContain(esperado);
    }

    const tudo = JSON.stringify(eventos);
    expect(tudo).not.toContain(SENHA);
    expect(tudo).not.toMatch(/argon2|token/i);
  });
});
