import { createHash } from 'node:crypto';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { PrismaSystemService } from '../src/database/prisma-system.service.js';
import type { MensagemEmail } from '../src/email/email.transport.js';
import { iniciarBancoDeTeste } from './helpers/banco-de-teste.js';

// Sobe a API inteira (mesma configuração de produção) sobre um Postgres real e tenta atacar a autenticação.
// O e-mail é capturado em memória: o teste "lê" os links exatamente como o cliente leria.

const ORIGEM = 'http://localhost:3000';
const SENHA = 'uma-senha-bem-longa-123';
const NOVA_SENHA = 'outra-senha-igualmente-longa-456';
const SENHA_VAZADA = 'senha-que-vazou-em-algum-lugar';

let banco: Awaited<ReturnType<typeof iniciarBancoDeTeste>>;
let app: NestExpressApplication;
let system: PrismaSystemService;
let aguardarTarefas: () => Promise<void>;
const caixa: MensagemEmail[] = [];

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
const del = (caminho: string, cookie: string) =>
  http().delete(caminho).set('Origin', ORIGEM).set('Cookie', cookie);

const cookieDe = (res: request.Response): string => {
  const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = cookies?.find((c) => c.startsWith('nuvra_sessao='));
  if (!cookie) throw new Error('Resposta sem cookie de sessão.');
  return cookie;
};
const tokenDe = (cookie: string) => cookie.split(';')[0].split('=')[1];
const paraEnvio = (cookie: string) => cookie.split(';')[0];

const emailsPara = (para: string) => caixa.filter((m) => m.para === para);
const ultimoEmail = (para: string): MensagemEmail => {
  const email = emailsPara(para).at(-1);
  if (!email) throw new Error(`Nenhum e-mail para ${para}`);
  return email;
};
const tokenDoEmail = (email: MensagemEmail): string => {
  const achado = /#token=([^\s]+)/.exec(email.texto);
  if (!achado) throw new Error('E-mail sem link com token');
  return decodeURIComponent(achado[1]);
};

const cadastrar = async (email: string, senha = SENHA) => {
  const res = await post('/auth/cadastro', { nome: 'Fulana de Tal', email, senha });
  await aguardarTarefas();
  return res;
};
const verificar = async (email: string) => {
  await post('/auth/verificar-email', { token: tokenDoEmail(ultimoEmail(email)) }).expect(204);
};
const contaVerificada = async (email: string) => {
  await cadastrar(email).then((r) => expect(r.status).toBe(202));
  await verificar(email);
};
const entrar = (email: string, senha = SENHA) => post('/auth/login', { email, senha });
const sessaoAberta = async (email: string, senha = SENHA): Promise<string> =>
  paraEnvio(cookieDe(await entrar(email, senha).expect(200)));
const contaComSessao = async (email: string) => {
  await contaVerificada(email);
  return sessaoAberta(email);
};


beforeAll(async () => {
  banco = await iniciarBancoDeTeste(54391);

  process.env.NODE_ENV = 'test';
  process.env.WEB_ORIGIN = ORIGEM;
  process.env.DB_APP_URL = banco.urls.app;
  process.env.DB_SYSTEM_URL = banco.urls.system;
  process.env.AUTH_RATE_LIMIT_PER_MIN = '1000';
  process.env.SENHAS_VAZADAS = 'desligado';

  const { AppModule } = await import('../src/app.module.js');
  const { AuthModule } = await import('../src/auth/auth.module.js');
  const { AuthService } = await import('../src/auth/auth.service.js');
  const { SenhaVazadaService } = await import('../src/auth/senha-vazada.service.js');
  const { EMAIL_TRANSPORT } = await import('../src/email/email.transport.js');
  const { configurarApp } = await import('../src/app.setup.js');
  const { PrismaSystemService } = await import('../src/database/prisma-system.service.js');
  const { SessaoGuard } = await import('../src/auth/sessao.guard.js');
  const { EmailVerificadoGuard } = await import('../src/auth/email-verificado.guard.js');

  @Controller('teste')
  class ControladorTeste {
    @Get('sensivel')
    @UseGuards(SessaoGuard, EmailVerificadoGuard)
    sensivel() {
      return { ok: true };
    }
  }

  const modulo = await Test.createTestingModule({
    imports: [AppModule, AuthModule],
    controllers: [ControladorTeste],
  })
    .overrideProvider(EMAIL_TRANSPORT)
    .useValue({ enviar: async (m: MensagemEmail) => void caixa.push(m) })
    .overrideProvider(SenhaVazadaService)
    .useValue({ estaVazada: async (senha: string) => senha === SENHA_VAZADA })
    .compile();

  app = modulo.createNestApplication<NestExpressApplication>();
  configurarApp(app);
  await app.init();
  system = app.get(PrismaSystemService);
  aguardarTarefas = () => app.get(AuthService, { strict: false }).aguardarTarefas();
}, 180_000);

