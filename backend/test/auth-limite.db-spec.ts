import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { iniciarBancoDeTeste } from './helpers/banco-de-teste.js';

// Limite de requisições por IP nas rotas de autenticação (contra tentativa automatizada em massa).

const ORIGEM = 'http://localhost:3000';
const LIMITE = 3;

let banco: Awaited<ReturnType<typeof iniciarBancoDeTeste>>;
let app: NestExpressApplication;

beforeAll(async () => {
  banco = await iniciarBancoDeTeste(54392);

  process.env.NODE_ENV = 'test';
  process.env.WEB_ORIGIN = ORIGEM;
  process.env.DB_APP_URL = banco.urls.app;
  process.env.DB_SYSTEM_URL = banco.urls.system;
  process.env.AUTH_RATE_LIMIT_PER_MIN = String(LIMITE);

  const { AppModule } = await import('../src/app.module.js');
  const { configurarApp } = await import('../src/app.setup.js');
  const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = modulo.createNestApplication<NestExpressApplication>();
  configurarApp(app);
  await app.init();
}, 180_000);

afterAll(async () => {
  await app?.close();
  await banco?.parar();
}, 60_000);

it(`a partir da tentativa ${LIMITE + 1} no mesmo minuto o login responde 429`, async () => {
  const tentar = () =>
    request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', ORIGEM)
      .send({ email: 'alguem@exemplo.com', senha: 'senha-qualquer-123' });

  for (let i = 0; i < LIMITE; i++) {
    expect((await tentar()).status).toBe(401);
  }
  expect((await tentar()).status).toBe(429);
});
