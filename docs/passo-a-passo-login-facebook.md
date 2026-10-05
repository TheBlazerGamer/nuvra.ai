# Login com o Facebook (v1): passo a passo

Objetivo: o cliente conecta a **própria** conta de anúncio à Nuvra.AI sozinho, em poucos cliques, sem suporte.

Como o cliente vai ver: onboarding no site → "Conectar minha conta de anúncio" → tela oficial da Meta → escolhe quais contas de anúncio e Página autoriza → volta ao site com tudo conectado.

> Os nomes de menus da Meta mudam com frequência. Se algo não bater com a sua tela, tire um print e me envie: eu leio a imagem e ajusto o roteiro. Nunca cole o **App Secret** no chat (vai só no `.env`).

## Quem faz o quê

| Fase | Você | Eu | Depende de |
|---|---|---|---|
| A. Preparação | Dados da empresa, servidor, criar o app na Meta | Páginas legais, guia | Endereço público (https) |
| B. Configuração do login | Configurar no painel da Meta | Definir permissões mínimas e URLs | Fase A |
| C. Construção | Colocar as chaves no `.env` | Fluxo de login seguro, tela do onboarding | Fase B |
| D. Uso real em teste | Conectar sua conta e contas de teste | Corrigir o que aparecer | Fase C |
| E. Aprovação (App Review) | Gravar os vídeos, enviar | Roteiro dos vídeos, textos e instruções de teste | Fase D |
| F. No ar | Publicar o app (modo Live) | Monitorar | Aprovação da Meta |

Prazo: a construção é rápida; **o gargalo é a aprovação da Meta (dias a semanas)**. Por isso começamos pela Fase A hoje. Enquanto a Meta não aprova, os primeiros clientes conectam pelo vínculo manual.

## Fase A: preparação

**A1. Endereço público seguro.** O app da Meta exige endereços https públicos (`app.gruponuvra.com.br` e `api.gruponuvra.com.br`). Depende dos dados do servidor.

**A2. Páginas legais no ar.** A Meta exige política de privacidade, termos de uso e instruções de exclusão de dados, acessíveis por link. Já estão construídas no site (`/privacidade`, `/termos`, `/exclusao-de-dados`). Você preenche os dados da empresa em `frontend/src/lib/empresa.ts`, e um advogado revisa os textos antes de publicar. Rode `npm run verificar:legal` na pasta `frontend` para conferir se sobrou algum campo vazio.

**A3. Criar o app na Meta (você faz, eu guio):**
1. Entre em **developers.facebook.com** com o Facebook de quem administra o portfólio empresarial do Grupo Nuvra e registre-se como desenvolvedor.
2. **Meus apps → Criar app**.
3. Nome: `Nuvra.AI` (não use "Facebook" nem "Meta" no nome). E-mail de contato: um e-mail do domínio da empresa.
4. **Casos de uso:** escolha o de **gerenciar/criar anúncios (Marketing API)** e o de **login (Facebook Login for Business)**. Se o assistente perguntar o tipo, é "Business".
5. **Portfólio empresarial:** conecte ao portfólio **verificado** do Grupo Nuvra.
6. Crie um app **novo**, separado do que você usa no tracking, para que uma revisão ou um problema em um não afete o outro.
7. Depois de criar: **Configurações → Básico** e preencha ícone (1024×1024, o "N" da marca), categoria, URL da política de privacidade, URL dos termos, URL das instruções de exclusão de dados e domínio do app (`gruponuvra.com.br`).
8. Anote o **ID do app** (público). O **App Secret** fica só no `.env` do backend.

**A4. Verificação do negócio.** Confirme, no portfólio empresarial, que a verificação do negócio está concluída (você disse que já está).

## Fase B: configuração do login (com o app criado)