afterAll(async () => {
  await app?.close();
  await banco?.parar();
}, 60_000);

describe('cadastro', () => {
  it('responde 202 genérico, NÃO abre sessão e envia e-mail com o token no fragmento do link', async () => {
    const res = await cadastrar('ana@exemplo.com');

    expect(res.status).toBe(202);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/senha|hash|id/i);

    const email = ultimoEmail('ana@exemplo.com');
    expect(email.texto).toContain('/verificar-email#token=');
    expect(email.texto).not.toContain('?token=');
  });

  it('guarda a senha com argon2id e o token de e-mail só como hash', async () => {
    await cadastrar('bia@exemplo.com');
    const cliente = await system.cliente.findUniqueOrThrow({
      where: { email: 'bia@exemplo.com' },
      select: { senhaHash: true, emailVerificadoEm: true },
    });
    expect(cliente.senhaHash.startsWith('$argon2id$')).toBe(true);
    expect(cliente.senhaHash).not.toContain(SENHA);
    expect(cliente.emailVerificadoEm).toBeNull();

    const token = tokenDoEmail(ultimoEmail('bia@exemplo.com'));
    const hashes = (await system.tokenEmail.findMany({ select: { tokenHash: true } })).map((t) => t.tokenHash);
    expect(hashes).toContain(createHash('sha256').update(token).digest('hex'));
    expect(hashes).not.toContain(token);
  });

  it('e-mail que já tem conta recebe a MESMA resposta (não revela quem é cliente) e um aviso ao dono', async () => {
    const primeiro = await cadastrar('caio@exemplo.com');
    const repetido = await cadastrar('caio@exemplo.com');

    expect(repetido.status).toBe(primeiro.status);
    expect(repetido.body).toEqual(primeiro.body);
    expect(await system.cliente.count({ where: { email: 'caio@exemplo.com' } })).toBe(1);
    expect(ultimoEmail('caio@exemplo.com').assunto).toMatch(/já tem uma conta/i);
  });

  it('normaliza o e-mail para minúsculas', async () => {
    await cadastrar('  Diana@Exemplo.COM ');
    expect(await system.cliente.count({ where: { email: 'diana@exemplo.com' } })).toBe(1);
  });

  it('recusa senha curta, igual ao e-mail, vazada e dados inválidos', async () => {
    const tenta = (corpo: object) => post('/auth/cadastro', corpo);
    expect((await tenta({ nome: 'X Y', email: 'e1@exemplo.com', senha: 'curta' })).status).toBe(400);
    expect((await tenta({ nome: 'X Y', email: 'longo-email-igual@exemplo.com', senha: 'longo-email-igual@exemplo.com' })).status).toBe(400);
    expect((await tenta({ nome: 'X Y', email: 'nao-e-email', senha: SENHA })).status).toBe(400);
    expect((await tenta({ nome: 'X Y', email: 'e2@exemplo.com', senha: 'a'.repeat(5000) })).status).toBe(400);

    const vazada = await tenta({ nome: 'X Y', email: 'e3@exemplo.com', senha: SENHA_VAZADA });
    expect(vazada.status).toBe(400);
    expect(JSON.stringify(vazada.body)).toMatch(/vazamentos/i);
    expect(await system.cliente.count({ where: { email: 'e3@exemplo.com' } })).toBe(0);
  });

  it('recusa campos extras (não dá para se cadastrar já como suspenso ou verificado)', async () => {
    const res = await post('/auth/cadastro', {
      nome: 'Intruso',
      email: 'intruso@exemplo.com',
      senha: SENHA,
      status: 'SUSPENSO',
      emailVerificadoEm: new Date().toISOString(),
    });
    expect(res.status).toBe(400);
  });
});

