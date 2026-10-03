import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaSystemService } from '../src/database/prisma-system.service.js';
import { PrismaTenantService } from '../src/database/prisma-tenant.service.js';
import { iniciarBancoDeTeste } from './helpers/banco-de-teste.js';

// Usa um Postgres real e descartável e tenta VIOLAR o isolamento entre clientes
// com exatamente os papéis que a API usa em produção.

const PORTA = 54390;

let banco: Awaited<ReturnType<typeof iniciarBancoDeTeste>>;
let system: PrismaSystemService;
let tenant: PrismaTenantService;
let semContexto: PrismaClient;

let clienteA: { id: string };
let clienteB: { id: string };
let sessaoB: { id: string };

const daqui1h = () => new Date(Date.now() + 3_600_000);

beforeAll(async () => {
  banco = await iniciarBancoDeTeste(PORTA);

  system = new PrismaSystemService(banco.urls.system);
  await system.$connect();
  tenant = new PrismaTenantService(banco.urls.app);
  semContexto = new PrismaClient({ adapter: new PrismaPg({ connectionString: banco.urls.app }) });

  clienteA = await system.cliente.create({
    data: { nome: 'Cliente A', email: 'a@exemplo.com', senhaHash: 'hash-a' },
    select: { id: true },
  });
  clienteB = await system.cliente.create({
    data: { nome: 'Cliente B', email: 'b@exemplo.com', senhaHash: 'hash-b' },
    select: { id: true },
  });

  await system.sessao.create({ data: { clienteId: clienteA.id, tokenHash: 'a1', expiraEm: daqui1h() } });
  await system.sessao.create({ data: { clienteId: clienteA.id, tokenHash: 'a2', expiraEm: daqui1h() } });
  sessaoB = await system.sessao.create({
    data: { clienteId: clienteB.id, tokenHash: 'b1', expiraEm: daqui1h() },
    select: { id: true },
  });
  await system.vinculoCanal.create({
    data: { clienteId: clienteA.id, canal: 'TELEGRAM', idExterno: '111', chatId: '111' },
  });
  await system.vinculoCanal.create({
    data: { clienteId: clienteB.id, canal: 'TELEGRAM', idExterno: '222', chatId: '222' },
  });
  await system.conexaoMeta.create({
    data: {
      clienteId: clienteA.id,
      tipoToken: 'USUARIO',
      tokenCriptografado: 'cifrado-fake',
      contaAnuncioId: 'act_111',
      contaAnuncioNome: 'Conta A',
    },
  });
  await system.estadoOAuthMeta.create({
    data: { clienteId: clienteA.id, estadoHash: 'hash-fake', expiraEm: daqui1h() },
  });
}, 180_000);

afterAll(async () => {
  await semContexto?.$disconnect();
  await tenant?.onModuleDestroy();
  await system?.$disconnect();
  await banco?.parar();
}, 60_000);

