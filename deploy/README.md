# Publicar o Nuvra.AI

**Nomeie o stack como `nuvra` no Portainer.** O Swarm prefixa o nome das redes com o nome do stack — com esse nome, a rede interna do banco vira `nuvra_nuvra_internal`, que é o nome usado nos comandos abaixo. Se você nomear diferente, troque esse nome nos comandos.

Este é o primeiro rascunho de publicação — ainda não foi testado contra o servidor de verdade (não tenho Docker nesta máquina para testar localmente antes). A primeira tentativa real vai acontecer quando você seguir os passos abaixo; é esperado precisar de um ou dois ajustes.

## Antes de tudo

### 1. DNS (Cloudflare)
Criar dois registros CNAME, iguais aos que já existem para `painel`/`editor` (apontando para `manager01.gruponuvra.com.br`, nuvem **laranja**):
- `gestor.gruponuvra.com.br` → `manager01.gruponuvra.com.br`
- `api.gruponuvra.com.br` → `manager01.gruponuvra.com.br`

### 2. GitHub → imagens
Cada `push` na branch `main` faz o GitHub construir e publicar duas imagens no GitHub Container Registry (GHCR), automaticamente, sem precisar de nada configurado por você:
- `ghcr.io/theblazergamer/nuvra-backend` (e uma variante `:migrator-latest`, usada só para as migrations)
- `ghcr.io/theblazergamer/nuvra-frontend`

Por padrão, pacotes no GHCR nascem **privados**. Para o Portainer conseguir baixar a imagem, ou você torna o pacote público (mais simples: no GitHub, dentro do pacote gerado, em Package settings → Change visibility), ou cria uma credencial de acesso no Portainer. Recomendo começar público — não tem código nenhum "secreto" dentro da imagem, todo segredo real fica nas variáveis de ambiente, fora da imagem.

### 3. Banco de dados
Isso roda **uma vez**, e de novo cada vez que houver uma migration nova:
1. No Portainer, suba o stack (`stack.yml`, passo 4) primeiro só com o serviço `postgres` no ar.
2. Rode a migração, como um container avulso (Portainer → Containers → Create/Run, ou `docker run` se você tiver acesso via terminal do servidor):
   ```
   docker run --rm --network nuvra_nuvra_internal \
     -e DB_OWNER_URL="postgresql://nuvra_owner:<senha>@postgres:5432/nuvra" \
     ghcr.io/theblazergamer/nuvra-backend:migrator-latest
   ```
3. Rode o provisionamento dos papéis do banco (liga o login de `nuvra_app`/`nuvra_system` — ver [backend/README.md](../backend/README.md)) a partir de qualquer máquina com acesso à porta do Postgres, ou temporariamente publicando a porta do Postgres só durante esse passo.

### 4. Subir o stack no Portainer
Portainer → Stacks → Add stack → cole o conteúdo de [`stack.yml`](./stack.yml) → na seção **Environment variables**, cole (um por linha, sem aspas):

```
DB_OWNER_PASSWORD=<gere uma senha longa e aleatória>
DB_APP_PASSWORD=<outra senha>
DB_SYSTEM_PASSWORD=<outra senha>
TELEGRAM_BOT_TOKEN=<do .env que você já preencheu>
TELEGRAM_BOT_USERNAME=<idem>
TELEGRAM_WEBHOOK_SECRET=<idem>
EMAIL_FROM=Nuvra.AI <nao-responda@gruponuvra.com.br>
SMTP_USER=<login SMTP do Brevo>
SMTP_PASS=<chave SMTP do Brevo>
```

**Essas variáveis não vão para o GitHub** — ficam só dentro do Portainer. É exatamente o mesmo princípio do `.env` local, só que quem guarda o segredo agora é o Portainer, não um arquivo no seu computador.

## Depois do primeiro deploy funcionando
- Trocar a imagem do backend de `:latest` para o webhook do Telegram apontar para `https://api.gruponuvra.com.br/telegram/webhook` (esse endpoint ainda não existe — é o próximo módulo).
- Ativar o botão "Re-pull image and redeploy" do Portainer no serviço, ou configurar o webhook de redeploy automático do Portainer (temos que criar isso quando chegarmos lá).
- Resolver os dois pontos de DNS pendentes (SPF do Brevo e o registro DMARC duplicado) — sem relação com o deploy em si, mas afeta a entrega dos e-mails que o backend manda.
