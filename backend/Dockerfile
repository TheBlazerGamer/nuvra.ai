# Build com todas as dependências (inclui as de desenvolvimento, necessárias para compilar).
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# A imagem "slim" não traz OpenSSL; os binários que o Prisma baixa em `prisma generate` precisam dele.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
# `prisma.config.ts` exige DB_OWNER_URL só para carregar (mesmo sem se conectar); `prisma generate`
# não abre conexão nenhuma, então um valor de mentira aqui é seguro — nunca chega ao container final
# (variável só existe neste estágio de build) nem é usado de verdade pelo `migrator` em produção
# (lá o valor real é passado por `docker run -e DB_OWNER_URL=...`, que substitui este).
ENV DB_OWNER_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate && npm run build

# --- migrator: mesma imagem do build, usada só para preparar o banco (uma vez por deploy) ---
# Aplica as migrations e liga o login dos papéis nuvra_app/nuvra_system (ambos idempotentes: pode rodar
# a cada deploy). Roda separado do serviço principal, nunca dentro do container que atende requisições.
# Precisa de DB_OWNER_URL, DB_APP_URL e DB_SYSTEM_URL (ver deploy/README.md).
FROM builder AS migrator
COPY scripts ./scripts
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx scripts/provisionar-papeis.ts"]

# --- runtime: só o necessário para rodar a API, sem ferramenta de build nem o CLI do Prisma ---
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Usuário sem privilégios (a imagem base roda como root por padrão).
RUN groupadd --system nuvra && useradd --system --gid nuvra nuvra

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
# O pacote @prisma/client instalado acima é só o "envelope"; o código gerado pelo `prisma generate`
# (o que de fato conversa com o banco) mora em node_modules/.prisma e precisa vir do estágio de build.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nuvra
EXPOSE 3001
CMD ["node", "dist/main.js"]
