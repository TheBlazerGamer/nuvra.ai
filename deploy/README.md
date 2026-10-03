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
**Ordem:** faça o passo 4 (subir o stack) primeiro — é ele que cria o Postgres — e depois volte aqui. Isto roda **uma vez**, e de novo cada vez que houver uma migration nova.

Prepare o banco com **um único container avulso** (Portainer → Containers → Add container, ou `docker run` pelo terminal do servidor). Ele aplica as migrations **e** liga o login dos papéis `nuvra_app`/`nuvra_system` (por isso recebe as três URLs). Pode rodar de novo a cada deploy: não estraga nada.
   ```
   docker run --rm --network nuvra_nuvra_internal \
     -e DB_OWNER_URL="postgresql://nuvra_owner:<DB_OWNER_PASSWORD>@postgres:5432/nuvra" \
     -e DB_APP_URL="postgresql://nuvra_app:<DB_APP_PASSWORD>@postgres:5432/nuvra" \
     -e DB_SYSTEM_URL="postgresql://nuvra_system:<DB_SYSTEM_PASSWORD>@postgres:5432/nuvra" \
     ghcr.io/theblazergamer/nuvra-backend:migrator-latest
   ```
   No Portainer, use a imagem `ghcr.io/theblazergamer/nuvra-backend:migrator-latest`, a rede `nuvra_nuvra_internal` e as três variáveis acima. Ao final, o log deve terminar com `Papéis nuvra_app e nuvra_system provisionados.`

   **Dica sobre as senhas:** gere-as só com letras e números (sem `@`, `:`, `/`, `#`...), porque elas vão dentro de uma URL. Longas (40+ caracteres) já bastam.

   Enquanto este passo não for feito, o serviço `backend` fica reiniciando com erro de banco — é esperado; ele se estabiliza sozinho depois.

### 4. Subir o stack no Portainer
Portainer → Stacks → Add stack → cole o conteúdo de [`stack.yml`](./stack.yml) → na seção **Environment variables**, cole (um por linha, sem aspas):

```
DB_OWNER_PASSWORD=<gere uma senha longa e aleatória>
DB_APP_PASSWORD=<outra senha>
DB_SYSTEM_PASSWORD=<outra senha>
TELEGRAM_BOT_TOKEN=<do .env que você já preencheu>
TELEGRAM_BOT_USERNAME=<idem>
TELEGRAM_WEBHOOK_SECRET=<idem>
META_APP_ID=<ID do app na Meta>
META_APP_SECRET=<Chave secreta do app, em Configurações → Básico no painel da Meta>
META_LOGIN_CONFIG_ID=
META_TOKEN_ENCRYPTION_KEY=<chave nova de produção, veja abaixo>
EMAIL_FROM=Nuvra.AI <nao-responda@gruponuvra.com.br>
SMTP_USER=<login SMTP do Brevo>
SMTP_PASS=<chave SMTP do Brevo>
```

**Essas variáveis não vão para o GitHub** — ficam só dentro do Portainer. É exatamente o mesmo princípio do `.env` local, só que quem guarda o segredo agora é o Portainer, não um arquivo no seu computador.

**`META_TOKEN_ENCRYPTION_KEY`** é a chave que cifra os tokens da Meta no banco. Gere uma **nova** para produção (não reaproveite a do seu `.env` local), no PowerShell:

```powershell
$b = New-Object byte[] 32; $r = [Security.Cryptography.RandomNumberGenerator]::Create(); $r.GetBytes($b); [Convert]::ToBase64String($b)
```

Guarde uma cópia num gerenciador de senhas. Se essa chave for perdida, os tokens salvos ficam ilegíveis (os clientes teriam que reconectar a conta de anúncio — sem prejuízo de dados, mas dá trabalho).

`META_LOGIN_CONFIG_ID` pode ficar vazio (o login pede as permissões diretamente). O endereço de retorno que a Meta precisa conhecer é `https://api.gruponuvra.com.br/meta/callback`.

## Depois do primeiro deploy funcionando
- Registrar o webhook do Telegram (uma vez só), apontando para `https://api.gruponuvra.com.br/canais/telegram/webhook` com o mesmo segredo configurado no Portainer. No PowerShell, substituindo os três valores (o token e o segredo não ficam salvos no histórico se você usar variáveis só nessa sessão):
  ```powershell
  $token = "<TELEGRAM_BOT_TOKEN>"; $segredo = "<TELEGRAM_WEBHOOK_SECRET>"
  Invoke-RestMethod "https://api.telegram.org/bot$token/setWebhook" -Method Post -ContentType "application/json" -Body (@{ url = "https://api.gruponuvra.com.br/canais/telegram/webhook"; secret_token = $segredo } | ConvertTo-Json)
  ```
  A resposta deve trazer `ok: True`.
- Ativar o botão "Re-pull image and redeploy" do Portainer no serviço, ou configurar o webhook de redeploy automático do Portainer (temos que criar isso quando chegarmos lá).
- Resolver os dois pontos de DNS pendentes (SPF do Brevo e o registro DMARC duplicado) — sem relação com o deploy em si, mas afeta a entrega dos e-mails que o backend manda.
