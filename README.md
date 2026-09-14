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

Ver [.env.example](./backend/.env.example) para a lista completa: `DATABASE_URL`, `JWT_SECRET` (clientes), `STAFF_JWT_SECRET` (equipe Nuvra — segredo separado de propósito), credenciais do DigitalOcean Spaces, `ANTHROPIC_API_KEY`, credenciais da Meta Marketing API, `N8N_WEBHOOK_SECRET` (usado pelo n8n para disparar a geração do relatório semanal via `POST /relatorios/gerar-semana`) e `ADMIN_EMAIL`/`ADMIN_SENHA`/`ADMIN_NOME` (opcional — se preenchidos, `npm run prisma:seed` cria o primeiro usuário admin).

### Módulos principais

- `auth` — cadastro/login do cliente (JWT)
- `funcionarios` — login da equipe Nuvra (JWT com segredo próprio, `STAFF_JWT_SECRET`); não há cadastro público, o primeiro admin nasce pelo seed
- `admin` — endpoints exclusivos da equipe Nuvra (guardados por `FuncionarioAuthGuard`): vínculo da conta Meta do cliente (onboarding), teto de checagem manual e aprovação de aportes acima do teto
- `clientes` — perfil e uso mensal do próprio cliente (somente leitura)
- `planos` — Básico / Essencial / Pró (limites de criativos e campanhas por mês)
- `criativos` — upload (DigitalOcean Spaces) e análise por IA (Claude)
- `campanhas` — criação pelo cliente e publicação autônoma via Meta Marketing API; aportes acima do teto ficam `AGUARDANDO_CHECAGEM_MANUAL` até a equipe Nuvra aprovar em `POST /admin/campanhas/:id/aprovar-checagem`
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

- **Painel interno para a equipe Nuvra**: os endpoints `/admin/*` (onboarding e aprovação de checagem manual) existem e estão protegidos, mas ainda não há uma tela — hoje só podem ser chamados diretamente pela API (ex: Postman/Insomnia) usando o token retornado por `POST /funcionarios/login`.
- **Preços dos planos**: os valores de mensalidade e taxa de implantação estão zerados no seed (`backend/prisma/seed.ts`) — defina os valores reais antes de abrir para clientes.
- **Testes com credenciais reais da Meta Marketing API**: a integração (`backend/src/meta-ads`) foi implementada conforme a documentação da Graph API v21.0, mas não foi testada contra uma conta de anúncio real — validar especialmente upload de vídeo, criação de creative e ativação de campanha.
- **Relatório semanal automático**: o endpoint existe (`POST /relatorios/gerar-semana`), mas o agendamento (toda segunda-feira) e o layout visual do relatório dentro da plataforma ainda precisam ser implementados — hoje ele só persiste os dados consolidados.
