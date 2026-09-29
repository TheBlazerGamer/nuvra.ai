# Build com todas as dependências (inclui as de desenvolvimento, necessárias para compilar).
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# --- migrator: mesma imagem do build, usada só para rodar as migrations (uma vez por deploy) ---
# Roda separado do serviço principal, nunca dentro do container que atende requisições:
# `docker run --rm --network network_swarm_internal --env-file .env <imagem>:migrator`
FROM builder AS migrator
CMD ["npx", "prisma", "migrate", "deploy"]

# --- runtime: só o necessário para rodar a API, sem ferramenta de build nem o CLI do Prisma ---
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

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