describe('isolamento entre clientes (Row Level Security)', () => {
  it('sem contexto de cliente, o papel da API não enxerga nenhuma linha (mesmo "esquecendo" o filtro)', async () => {
    expect(await semContexto.sessao.findMany({ select: { id: true } })).toHaveLength(0);
    expect(await semContexto.cliente.findMany({ select: { id: true } })).toHaveLength(0);
    expect(await semContexto.vinculoCanal.findMany()).toHaveLength(0);
  });

  it('com o contexto do cliente A, só aparecem dados de A', async () => {
    const { sessoes, clientes, vinculos } = await tenant.comTenant(clienteA.id, async (tx) => ({
      sessoes: await tx.sessao.findMany({ select: { clienteId: true } }),
      clientes: await tx.cliente.findMany({ select: { id: true } }),
      vinculos: await tx.vinculoCanal.findMany(),
    }));

    expect(sessoes).toHaveLength(2);
    expect(sessoes.every((s) => s.clienteId === clienteA.id)).toBe(true);
    expect(clientes).toEqual([{ id: clienteA.id }]);
    expect(vinculos).toHaveLength(1);
    expect(vinculos[0].idExterno).toBe('111');
  });

  it('A não consegue apagar o vínculo de B, mas consegue apagar o próprio', async () => {
    const apagouDeB = await tenant.comTenant(clienteA.id, (tx) =>
      tx.vinculoCanal.deleteMany({ where: { clienteId: clienteB.id } }),
    );
    expect(apagouDeB.count).toBe(0);
    expect(await system.vinculoCanal.count({ where: { clienteId: clienteB.id } })).toBe(1);

    const apagouProprio = await tenant.comTenant(clienteA.id, (tx) =>
      tx.vinculoCanal.deleteMany({ where: { clienteId: clienteA.id } }),
    );
    expect(apagouProprio.count).toBe(1);

    // devolve o vínculo de A para não afetar os testes seguintes deste arquivo
    await system.vinculoCanal.create({
      data: { clienteId: clienteA.id, canal: 'TELEGRAM', idExterno: '111', chatId: '111' },
    });
  });

  it('A não consegue ler a linha de B nem por id direto', async () => {
    const linha = await tenant.comTenant(clienteA.id, (tx) =>
      tx.sessao.findUnique({ where: { id: sessaoB.id }, select: { id: true } }),
    );
    expect(linha).toBeNull();
  });

  it('A não consegue alterar dados de B (0 linhas afetadas)', async () => {
    const resultado = await tenant.comTenant(clienteA.id, (tx) =>
      tx.sessao.updateMany({ where: { id: sessaoB.id }, data: { revogadaEm: new Date() } }),
    );
    expect(resultado.count).toBe(0);

    const nomeB = await system.cliente.findUniqueOrThrow({ where: { id: clienteB.id } });
    expect(nomeB.nome).toBe('Cliente B');
  });

  it('A não consegue gravar uma linha em nome de B', async () => {
    await expect(
      tenant.comTenant(clienteA.id, (tx) =>
        tx.tokenVinculoCanal.create({
          data: { clienteId: clienteB.id, canal: 'TELEGRAM', tokenHash: 'forjado', expiraEm: daqui1h() },
          select: { id: true },
        }),
      ),
    ).rejects.toThrow(/row-level security/i);

    expect(await system.tokenVinculoCanal.count({ where: { tokenHash: 'forjado' } })).toBe(0);
  });

  it('A consegue criar o próprio token de vínculo', async () => {
    const token = await tenant.comTenant(clienteA.id, (tx) =>
      tx.tokenVinculoCanal.create({
        data: { clienteId: clienteA.id, canal: 'TELEGRAM', tokenHash: 'legitimo', expiraEm: daqui1h() },
        select: { id: true },
      }),
    );
    expect(token.id).toBeTruthy();
  });

  it('o papel da API nunca lê senha_hash nem token_hash (permissão por coluna)', async () => {
    await expect(
      tenant.comTenant(clienteA.id, (tx) => tx.cliente.findUnique({ where: { id: clienteA.id } })),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      tenant.comTenant(clienteA.id, (tx) => tx.sessao.findMany()),
    ).rejects.toThrow(/permission denied/i);
  });

  it('o papel da API não enxerga nem cria tokens de e-mail (verificação e recuperação de senha)', async () => {
    await system.tokenEmail.create({
      data: { clienteId: clienteA.id, tipo: 'RECUPERACAO_SENHA', tokenHash: 'hash-recuperacao-a', expiraEm: daqui1h() },
    });

    await expect(
      tenant.comTenant(clienteA.id, (tx) => tx.tokenEmail.findMany({ select: { id: true } })),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      tenant.comTenant(clienteA.id, (tx) =>
        tx.tokenEmail.create({
          data: { clienteId: clienteA.id, tipo: 'RECUPERACAO_SENHA', tokenHash: 'forjado-2', expiraEm: daqui1h() },
          select: { id: true },
        }),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('o cliente vê o próprio status de verificação de e-mail, mas não o bloqueio de login', async () => {
    const proprio = await tenant.comTenant(clienteA.id, (tx) =>
      tx.cliente.findUniqueOrThrow({ where: { id: clienteA.id }, select: { emailVerificadoEm: true } }),
    );
    expect(proprio.emailVerificadoEm).toBeNull();

    await expect(
      tenant.comTenant(clienteA.id, (tx) =>
        tx.cliente.findUniqueOrThrow({ where: { id: clienteA.id }, select: { bloqueadoAte: true } }),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('o papel da API não apaga registros nem lê a trilha de auditoria', async () => {
    await expect(
      tenant.comTenant(clienteA.id, (tx) => tx.sessao.deleteMany({})),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      tenant.comTenant(clienteA.id, (tx) => tx.eventoAuditoria.findMany({ select: { id: true } })),
    ).rejects.toThrow(/permission denied/i);
  });

  it('o contexto não vaza entre requisições que reaproveitam a mesma conexão do pool', async () => {
    const resultados = await Promise.all(
      Array.from({ length: 60 }, (_, i) => {
        const dono = i % 2 === 0 ? clienteA : clienteB;
        return tenant
          .comTenant(dono.id, (tx) => tx.sessao.findMany({ select: { clienteId: true } }))
          .then((linhas) => ({ dono: dono.id, donos: new Set(linhas.map((l) => l.clienteId)) }));
      }),
    );

    for (const { dono, donos } of resultados) {
      expect([...donos]).toEqual([dono]);
    }
    expect(await semContexto.sessao.findMany({ select: { id: true } })).toHaveLength(0);
  });

  it('recusa um clienteId que não seja UUID (barra injeção no contexto)', async () => {
    await expect(
      tenant.comTenant("x'; DROP TABLE clientes; --", async () => 'nunca'),
    ).rejects.toThrow(/inválido/);
  });

  it('o papel de sistema enxerga todos os clientes (autenticação e rotinas)', async () => {
    expect(await system.sessao.count()).toBe(3);
    expect(await system.cliente.count()).toBe(2);
  });

  it('A vê o status da própria conexão com a Meta, nunca o token, e não vê nem apaga a de B', async () => {
    const proprio = await tenant.comTenant(clienteA.id, (tx) =>
      tx.conexaoMeta.findUnique({
        where: { clienteId: clienteA.id },
        select: { contaAnuncioId: true, contaAnuncioNome: true },
      }),
    );
    expect(proprio?.contaAnuncioNome).toBe('Conta A');

    await expect(
      tenant.comTenant(clienteA.id, (tx) => tx.conexaoMeta.findUnique({ where: { clienteId: clienteA.id } })),
    ).rejects.toThrow(/permission denied/i);

    const deB = await tenant.comTenant(clienteB.id, (tx) =>
      tx.conexaoMeta.findUnique({ where: { clienteId: clienteA.id }, select: { contaAnuncioId: true } }),
    );
    expect(deB).toBeNull();

    const apagouDeA = await tenant.comTenant(clienteB.id, (tx) =>
      tx.conexaoMeta.deleteMany({ where: { clienteId: clienteA.id } }),
    );
    expect(apagouDeA.count).toBe(0);
    expect(await system.conexaoMeta.count({ where: { clienteId: clienteA.id } })).toBe(1);
  });

  it('o papel da API não enxerga nem cria o "state" do login com a Meta (só o papel de sistema mexe nisso)', async () => {
    await expect(
      tenant.comTenant(clienteA.id, (tx) => tx.estadoOAuthMeta.findMany({ select: { id: true } })),
    ).rejects.toThrow(/permission denied/i);
    await expect(
      tenant.comTenant(clienteA.id, (tx) =>
        tx.estadoOAuthMeta.create({
          data: { clienteId: clienteA.id, estadoHash: 'forjado', expiraEm: daqui1h() },
          select: { id: true },
        }),
      ),
    ).rejects.toThrow(/permission denied/i);
  });

  it('e-mail é sempre gravado em minúsculas (restrição no banco)', async () => {
    await expect(
      system.cliente.create({ data: { nome: 'X', email: 'MAIUSCULO@exemplo.com', senhaHash: 'h' } }),
    ).rejects.toThrow(/clientes_email_minusculo|check constraint/i);
  });
});