describe('verificação de e-mail', () => {
  it('o link verifica a conta, só uma vez', async () => {
    await cadastrar('eva@exemplo.com');
    const cookie = await sessaoAberta('eva@exemplo.com');
    expect((await get('/auth/eu', cookie)).body.emailVerificado).toBe(false);

    const token = tokenDoEmail(ultimoEmail('eva@exemplo.com'));
    expect((await post('/auth/verificar-email', { token })).status).toBe(204);
    expect((await post('/auth/verificar-email', { token })).status).toBe(400);
    expect((await get('/auth/eu', cookie)).body.emailVerificado).toBe(true);
  });

  it('recusa token inventado, expirado e token de outro tipo', async () => {
    expect((await post('/auth/verificar-email', { token: 'inventado' })).status).toBe(400);

    await cadastrar('fabio@exemplo.com');
    const token = tokenDoEmail(ultimoEmail('fabio@exemplo.com'));
    await system.tokenEmail.updateMany({
      where: { cliente: { email: 'fabio@exemplo.com' } },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });
    expect((await post('/auth/verificar-email', { token })).status).toBe(400);

    // token de recuperação de senha não serve para verificar e-mail
    await post('/auth/esqueci-senha', { email: 'fabio@exemplo.com' });
    await aguardarTarefas();
    const tokenRecuperacao = tokenDoEmail(ultimoEmail('fabio@exemplo.com'));
    expect((await post('/auth/verificar-email', { token: tokenRecuperacao })).status).toBe(400);
  });

  it('o mesmo link usado em requisições simultâneas vale só para uma (uso único atômico)', async () => {
    await cadastrar('corrida1@exemplo.com');
    const token = tokenDoEmail(ultimoEmail('corrida1@exemplo.com'));

    const respostas = await Promise.all(
      Array.from({ length: 8 }, () => post('/auth/verificar-email', { token })),
    );
    const status = respostas.map((r) => r.status);
    expect(status.filter((s) => s === 204)).toHaveLength(1);
    expect(status.filter((s) => s === 400)).toHaveLength(7);
  });

  it('recursos sensíveis exigem e-mail confirmado (EmailVerificadoGuard)', async () => {
    expect((await get('/teste/sensivel')).status).toBe(401);

    await cadastrar('gabi@exemplo.com');
    const cookie = await sessaoAberta('gabi@exemplo.com');
    expect((await get('/teste/sensivel', cookie)).status).toBe(403);

    await verificar('gabi@exemplo.com');
    expect((await get('/teste/sensivel', cookie)).status).toBe(200);
  });

  it('reenviar invalida o link anterior e há um limite por hora', async () => {
    await cadastrar('hugo@exemplo.com');
    const cookie = await sessaoAberta('hugo@exemplo.com');
    const tokenAntigo = tokenDoEmail(ultimoEmail('hugo@exemplo.com'));

    expect((await post('/auth/reenviar-verificacao', {}, cookie)).status).toBe(202);
    expect((await post('/auth/reenviar-verificacao', {}, cookie)).status).toBe(202);
    expect((await post('/auth/reenviar-verificacao', {}, cookie)).status).toBe(429);
    await aguardarTarefas();

    expect((await post('/auth/verificar-email', { token: tokenAntigo })).status).toBe(400);
    expect((await post('/auth/verificar-email', { token: tokenDoEmail(ultimoEmail('hugo@exemplo.com')) })).status).toBe(204);
  });
});

