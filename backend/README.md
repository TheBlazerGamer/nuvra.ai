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

## Autenticação (`src/auth`)

- Sessão em **cookie `httpOnly` + `SameSite=Lax`** (`__Host-` e `Secure` em produção). O navegador guarda um token aleatório; o banco guarda só o SHA-256 dele. Expira em 7 dias sem uso (máx. 30 dias) e é revogada no logout.
- Senha com **Argon2id** (mín. 12, máx. 128 caracteres). E-mail inexistente e senha errada dão a mesma resposta, no mesmo tempo.
- **Força bruta:** 5 senhas erradas em 15 min bloqueiam a conta por 15 min; além disso há limite de requisições por IP (`AUTH_RATE_LIMIT_PER_MIN`).
- **CSRF:** toda requisição que altera dados precisa vir da origem `WEB_ORIGIN` ([origem.guard.ts](src/auth/origem.guard.ts)). Rotas chamadas por servidores (webhook do Telegram) usam `@PermitirSemOrigem()` e devem ter autenticação própria.
- Eventos (`cadastro`, `login_ok`, `login_falha`, `conta_bloqueada`, `logout`...) vão para `eventos_auditoria`, sem senha nem token.
- Rota protegida: `@UseGuards(SessaoGuard)` + `@ClienteAtual()`; dados do cliente sempre via `PrismaTenantService.comTenant`.
- Testes: `npm run test:db` ataca a API real (força bruta, CSRF, sessão expirada/revogada, campos extras, vazamento em auditoria).

## Código anterior

`legacy/` guarda os módulos da versão 1 apenas como referência (não compila nem executa). Ver [legacy/README.md](legacy/README.md).
