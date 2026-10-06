-- Assistente de preparação da conta: respostas e "já fiz" da própria pessoa.

CREATE TYPE "RespostaContaAnuncio" AS ENUM ('SIM', 'NAO', 'NAO_SEI');

CREATE TABLE "preparacao_conta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "tem_conta_anuncio" "RespostaContaAnuncio",
    "confirmacoes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "preparacao_conta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "preparacao_conta_cliente_id_key" ON "preparacao_conta"("cliente_id");

ALTER TABLE "preparacao_conta" ADD CONSTRAINT "preparacao_conta_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON preparacao_conta TO nuvra_system;

ALTER TABLE preparacao_conta ENABLE ROW LEVEL SECURITY;
ALTER TABLE preparacao_conta FORCE ROW LEVEL SECURITY;
CREATE POLICY system_total ON preparacao_conta FOR ALL TO nuvra_system USING (true) WITH CHECK (true);

-- nuvra_app: o cliente lê e grava SÓ a própria linha (é o que ele mesmo informa; nada sensível).
GRANT SELECT (id, cliente_id, tem_conta_anuncio, confirmacoes, atualizado_em) ON preparacao_conta TO nuvra_app;
GRANT INSERT (cliente_id, tem_conta_anuncio, confirmacoes, atualizado_em) ON preparacao_conta TO nuvra_app;
GRANT UPDATE (tem_conta_anuncio, confirmacoes, atualizado_em) ON preparacao_conta TO nuvra_app;
CREATE POLICY app_le_proprio ON preparacao_conta FOR SELECT TO nuvra_app
  USING (cliente_id = (SELECT app_cliente_id()));
CREATE POLICY app_cria_proprio ON preparacao_conta FOR INSERT TO nuvra_app
  WITH CHECK (cliente_id = (SELECT app_cliente_id()));
CREATE POLICY app_edita_proprio ON preparacao_conta FOR UPDATE TO nuvra_app
  USING (cliente_id = (SELECT app_cliente_id()))
  WITH CHECK (cliente_id = (SELECT app_cliente_id()));
