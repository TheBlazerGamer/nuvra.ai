# Backend Nuvra.AI

NestJS + Prisma + PostgreSQL. Um único banco para todos os clientes, com isolamento por cliente feito **pelo próprio banco** (Row Level Security).

## Rodar em desenvolvimento

```bash
cp .env.example .env        # troque cada TROQUE_ESTA_SENHA por um valor longo e aleatório
npm install
npm run db:dev              # Postgres local (deixe este terminal aberto)
npm run db:migrate          # em outro terminal: cria as tabelas, papéis e regras de isolamento
npm run db:provision        # liga o login dos papéis nuvra_app / nuvra_system
npm run start:dev           # http://localhost:3001/saude
```

Testes: `npm test` (unitários) e `npm run test:db` (sobe um Postgres descartável e tenta violar o isolamento entre clientes).

## Como funciona o isolamento

- Toda tabela de dados de cliente tem `cliente_id` e RLS ligado e forçado ([migration `rls`](prisma/migrations/20260924000100_rls/migration.sql)).
- A API conecta com **dois papéis** de banco:
  - `nuvra_app` (`PrismaTenantService`): tráfego do cliente. Só existe `comTenant(clienteId, fn)`; o banco só devolve as linhas daquele cliente, mesmo que o código esqueça um filtro. Não lê `senha_hash`/`token_hash`, não apaga, não vê a auditoria.
  - `nuvra_system` (`PrismaSystemService`): login/sessão, resolução do cliente pelo Telegram e rotinas em segundo plano. Acesso total, uso restrito, escrita relevante gera `EventoAuditoria`.
- O `nuvra_owner` só roda migrations. O servidor **se recusa a subir** se `DB_APP_URL`/`DB_SYSTEM_URL` usarem o papel errado ([env.ts](src/config/env.ts)).
- Tabela nova de cliente = coluna `cliente_id` + `ENABLE/FORCE ROW LEVEL SECURITY` + políticas + `GRANT` por coluna, tudo explícito. Nada é liberado por padrão.
- Consultas do papel `nuvra_app` devem usar `select` explícito (colunas sem permissão falham de propósito).

## Código anterior

`legacy/` guarda os módulos da versão 1 apenas como referência (não compila nem executa). Ver [legacy/README.md](legacy/README.md).
