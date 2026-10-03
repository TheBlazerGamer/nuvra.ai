-- Login com o Facebook: conexão do cliente com a própria conta de anúncio/Página na Meta,
-- e o "state" de uso único usado para proteger o fluxo OAuth contra CSRF.

CREATE TYPE "TipoTokenMeta" AS ENUM ('USUARIO', 'SISTEMA');

CREATE TABLE "conexoes_meta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "tipo_token" "TipoTokenMeta" NOT NULL,
    "token_criptografado" TEXT NOT NULL,
    "conta_anuncio_id" TEXT,
    "conta_anuncio_nome" TEXT,
    "pagina_id" TEXT,
    "pagina_nome" TEXT,
    "expira_em" TIMESTAMPTZ(6),
    "conectado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conexoes_meta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conexoes_meta_cliente_id_key" ON "conexoes_meta"("cliente_id");

ALTER TABLE "conexoes_meta" ADD CONSTRAINT "conexoes_meta_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "estados_oauth_meta" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "estado_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "usado_em" TIMESTAMPTZ(6),

    CONSTRAINT "estados_oauth_meta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "estados_oauth_meta_estado_hash_key" ON "estados_oauth_meta"("estado_hash");
CREATE INDEX "estados_oauth_meta_cliente_id_criado_em_idx" ON "estados_oauth_meta"("cliente_id", "criado_em");

ALTER TABLE "estados_oauth_meta" ADD CONSTRAINT "estados_oauth_meta_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Permissões e isolamento, no mesmo padrão do restante do banco (ver migration "rls").
GRANT SELECT, INSERT, UPDATE, DELETE ON conexoes_meta, estados_oauth_meta TO nuvra_system;

ALTER TABLE conexoes_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE conexoes_meta FORCE ROW LEVEL SECURITY;
CREATE POLICY system_total ON conexoes_meta FOR ALL TO nuvra_system USING (true) WITH CHECK (true);

ALTER TABLE estados_oauth_meta ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_oauth_meta FORCE ROW LEVEL SECURITY;
CREATE POLICY system_total ON estados_oauth_meta FOR ALL TO nuvra_system USING (true) WITH CHECK (true);

-- nuvra_app: só enxerga o status da própria conexão (nunca o token) e pode desconectar.
-- A troca do código por token e a escrita da conexão são sempre feitas pelo papel de sistema
-- (o navegador nunca fala diretamente com a Meta usando credenciais nossas).
GRANT SELECT (id, cliente_id, tipo_token, conta_anuncio_id, conta_anuncio_nome, pagina_id, pagina_nome, expira_em, conectado_em)
  ON conexoes_meta TO nuvra_app;
GRANT DELETE ON conexoes_meta TO nuvra_app;
CREATE POLICY app_le_proprio ON conexoes_meta FOR SELECT TO nuvra_app
  USING (cliente_id = (SELECT app_cliente_id()));
CREATE POLICY app_apaga_proprio ON conexoes_meta FOR DELETE TO nuvra_app
  USING (cliente_id = (SELECT app_cliente_id()));

-- estados_oauth_meta: nenhum grant para nuvra_app (o "state" só é criado, validado e consumido
-- pelo papel de sistema, mesmo quando a requisição que o inicia vem de um cliente autenticado).
