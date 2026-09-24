import pg from 'pg';

// Os papéis nuvra_app e nuvra_system nascem SEM login/senha na migration "rls" (nada secreto no git).
// Este passo, executado uma vez por ambiente com o papel dono, liga o login com as senhas das URLs do .env
// e fecha o banco para qualquer outro papel.
export async function provisionarPapeis(params: {
  ownerUrl: string;
  banco: string;
  senhaApp: string;
  senhaSystem: string;
}) {
  const client = new pg.Client({ connectionString: params.ownerUrl });
  await client.connect();

  try {
    const existentes = await client.query<{ rolname: string }>(
      `SELECT rolname FROM pg_roles WHERE rolname IN ('nuvra_app', 'nuvra_system')`,
    );
    if (existentes.rowCount !== 2) {
      throw new Error('Papéis nuvra_app/nuvra_system não existem. Rode as migrations antes (db:migrate).');
    }

    await client.query(`ALTER ROLE nuvra_app LOGIN PASSWORD ${client.escapeLiteral(params.senhaApp)}`);
    await client.query(`ALTER ROLE nuvra_system LOGIN PASSWORD ${client.escapeLiteral(params.senhaSystem)}`);

    const banco = client.escapeIdentifier(params.banco);
    await client.query(`REVOKE ALL ON DATABASE ${banco} FROM PUBLIC`);
    await client.query(`GRANT CONNECT ON DATABASE ${banco} TO nuvra_app, nuvra_system`);
  } finally {
    await client.end();
  }
}
