# Briefing do Projeto: Nuvra.AI

## 1. O que é

Nuvra.AI é um SaaS de gestão de tráfego pago totalmente autônomo, operado por Inteligência Artificial, desenvolvido pela agência Nuvra. O cliente contrata o serviço, envia o criativo (imagem ou vídeo), escolhe o objetivo da campanha, o público e o valor a investir, e a própria IA analisa o material, decide o direcionamento, e publica a campanha diretamente na conta de anúncio do cliente na Meta, sem necessidade de um humano por trás no processo.

Acessível como aplicativo instalável (PWA), sem obrigar o cliente a acessar via navegador comum.

Por enquanto, o sistema cobre apenas Meta Ads (Facebook e Instagram). Google Ads fica fora do escopo inicial.

## 2. Funcionalidades

### 2.1 Cadastro e acesso do cliente
- Cadastro e login na plataforma
- Escolha de plano no momento da contratação (ver seção 4)
- Cobrança recorrente do plano mensal, mais taxa única de implantação

### 2.2 Onboarding (feito pela Nuvra, uma única vez por cliente)
- Vinculação da conta de anúncio do cliente ao Business Manager da Nuvra
- Orientação para o cliente adicionar seu próprio cartão/saldo direto no Gerenciador de Anúncios da Meta (via link direto)
- Treinamento rápido de uso da plataforma

### 2.3 Configuração da campanha (feita pelo cliente)
- Upload do criativo (imagem ou vídeo)
- Escolha do valor a investir
- Escolha (ou sugestão da IA) do público-alvo
- Escolha do objetivo da campanha, entre os 6 objetivos atuais da Meta, cada um com uma explicação simples exibida na tela:

  - **Reconhecimento**: mostra o anúncio ao maior número possível de pessoas do público escolhido, para tornar a marca ou o produto conhecidos. Não busca ação imediata.
  - **Tráfego**: leva o maior número possível de pessoas até um destino escolhido pelo cliente (site, página de vendas, link externo).
  - **Engajamento**: busca curtidas, comentários, compartilhamentos, visualizações de vídeo até o fim, ou início de conversas. Quando o cliente quer gerar conversas, escolhe para onde elas vão: WhatsApp, Instagram Direct ou Messenger.
  - **Leads**: capta nome, telefone e e-mail da pessoa interessada direto dentro do próprio anúncio, via formulário rápido, sem sair do Instagram/Facebook.
  - **Promoção do app**: voltado a quem tem aplicativo próprio; busca instalações ou retorno de uso.
  - **Vendas**: busca o máximo de vendas possível com a verba investida, no site, dentro do Instagram/Facebook, ou via WhatsApp.

- **Aviso específico do objetivo Vendas** (não bloqueia a escolha, apenas informa): exibir abaixo da opção Vendas um texto do tipo "Recomendado para quem já possui um rastreamento avançado configurado (Pixel + API de Conversões). Sem isso, o resultado tende a ser menos preciso. Não tem essa configuração? Fale com a Nuvra, podemos configurar isso para você."

### 2.4 Análise automática do criativo pela IA
- A IA analisa a imagem/vídeo enviado (qualidade, apelo visual, adequação ao nicho)
- Cruza a análise com o histórico de anúncios daquele cliente (o que já performou bem ou mal antes)
- Opina sobre a performance esperada daquele criativo com aquele público

### 2.5 Decisão e publicação autônoma da campanha
- Com base na análise, a IA define/ajusta público e posicionamento (Feed, Reels, Stories etc.)
- Publica a campanha diretamente na conta do cliente via Meta Marketing API, sem aprovação humana no fluxo padrão
- Único ponto de checagem manual: aportes de valor acima de um teto definido pela Nuvra, que passam por uma verificação extra antes de subir

### 2.6 Controle de orçamento
- O sistema ajusta e controla, via API, o valor investido em cada campanha e o teto de gasto da conta
- Isso é diferente de adicionar saldo/forma de pagamento, que é feito pelo próprio cliente direto na Meta (a Meta não permite automatizar isso via API, por segurança)

### 2.7 Relatório semanal automático
- Toda segunda-feira, o cliente recebe dentro da própria plataforma um relatório de performance das campanhas da semana
- Relatório segue a identidade visual da Nuvra: azul `#1747E9`, azul médio `#01219C`, navy `#010C28`, papel/cinza claro `#E5E5E5`, com os logos oficiais do grupo

### 2.8 Limites por plano
- Cada plano libera uma quantidade diferente de criativos e campanhas por mês (ver seção 4)

## 3. Arquitetura técnica

- **Frontend**: aplicativo instalável (PWA), tela de cadastro/login, tela de upload de criativo, tela de configuração de campanha, tela de acompanhamento e relatório
- **Backend**: recebe uploads, gerencia autenticação, organiza dados por cliente
- **Armazenamento de arquivos**: DigitalOcean Spaces, para os criativos enviados
- **Banco de dados**: Postgres (já em uso pela Nuvra), guardando histórico de campanhas e resultados por cliente, usado pela IA para decidir e opinar
- **Automação**: fluxos em n8n conectando upload, chamada à API da Anthropic (Claude), Meta Marketing API, e banco de dados
- **IA**: modelo Claude Sonnet 5 via API da Anthropic, usado para analisar criativos e decidir/opinar sobre público, posicionamento e performance esperada
- **Publicação de campanhas**: Meta Marketing API, usando um Business Manager verificado da Nuvra e um System User com token de longa duração e permissão de administrador nas contas de anúncio dos clientes

## 4. Planos

| Plano | Criativos/mês | Campanhas/mês |
|---|---|---|
| Básico | até 5 | até 5 |
| Essencial | até 15 | até 15 |
| Pró | até 40 (ou uso considerado razoável) | até 40 |

Custo de IA (token) por operação, com Claude Sonnet 5, é baixo (poucos centavos de dólar por criativo analisado), então o preço de cada plano deve refletir principalmente o valor entregue e o volume liberado, não o custo de token isoladamente.

Além do valor mensal, todos os planos incluem uma **taxa única de implantação**, cobrindo a configuração inicial da conta do cliente e o treinamento de uso da plataforma.

## 5. Regras de autonomia

- O sistema opera de forma autônoma por padrão: analisa, decide e publica sem necessidade de aprovação humana
- Exceção única: aportes de valor acima de um teto definido pela Nuvra passam por uma checagem extra antes da publicação

## 6. Primeiros passos sugeridos para o Claude Code

1. Montar a estrutura do backend (autenticação, upload, organização por cliente)
2. Montar o schema do banco de dados (clientes, criativos, campanhas, resultados)
3. Montar a tela de configuração de campanha (upload, valor, público, objetivo, aviso do objetivo Vendas)
4. Integrar a chamada à API da Anthropic para análise do criativo
5. Integrar a Meta Marketing API para publicação e controle de orçamento
6. Montar o fluxo do relatório semanal, usando a identidade visual da Nuvra
7. Transformar o frontend em PWA instalável
