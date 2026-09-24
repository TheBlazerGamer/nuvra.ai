-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StatusCliente" AS ENUM ('ATIVO', 'SUSPENSO');

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "status" "StatusCliente" NOT NULL DEFAULT 'ATIVO',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "ultimo_uso_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogada_em" TIMESTAMPTZ(6),
    "user_agent" TEXT,

    CONSTRAINT "sessoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens_vinculo_telegram" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(6) NOT NULL,
    "usado_em" TIMESTAMPTZ(6),

    CONSTRAINT "tokens_vinculo_telegram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculos_telegram" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID NOT NULL,
    "telegram_user_id" BIGINT NOT NULL,
    "chat_id" BIGINT NOT NULL,
    "vinculado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vinculos_telegram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_auditoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cliente_id" UUID,
    "tipo" TEXT NOT NULL,
    "detalhes" JSONB NOT NULL DEFAULT '{}',
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_token_hash_key" ON "sessoes"("token_hash");

-- CreateIndex
CREATE INDEX "sessoes_cliente_id_idx" ON "sessoes"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_vinculo_telegram_token_hash_key" ON "tokens_vinculo_telegram"("token_hash");

-- CreateIndex
CREATE INDEX "tokens_vinculo_telegram_cliente_id_idx" ON "tokens_vinculo_telegram"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "vinculos_telegram_cliente_id_key" ON "vinculos_telegram"("cliente_id");

-- CreateIndex
CREATE UNIQUE INDEX "vinculos_telegram_telegram_user_id_key" ON "vinculos_telegram"("telegram_user_id");

-- CreateIndex
CREATE INDEX "eventos_auditoria_cliente_id_criado_em_idx" ON "eventos_auditoria"("cliente_id", "criado_em");

-- CreateIndex
CREATE INDEX "eventos_auditoria_tipo_criado_em_idx" ON "eventos_auditoria"("tipo", "criado_em");

-- AddForeignKey
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens_vinculo_telegram" ADD CONSTRAINT "tokens_vinculo_telegram_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculos_telegram" ADD CONSTRAINT "vinculos_telegram_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_auditoria" ADD CONSTRAINT "eventos_auditoria_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

