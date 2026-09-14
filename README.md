# Nuvra.AI

SaaS de gestão autônoma de tráfego pago (Meta Ads), operado por IA. Ver [briefing completo](./briefing-nuvra-ai.md) para o escopo do produto.

## Estrutura

- `backend/` — API NestJS (TypeScript, ESM). Autenticação, upload de criativos, integração com Anthropic (Claude) e Meta Marketing API, banco Postgres via Prisma.
- `frontend/` — Aplicativo Next.js (PWA instalável). Cadastro/login, configuração de campanha, acompanhamento.

## Pré-requisitos

- Node.js 20+ (LTS)
- Postgres (local ou gerenciado)
- Conta DigitalOcean Spaces (armazenamento de criativos)
- Chave de API da Anthropic
- Business Manager verificado da Meta + System User token

## Backend

```bash
cd backend
cp .env.example .env   # preencha as credenciais reais
npm install
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

A API sobe em `http://localhost:3001`.

### Variáveis de ambiente (`backend/.env`)

Ver [.env.example](./backend/.env.example) para a lista completa: `DATABASE_URL`, `JWT_SECRET`, credenciais do DigitalOcean Spaces, `ANTHROPIC_API_KEY`, credenciais da Meta Marketing API e `N8N_WEBHOOK_SECRET` (usado pelo n8n para disparar a geração do relatório semanal via `POST /relatorios/gerar-semana`).

### Módulos principais

- `auth` — cadastro/login (JWT)
- `clientes` — perfil, vínculo da conta Meta (onboarding), teto de checagem manual
- `planos` — Básico / Essencial / Pró (limites de criativos e campanhas por mês)
- `criativos` — upload (DigitalOcean Spaces) e análise por IA (Claude)
- `campanhas` — criação e publicação autônoma via Meta Marketing API, com checagem manual para aportes acima do teto do cliente
- `relatorios` — geração do relatório semanal (dados da Meta Marketing API)

## Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

O app sobe em `http://localhost:3000`. É um PWA instalável (manifest + service worker em `public/sw.js`).

## Pontos em aberto antes de produção

- **Checagem manual de aportes acima do teto**: hoje o endpoint `POST /campanhas/:id/aprovar-checagem` é acessível pelo próprio cliente autenticado. Antes de ir para produção, criar um papel de "equipe Nuvra" (admin) separado do cliente, já que essa aprovação deveria ser feita pela Nuvra, não pelo cliente.
- **Onboarding** (vínculo do Business Manager, conta de anúncio e Página do Facebook) também está exposto como endpoint do cliente (`PATCH /clientes/me/conta-meta`); no fluxo real é a Nuvra quem faz isso uma única vez por cliente — vale mover para um painel interno/admin.
- **Preços dos planos**: os valores de mensalidade e taxa de implantação estão zerados no seed (`backend/prisma/seed.ts`) — defina os valores reais antes de abrir para clientes.
- **Testes com credenciais reais da Meta Marketing API**: a integração (`backend/src/meta-ads`) foi implementada conforme a documentação da Graph API v21.0, mas não foi testada contra uma conta de anúncio real — validar especialmente upload de vídeo, criação de creative e ativação de campanha.
- **Relatório semanal automático**: o endpoint existe (`POST /relatorios/gerar-semana`), mas o agendamento (toda segunda-feira) e o layout visual do relatório dentro da plataforma ainda precisam ser implementados — hoje ele só persiste os dados consolidados.