describe('recuperação de senha', () => {
  it('a resposta é idêntica exista a conta ou não, e só quem tem conta recebe e-mail', async () => {
    await contaVerificada('iris@exemplo.com');
    const existente = await post('/auth/esqueci-senha', { email: 'iris@exemplo.com' });
    const inexistente = await post('/auth/esqueci-senha', { email: 'ninguem-mesmo@exemplo.com' });
    await aguardarTarefas();

    expect(existente.status).toBe(202);
    expect(inexistente.status).toBe(202);
    expect(existente.body).toEqual(inexistente.body);
    expect(emailsPara('ninguem-mesmo@exemplo.com')).toHaveLength(0);
    expect(ultimoEmail('iris@exemplo.com').assunto).toMatch(/redefinição/i);
  });

  it('redefinir troca a senha, derruba TODAS as sessões, avisa por e-mail e o link só vale uma vez', async () => {
    await contaVerificada('joao@exemplo.com');
    const sessaoA = await sessaoAberta('joao@exemplo.com');
    const sessaoB = await sessaoAberta('joao@exemplo.com');

    await post('/auth/esqueci-senha', { email: 'joao@exemplo.com' });
    await aguardarTarefas();
    const token = tokenDoEmail(ultimoEmail('joao@exemplo.com'));

    expect((await post('/auth/redefinir-senha', { token, novaSenha: NOVA_SENHA })).status).toBe(204);
    await aguardarTarefas();

    expect((await get('/auth/eu', sessaoA)).status).toBe(401);
    expect((await get('/auth/eu', sessaoB)).status).toBe(401);
    expect((await entrar('joao@exemplo.com', SENHA)).status).toBe(401);
    expect((await entrar('joao@exemplo.com', NOVA_SENHA)).status).toBe(200);
    expect((await post('/auth/redefinir-senha', { token, novaSenha: 'mais-uma-senha-longa-789' })).status).toBe(400);
    expect(ultimoEmail('joao@exemplo.com').assunto).toMatch(/foi alterada/i);
  });

  it('o link de redefinição usado em requisições simultâneas vale só para uma', async () => {
    await contaVerificada('corrida2@exemplo.com');
    await post('/auth/esqueci-senha', { email: 'corrida2@exemplo.com' });
    await aguardarTarefas();
    const token = tokenDoEmail(ultimoEmail('corrida2@exemplo.com'));

    const respostas = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        post('/auth/redefinir-senha', { token, novaSenha: `senha-nova-numero-${i}-abcdef` }),
      ),
    );
    const status = respostas.map((r) => r.status);
    expect(status.filter((s) => s === 204)).toHaveLength(1);
    expect(status.filter((s) => s === 400)).toHaveLength(7);
  });

  it('senha nova recusada não gasta o link: dá para tentar outra', async () => {
    await contaVerificada('karla@exemplo.com');
    await post('/auth/esqueci-senha', { email: 'karla@exemplo.com' });
    await aguardarTarefas();
    const token = tokenDoEmail(ultimoEmail('karla@exemplo.com'));

    expect((await post('/auth/redefinir-senha', { token, novaSenha: 'curta' })).status).toBe(400);
    expect((await post('/auth/redefinir-senha', { token, novaSenha: 'karla@exemplo.com' })).status).toBe(400);
    expect((await post('/auth/redefinir-senha', { token, novaSenha: SENHA_VAZADA })).status).toBe(400);
    expect((await post('/auth/redefinir-senha', { token, novaSenha: NOVA_SENHA })).status).toBe(204);
  });

  it('recusa link inventado ou expirado', async () => {
    expect((await post('/auth/redefinir-senha', { token: 'inventado', novaSenha: NOVA_SENHA })).status).toBe(400);

    await contaVerificada('leo@exemplo.com');
    await post('/auth/esqueci-senha', { email: 'leo@exemplo.com' });
    await aguardarTarefas();
    const token = tokenDoEmail(ultimoEmail('leo@exemplo.com'));
    await system.tokenEmail.updateMany({
      where: { cliente: { email: 'leo@exemplo.com' }, tipo: 'RECUPERACAO_SENHA' },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });
    expect((await post('/auth/redefinir-senha', { token, novaSenha: NOVA_SENHA })).status).toBe(400);
  });

  it('limita a 3 e-mails por hora por conta (não dá para usar a Nuvra para spam)', async () => {
    await contaVerificada('marta@exemplo.com');
    const antes = emailsPara('marta@exemplo.com').length;

    for (let i = 0; i < 5; i++) {
      await post('/auth/esqueci-senha', { email: 'marta@exemplo.com' }).expect(202);
      await aguardarTarefas();
    }

    expect(emailsPara('marta@exemplo.com').length - antes).toBe(3);
    expect(await system.eventoAuditoria.count({ where: { tipo: 'recuperacao_limitada' } })).toBeGreaterThan(0);
  });

  it('quem redefine a senha por e-mail comprova o endereço e fica verificado', async () => {
    await cadastrar('nina@exemplo.com');
    await post('/auth/esqueci-senha', { email: 'nina@exemplo.com' });
    await aguardarTarefas();
    const token = tokenDoEmail(ultimoEmail('nina@exemplo.com'));
    await post('/auth/redefinir-senha', { token, novaSenha: NOVA_SENHA }).expect(204);

    const cookie = await sessaoAberta('nina@exemplo.com', NOVA_SENHA);
    expect((await get('/auth/eu', cookie)).body.emailVerificado).toBe(true);
  });
});

