import 'dotenv/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import { lerUrlDb } from './lib/db-urls.js';

// Postgres real, só para desenvolvimento local (dados em backend/.pgdata, fora do git).
// Em produção o banco é o servidor dedicado da Nuvra — este script nunca roda lá.
const ownerUrl = process.env.DB_OWNER_URL;
if (!ownerUrl) throw new Error('Defina DB_OWNER_URL no .env.');

const owner = lerUrlDb(ownerUrl);
const pasta = resolve('.pgdata');

const pg = new EmbeddedPostgres({
  databaseDir: pasta,
  user: owner.usuario,
  password: owner.senha,
  port: owner.porta,
  authMethod: 'scram-sha-256',
  persistent: true,
  postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
  onLog: () => {},
  onError: (erro) => console.error(erro),
});

if (!existsSync(resolve(pasta, 'PG_VERSION'))) {
  await pg.initialise();
}
await pg.start();

try {
  await pg.createDatabase(owner.banco);
} catch (erro) {
  if (!String(erro).includes('already exists')) throw erro;
}

console.log(`Postgres de desenvolvimento no ar em 127.0.0.1:${owner.porta} (Ctrl+C para parar).`);

const parar = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', parar);
process.on('SIGTERM', parar);

setInterval(() => {}, 1 << 30);
