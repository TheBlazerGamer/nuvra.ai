-- ID do usuário na Meta, para identificar quem removeu o app (desautorização) ou pediu exclusão de dados.
-- Só o papel de sistema usa (os webhooks da Meta não têm sessão de cliente); nuvra_app não ganha acesso a esta coluna.
ALTER TABLE "conexoes_meta" ADD COLUMN "meta_user_id" TEXT;
CREATE INDEX "conexoes_meta_meta_user_id_idx" ON "conexoes_meta"("meta_user_id");