describe('alterar senha e sessões', () => {
  it('exige a senha atual; ao trocar, derruba os OUTROS dispositivos e mantém o atual', async () => {
    await contaVerificada('otavio@exemplo.com');
    const atual = await sessaoAberta('otavio@exemplo.com');
    const outro = await sessaoAberta('otavio@exemplo.com');

    expect((await post('/auth/alterar-senha', { senhaAtual: 'errada-errada-1234', novaSenha: NOVA_SENHA }, atual)).status).toBe(401);
    expect((await post('/auth/alterar-senha', { senhaAtual: SENHA, novaSenha: SENHA }, atual)).status).toBe(400);
    expect((await post('/auth/alterar-senha', { senhaAtual: SENHA, novaSenha: NOVA_SENHA }, atual)).status).toBe(204);
    await aguardarTarefas();

    expect((await get('/auth/eu', atual)).status).toBe(200);
    expect((await get('/auth/eu', outro)).status).toBe(401);
    expect((await entrar('otavio@exemplo.com', SENHA)).status).toBe(401);
    expect(ultimoEmail('otavio@exemplo.com').assunto).toMatch(/foi alterada/i);
  });

  it('errar a senha atual repetidamente bloqueia a conta (quem roubou a sessão não adivinha a senha)', async () => {
    await contaVerificada('paula@exemplo.com');
    const cookie = await sessaoAberta('paula@exemplo.com');

    for (let i = 0; i < 5; i++) {
      expect((await post('/auth/alterar-senha', { senhaAtual: `errada-${i}-xxxxxxxx`, novaSenha: NOVA_SENHA }, cookie)).status).toBe(401);
    }
    expect((await post('/auth/alterar-senha', { senhaAtual: SENHA, novaSenha: NOVA_SENHA }, cookie)).status).toBe(429);
  });

  it('lista os dispositivos, marca o atual e permite encerrar um específico ou todos os outros', async () => {
    await contaVerificada('quiteria@exemplo.com');
    const atual = await sessaoAberta('quiteria@exemplo.com');
    const segunda = await sessaoAberta('quiteria@exemplo.com');
    const terceira = await sessaoAberta('quiteria@exemplo.com');

    const lista = await get('/auth/sessoes', atual);
    expect(lista.status).toBe(200);
    expect(lista.body).toHaveLength(3);
    expect(lista.body.filter((s: { atual: boolean }) => s.atual)).toHaveLength(1);
    expect(JSON.stringify(lista.body)).not.toMatch(/token|hash/i);

    const idSegunda = (await system.sessao.findFirstOrThrow({
      where: { cliente: { email: 'quiteria@exemplo.com' }, tokenHash: createHash('sha256').update(tokenDe(segunda)).digest('hex') },
      select: { id: true },
    })).id;

    expect((await del(`/auth/sessoes/${idSegunda}`, atual)).status).toBe(204);
    expect((await get('/auth/eu', segunda)).status).toBe(401);
    expect((await get('/auth/eu', terceira)).status).toBe(200);

    expect((await post('/auth/sessoes/encerrar-outras', {}, atual)).status).toBe(204);
    expect((await get('/auth/eu', terceira)).status).toBe(401);
    expect((await get('/auth/eu', atual)).status).toBe(200);
  });

  it('um cliente não consegue encerrar a sessão de outro', async () => {
    const dona = await contaComSessao('rita@exemplo.com');
    const intruso = await contaComSessao('sergio@exemplo.com');

    const idDaRita = (await system.sessao.findFirstOrThrow({
      where: { cliente: { email: 'rita@exemplo.com' } },
      select: { id: true },
    })).id;

    expect((await del(`/auth/sessoes/${idDaRita}`, intruso)).status).toBe(404);
    expect((await del('/auth/sessoes/nao-e-uuid', intruso)).status).toBe(400);
    expect((await get('/auth/eu', dona)).status).toBe(200);
  });
});

