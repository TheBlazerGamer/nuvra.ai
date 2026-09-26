-- Verificação de e-mail e recuperação de senha.
-- Tokens de uso único; o e-mail leva o token, o banco guarda só o hash (SHA-256).

CREATE TYPE "TipoTokenEmail" AS ENUM ('VERIFICACAO_EMAIL', 'RECUPERACAO_SENHA');

ALTER TABLE "clientes" ADD COLUMN "email_verificado_em" TIMESTAMPTZ(6);

CREATE TABLE "tokens_email" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "tipo" "TipoTokenEmail" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "usado_em" TIMESTAMPTZ(6),

    CONSTRAINT "tokens_email_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tokens_email_token_hash_key" ON "tokens_email"("token_hash");
CREATE INDEX "tokens_email_cliente_id_tipo_criado_em_idx" ON "tokens_email"("cliente_id", "tipo", "criado_em");

ALTER TABLE "tokens_email" ADD CONSTRAINT "tokens_email_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Permissões e isolamento: tokens de e-mail são manipulados só pelo papel nuvra_system.
-- O papel nuvra_app não tem GRANT nenhum nesta tabela (nem para as próprias linhas).
GRANT SELECT, INSERT, UPDATE, DELETE ON tokens_email TO nuvra_system;
ALTER TABLE tokens_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens_email FORCE ROW LEVEL SECURITY;
CREATE POLICY system_total ON tokens_email FOR ALL TO nuvra_system USING (true) WITH CHECK (true);

-- O cliente pode saber se o próprio e-mail já foi verificado (a coluna nova não vinha liberada).
GRANT SELECT (email_verificado_em) ON clientes TO nuvra_app;
