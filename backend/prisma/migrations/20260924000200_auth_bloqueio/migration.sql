-- Bloqueio temporário de conta após várias senhas erradas (a contagem vem da trilha de auditoria).
-- A coluna nova NÃO é liberada ao papel nuvra_app (só nuvra_system, que tem acesso à tabela toda).
ALTER TABLE "clientes" ADD COLUMN "bloqueado_ate" TIMESTAMPTZ(6);