describe('sessão e isolamento', () => {
  it('/auth/eu exige sessão, cada cliente só vê a si mesmo e a resposta não fica em cache', async () => {
    expect((await get('/auth/eu')).status).toBe(401);

    const a = await contaComSessao('tania@exemplo.com');
    const b = await contaComSessao('ubiratan@exemplo.com');
    const euA = await get('/auth/eu', a);
    const euB = await get('/auth/eu', b);

    expect(euA.status).toBe(200);
    expect(euA.body.cliente.email).toBe('tania@exemplo.com');
    expect(euB.body.cliente.email).toBe('ubiratan@exemplo.com');
    expect(euA.body.telegramConectado).toBe(false);
    expect(euA.headers['cache-control']).toBe('no-store');
  });

  it('rejeita cookie inventado', async () => {
    expect((await get('/auth/eu', 'nuvra_sessao=token-inventado')).status).toBe(401);
  });

  it('logout revoga a sessão: o mesmo cookie deixa de funcionar', async () => {
    const cookie = await contaComSessao('vera@exemplo.com');
    expect((await get('/auth/eu', cookie)).status).toBe(200);
    expect((await post('/auth/logout', {}, cookie)).status).toBe(204);
    expect((await get('/auth/eu', cookie)).status).toBe(401);
  });

  it('sessão expirada não funciona', async () => {
    const cookie = await contaComSessao('wagner@exemplo.com');
    await system.sessao.updateMany({
      where: { cliente: { email: 'wagner@exemplo.com' } },
      data: { expiraEm: new Date(Date.now() - 1000) },
    });
    expect((await get('/auth/eu', cookie)).status).toBe(401);
  });

  it('conta suspensa perde o acesso imediatamente, mesmo com sessão aberta', async () => {
    const cookie = await contaComSessao('xuxa@exemplo.com');
    expect((await get('/auth/eu', cookie)).status).toBe(200);

    await system.cliente.update({ where: { email: 'xuxa@exemplo.com' }, data: { status: 'SUSPENSO' } });

    expect((await get('/auth/eu', cookie)).status).toBe(401);
    expect((await entrar('xuxa@exemplo.com')).status).toBe(401);
  });
});

