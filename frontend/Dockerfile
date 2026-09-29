# NEXT_PUBLIC_API_URL entra no JavaScript durante o build (é público, vai para o navegador de qualquer
# forma) — por isso é um argumento de build, não uma variável de ambiente lida em produção.
ARG NEXT_PUBLIC_API_URL=https://api.gruponuvra.com.br

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime: usa a saída "standalone" do Next.js (só os arquivos necessários) ---
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system nuvra && useradd --system --gid nuvra nuvra

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nuvra
EXPOSE 3000
CMD ["node", "server.js"]
