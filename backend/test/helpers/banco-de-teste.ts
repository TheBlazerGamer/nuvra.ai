import { randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { provisionarPapeis } from '../../scripts/lib/provisionar-papeis.js';

const BANCO = 'nuvra_teste';
const senhaAleatoria = () => randomBytes(16).toString('hex');

// Sobe um Postgres real e descartável, aplica TODAS as migrations do projeto e provisiona os papéis,
// exatamente como num ambiente de verdade. Cada arquivo de teste usa uma porta própria.
export async function iniciarBancoDeTeste(porta: number) {
  const senhas = { owner: senhaAleatoria(), app: senhaAleatoria(), system: senhaAleatoria() };
  const url = (usuario: string, senha: string) =>
    `postgresql://${usuario}:${senha}@127.0.0.1:${porta}/${BANCO}`;

  const pasta = mkdtempSync(join(tmpdir(), 'nuvra-pg-'));
  const servidor = new EmbeddedPostgres({
    databaseDir: pasta,
    user: 'nuvra_owner',
    password: senhas.owner,
    port: porta,
    authMethod: 'scram-sha-256',
    persistent: false,
    postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
    onLog: () => {},
    onError: () => {},
  });
  await servidor.initialise();
  await servidor.start();
  await servidor.createDatabase(BANCO);

  const ownerUrl = url('nuvra_owner', senhas.owner);
  const owner = new pg.Client({ connectionString: ownerUrl });
  await owner.connect();
  const raiz = resolve('prisma/migrations');
  for (const nome of readdirSync(raiz).filter((n) => /^\d+_/.test(n)).sort()) {
    await owner.query(readFileSync(join(raiz, nome, 'migration.sql'), 'utf-8'));
  }
  await owner.end();

  await provisionarPapeis({ ownerUrl, banco: BANCO, senhaApp: senhas.app, senhaSystem: senhas.system });

  return {
    urls: {
      owner: ownerUrl,
      app: url('nuvra_app', senhas.app),
      system: url('nuvra_system', senhas.system),
    },
    async parar() {
      await servidor.stop();
      rmSync(pasta, { recursive: true, force: true });
    },
  };
}