1. Adicione os produtos **Facebook Login for Business** e **Marketing API**.
2. Em Facebook Login for Business, crie uma **Configuração**. Ela define o tipo de token, as permissões e os ativos que o cliente autoriza. Anote o **ID da Configuração**.
3. **Tipo de token.** Há dois: (a) token de usuário (expira, precisa ser renovado, em torno de 60 dias) e (b) token de usuário de sistema de integração (não expira, mas fica ligado ao portfólio empresarial do cliente). Cliente leigo muitas vezes **não tem portfólio empresarial**, então vamos **testar os dois** e decidir com dados.
4. **Permissões (princípio do mínimo; a Meta recusa permissão sem uso demonstrado).** Candidatas: `ads_management`, `ads_read`, `pages_show_list`, `pages_read_engagement` e, só se for necessário, `business_management`. A lista final sai do que o fluxo realmente fizer.
5. **URLs:** (todas já existem no backend)
   - Redirecionamento do login (URIs de redirecionamento OAuth válidos): `https://api.gruponuvra.com.br/meta/callback` (em desenvolvimento, `http://localhost:3001/meta/callback`).
   - URL de **desautorização** (chamada pela Meta quando o cliente remove o app): `https://api.gruponuvra.com.br/meta/desautorizacao`.
   - URL de **exclusão de dados** (campo "Solicitação de exclusão de dados", escolha "URL de retorno de chamada de exclusão de dados", não a de instruções): `https://api.gruponuvra.com.br/meta/exclusao-dados`.
   - Os dois avisos chegam assinados com o App Secret; o backend recusa qualquer um sem assinatura válida.
6. **Funções:** em Funções, adicione você como administrador e crie **usuários de teste**.
7. Copie para o `backend/.env`: `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID`. Eu confiro apenas se estão preenchidos, sem mostrar valores.

## Fase C: o que eu construo (com segurança desde o início)

- Fluxo de login com `state` aleatório amarrado à sessão do cliente (anti-CSRF) e retorno só para as URLs cadastradas.
- Troca do código por token feita **no servidor**; o App Secret nunca vai ao navegador.
- **Token criptografado no banco** (AES-256-GCM, chave fora do banco), nunca em log.
- Tela para o cliente escolher qual conta de anúncio e qual Página usar (permissão por coluna e isolamento por cliente, como no resto do banco).
- Gestão de expiração: aviso ao cliente pelo Telegram antes de vencer e reconexão em um clique.
- Recebimento seguro das chamadas da Meta (desautorização e exclusão de dados), com verificação da assinatura (`signed_request`).
- Botão "Desconectar" que apaga o token.
- Todo evento na trilha de auditoria.

## Fase D e E: teste e aprovação
- Em modo desenvolvimento só quem tem função no app consegue conectar. Você e os testers conectam contas reais/de teste. Isso também gera as chamadas de API que a Meta exige (segundo a documentação, um mínimo de chamadas bem-sucedidas em 15 dias, com taxa de erro baixa).
- **App Review:** para cada permissão, a Meta pede a descrição do uso, um **vídeo mostrando o fluxo completo** e instruções de teste com acesso para os revisores. Eu escrevo os textos e o roteiro dos vídeos; você grava.
- Motivos comuns de recusa: vídeo que não mostra a permissão sendo usada, política de privacidade incompleta e pedir permissões que o app não usa.

## Fase F: no ar
Publique o app (modo Live). A Meta faz verificações periódicas (uso de dados): manter as páginas legais e o e-mail de contato atualizados.

## Pontos para o advogado revisar nos textos legais
- Uso de dados agregados e anônimos de desempenho de campanhas para melhorar recomendações (também para os clientes antigos da agência, cujos contratos precisam cobrir isso)
- Transferência internacional de dados (servidores, IA, transcrição de áudio, e-mail)
- Prazo de resposta a pedidos de exclusão e retenção mínima por obrigação legal/fiscal
- Cláusulas de responsabilidade e reembolso dos termos de uso
- **Antes de publicar, conferir se cada medida descrita existe de fato no sistema.** Hoje já existem: HTTPS, senha com Argon2id, checagem de senhas vazadas, isolamento por cliente, limite de tentativas, sessões gerenciáveis e auditoria. Ainda serão construídos: tokens da Meta criptografados (Fase C), descarte do áudio após a transcrição e o botão "Desconectar"
