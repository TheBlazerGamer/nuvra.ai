-- Troca as tabelas específicas do Telegram por um formato genérico de canal (Telegram hoje,
-- WhatsApp depois, sem tabela nova). Projeto ainda não lançado — não há dado real para migrar,
-- por isso as tabelas antigas são derrubadas e recriadas em vez de alteradas em cima.

DROP TABLE IF EXISTS "vinculos_telegram";
DROP TABLE IF EXISTS "tokens_vinculo_telegram";

CREATE TYPE "Canal" AS ENUM ('TELEGRAM', 'WHATSAPP');

CREATE TABLE "tokens_vinculo_canal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "canal" "Canal" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "usado_em" TIMESTAMPTZ(6),

    CONSTRAINT "tokens_vinculo_canal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tokens_vinculo_canal_token_hash_key" ON "tokens_vinculo_canal"("token_hash");
CREATE INDEX "tokens_vinculo_canal_cliente_id_canal_criado_em_idx" ON "tokens_vinculo_canal"("cliente_id", "canal", "criado_em");

ALTER TABLE "tokens_vinculo_canal" ADD CONSTRAINT "tokens_vinculo_canal_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "vinculos_canal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "canal" "Canal" NOT NULL,
    "id_externo" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "vinculado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vinculos_canal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vinculos_canal_cliente_id_canal_key" ON "vinculos_canal"("cliente_id", "canal");
CREATE UNIQUE INDEX "vinculos_canal_canal_id_externo_key" ON "vinculos_canal"("canal", "id_externo");

ALTER TABLE "vinculos_canal" ADD CONSTRAINT "vinculos_canal_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Permissões e isolamento, no mesmo padrão do restante do banco (ver migration "rls").
GRANT SELECT, INSERT, UPDATE, DELETE ON tokens_vinculo_canal, vinculos_canal TO nuvra_system;

ALTER TABLE tokens_vinculo_canal ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens_vinculo_canal FORCE ROW LEVEL SECURITY;
CREATE POLICY system_total ON tokens_vinculo_canal FOR ALL TO nuvra_system USING (true) WITH CHECK (true);

ALTER TABLE vinculos_canal ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos_canal FORCE ROW LEVEL SECURITY;
CREATE POLICY system_total ON vinculos_canal FOR ALL TO nuvra_system USING (true) WITH CHECK (true);

-- nuvra_app: o cliente pode gerar o próprio link de conexão...
GRANT SELECT (id, cliente_id, canal, criado_em, expira_em, usado_em) ON tokens_vinculo_canal TO nuvra_app;
GRANT INSERT (cliente_id, canal, token_hash, expira_em, criado_em) ON tokens_vinculo_canal TO nuvra_app;
CREATE POLICY app_le_proprio ON tokens_vinculo_canal FOR SELECT TO nuvra_app
  USING (cliente_id = (SELECT app_cliente_id()));
CREATE POLICY app_cria_proprio ON tokens_vinculo_canal FOR INSERT TO nuvra_app
  WITH CHECK (cliente_id = (SELECT app_cliente_id()));

-- ...e ver/desconectar o próprio vínculo, nunca de outro cliente nem o id_externo alheio.
GRANT SELECT (id, cliente_id, canal, id_externo, chat_id, vinculado_em) ON vinculos_canal TO nuvra_app;
GRANT DELETE ON vinculos_canal TO nuvra_app;
CREATE POLICY app_le_proprio ON vinculos_canal FOR SELECT TO nuvra_app
  USING (cliente_id = (SELECT app_cliente_id()));
CREATE POLICY app_apaga_proprio ON vinculos_canal FOR DELETE TO nuvra_app
  USING (cliente_id = (SELECT app_cliente_id()));