describe('login', () => {
  it('senha errada e e-mail inexistente recebem exatamente a mesma resposta', async () => {
    await contaVerificada('yara@exemplo.com');
    const senhaErrada = await entrar('yara@exemplo.com', 'senha-errada-123456');
    const semConta = await entrar('ninguem@exemplo.com', 'senha-errada-123456');

    expect(senhaErrada.status).toBe(401);
    expect(semConta.status).toBe(401);
    expect(senhaErrada.body).toEqual(semConta.body);
  });

  it('login correto abre uma sessão nova, com e-mail em qualquer caixa', async () => {
    await contaVerificada('zeca@exemplo.com');
    const a = await entrar('ZECA@exemplo.com').expect(200);
    const b = await entrar('zeca@exemplo.com').expect(200);
    expect(tokenDe(cookieDe(a))).not.toBe(tokenDe(cookieDe(b)));
    expect(cookieDe(a)).toMatch(/HttpOnly/i);
    expect(cookieDe(a)).toMatch(/SameSite=Lax/i);
  });

  it('bloqueia a conta após 5 senhas erradas, inclusive para a senha certa (força bruta)', async () => {
    await contaVerificada('abel@exemplo.com');

    for (let i = 0; i < 5; i++) {
      expect((await entrar('abel@exemplo.com', `errada-numero-${i}-xxxx`)).status).toBe(401);
    }

    const bloqueado = await entrar('abel@exemplo.com');
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.headers['set-cookie']).toBeUndefined();

    await system.cliente.update({ where: { email: 'abel@exemplo.com' }, data: { bloqueadoAte: new Date(Date.now() - 1000) } });
    expect((await entrar('abel@exemplo.com')).status).toBe(200);
  });
});

describe('proteções da API', () => {
  it('exige a origem do nosso site em requisições que alteram dados (CSRF)', async () => {
    const corpo = { email: 'qualquer@exemplo.com', senha: SENHA };
    const deOutroSite = await http().post('/auth/login').set('Origin', 'http://site-malicioso.example').send(corpo);
    const semOrigem = await http().post('/auth/login').send(corpo);
    const deleteDeOutroSite = await http().delete('/auth/sessoes/8b1a9953-c461-4b7c-9c3a-5f1d8a1c2b3d').set('Origin', 'http://site-malicioso.example');

    expect(deOutroSite.status).toBe(403);
    expect(semOrigem.status).toBe(403);
    expect(deleteDeOutroSite.status).toBe(403);
  });

  it('recusa corpo grande demais (proteção de memória)', async () => {
    const res = await post('/auth/login', { email: 'a@exemplo.com', senha: 'x'.repeat(40_000) });
    expect(res.status).toBe(413);
  });

  it('envia cabeçalhos de segurança e não revela o framework', async () => {
    const res = await get('/saude');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('a trilha de auditoria registra os eventos sem senha, hash nem token', async () => {
    const eventos = await system.eventoAuditoria.findMany({ select: { tipo: true, detalhes: true } });
    const tipos = new Set(eventos.map((e) => e.tipo));

    for (const esperado of [
      'cadastro', 'cadastro_email_existente', 'email_verificado', 'verificacao_reenviada', 'login_ok', 'login_falha',
      'login_bloqueado', 'conta_bloqueada', 'logout', 'recuperacao_solicitada', 'recuperacao_email_desconhecido',
      'recuperacao_limitada', 'senha_redefinida', 'senha_alterada', 'sessao_encerrada', 'sessoes_encerradas',
    ]) {
      expect(tipos).toContain(esperado);
    }

    const tudo = JSON.stringify(eventos);
    for (const segredo of [SENHA, NOVA_SENHA]) expect(tudo).not.toContain(segredo);
    expect(tudo).not.toMatch(/argon2|token/i);
    for (const email of caixa) expect(tudo).not.toContain(tokenDoEmailSeHouver(email));
  });
});

function tokenDoEmailSeHouver(email: MensagemEmail): string {
  return /#token=([^\s]+)/.exec(email.texto)?.[1] ?? '<sem-token>';
}
