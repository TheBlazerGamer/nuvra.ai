import 'dotenv/config';
import { lerUrlDb } from './lib/db-urls.js';
import { provisionarPapeis } from './lib/provisionar-papeis.js';

const ownerUrl = process.env.DB_OWNER_URL;
const appUrl = process.env.DB_APP_URL;
const systemUrl = process.env.DB_SYSTEM_URL;

if (!ownerUrl || !appUrl || !systemUrl) {
  throw new Error('Defina DB_OWNER_URL, DB_APP_URL e DB_SYSTEM_URL no .env.');
}

const app = lerUrlDb(appUrl);
const system = lerUrlDb(systemUrl);

if (app.usuario !== 'nuvra_app' || system.usuario !== 'nuvra_system') {
  throw new Error('DB_APP_URL deve usar o usuário nuvra_app e DB_SYSTEM_URL o usuário nuvra_system.');
}

await provisionarPapeis({
  ownerUrl,
  banco: lerUrlDb(ownerUrl).banco,
  senhaApp: app.senha,
  senhaSystem: system.senha,
});

console.log('Papéis nuvra_app e nuvra_system provisionados.');
