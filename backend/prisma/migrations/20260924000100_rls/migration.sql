-- Isolamento por cliente dentro de um único banco (Row Level Security).
--
-- Papéis:
--   nuvra_app    -> tráfego do cliente. Só enxerga/altera linhas do cliente definido em app.cliente_id
--                   e só nas colunas liberadas abaixo (ex.: nunca lê senha_hash nem token_hash).
--   nuvra_system -> autenticação, webhook do Telegram e rotinas em segundo plano. Acesso total.
-- O dono das tabelas (nuvra_owner) também obedece ao RLS (FORCE); dados de teste/seed devem ser
-- criados pelo papel nuvra_system.
--
-- REGRA PARA MIGRATIONS FUTURAS: toda tabela nova com dados de cliente precisa de coluna cliente_id,
-- ENABLE + FORCE ROW LEVEL SECURITY, política "system_total", política(s) de nuvra_app e GRANTs explícitos.
-- Nada é liberado por padrão.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nuvra_app') THEN
    CREATE ROLE nuvra_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'nuvra_system') THEN
    CREATE ROLE nuvra_system NOLOGIN;
  END IF;
END
$$;

ALTER TABLE clientes ADD CONSTRAINT clientes_email_minusculo CHECK (email = lower(email));
ALTER TABLE clientes ADD CONSTRAINT clientes_nome_tamanho CHECK (char_length(nome) BETWEEN 1 AND 120);

-- Cliente da requisição atual. Sem contexto (ou vazio) => NULL => nenhuma linha visível.
CREATE FUNCTION app_cliente_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('app.cliente_id', true), '')::uuid $$;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO nuvra_app, nuvra_system;
GRANT EXECUTE ON FUNCTION app_cliente_id() TO nuvra_app, nuvra_system;

-- nuvra_system: acesso total às tabelas do produto.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON clientes, sessoes, tokens_vinculo_telegram, vinculos_telegram, eventos_auditoria
  TO nuvra_system;

-- nuvra_app: o mínimo necessário, por coluna.
GRANT SELECT (id, nome, email, status, criado_em) ON clientes TO nuvra_app;
GRANT UPDATE (nome) ON clientes TO nuvra_app;

GRANT SELECT (id, cliente_id, criado_em, expira_em, ultimo_uso_em, revogada_em, user_agent) ON sessoes TO nuvra_app;
GRANT UPDATE (revogada_em) ON sessoes TO nuvra_app;

GRANT SELECT (id, cliente_id, criado_em, expira_em, usado_em) ON tokens_vinculo_telegram TO nuvra_app;
GRANT INSERT (cliente_id, token_hash, expira_em, criado_em) ON tokens_vinculo_telegram TO nuvra_app;

GRANT SELECT ON vinculos_telegram TO nuvra_app;

-- RLS ligado (e forçado) em todas as tabelas.
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes FORCE ROW LEVEL SECURITY;
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessoes FORCE ROW LEVEL SECURITY;
ALTER TABLE tokens_vinculo_telegram ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens_vinculo_telegram FORCE ROW LEVEL SECURITY;
ALTER TABLE vinculos_telegram ENABLE ROW LEVEL SECURITY;
ALTER TABLE vinculos_telegram FORCE ROW LEVEL SECURITY;
ALTER TABLE eventos_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos_auditoria FORCE ROW LEVEL SECURITY;

CREATE POLICY system_total ON clientes FOR ALL TO nuvra_system USING (true) WITH CHECK (true);
CREATE POLICY system_total ON sessoes FOR ALL TO nuvra_system USING (true) WITH CHECK (true);
CREATE POLICY system_total ON tokens_vinculo_telegram FOR ALL TO nuvra_system USING (true) WITH CHECK (true);
CREATE POLICY system_total ON vinculos_telegram FOR ALL TO nuvra_system USING (true) WITH CHECK (true);
CREATE POLICY system_total ON eventos_auditoria FOR ALL TO nuvra_system USING (true) WITH CHECK (true);

CREATE POLICY app_le_proprio ON clientes FOR SELECT TO nuvra_app
  USING (id = (SELECT app_cliente_id()));
CREATE POLICY app_edita_proprio ON clientes FOR UPDATE TO nuvra_app
  USING (id = (SELECT app_cliente_id())) WITH CHECK (id = (SELECT app_cliente_id()));

CREATE POLICY app_le_proprio ON sessoes FOR SELECT TO nuvra_app
  USING (cliente_id = (SELECT app_cliente_id()));
CREATE POLICY app_edita_proprio ON sessoes FOR UPDATE TO nuvra_app
  USING (cliente_id = (SELECT app_cliente_id())) WITH CHECK (cliente_id = (SELECT app_cliente_id()));

CREATE POLICY app_le_proprio ON tokens_vinculo_telegram FOR SELECT TO nuvra_app
  USING (cliente_id = (SELECT app_cliente_id()));
CREATE POLICY app_cria_proprio ON tokens_vinculo_telegram FOR INSERT TO nuvra_app
  WITH CHECK (cliente_id = (SELECT app_cliente_id()));

CREATE POLICY app_le_proprio ON vinculos_telegram FOR SELECT TO nuvra_app
  USING (cliente_id = (SELECT app_cliente_id()));

-- eventos_auditoria: nenhum GRANT nem política para nuvra_app (somente nuvra_system).
