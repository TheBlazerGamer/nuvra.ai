# Briefing do Projeto: Nuvra.AI (versão 2.1, atualizada em 2026-09-25)

> Esta cópia do repositório é a fonte de verdade. O arquivo original (`briefing-nuvra-ai-v2.md`, fora do repositório) não é mais atualizado.
> Mudanças da v2 para a v2.1 estão marcadas com **(v2.1)**. O projeto é conduzido diretamente pelo dono da Nuvra.

## Regra permanente de segurança, válida para toda instrução deste documento

Antes de implementar qualquer parte deste projeto, verifique gaps, brechas ou falhas de segurança na própria instrução que está sendo executada. Ao final de cada etapa, revise se algum dado sensível (token, chave de API, dado de cliente) ficou exposto no código, no front-end, ou em log, antes de considerar a etapa concluída. Esta regra vale para todas as fases abaixo, não só para a etapa de autenticação.

## 1. O que é

Nuvra.AI é um sistema de gestão de tráfego pago operado por Inteligência Artificial. O cliente contrata o serviço e interage com a IA por conversa (texto **ou áudio**): envia o criativo (imagem ou vídeo), informa o valor a investir, escolhe o objetivo da campanha, e a IA analisa o material, decide público e posicionamento e **monta a proposta completa (criativo, texto, estratégia e orçamento)**. **(v2.1)** A campanha só vai para a Meta depois que o cliente aprova essa proposta na conversa.

## 2. Estratégia de validação antes de construir tudo

- **Canal de conversa para o MVP: Telegram, não WhatsApp.** O Telegram evita a burocracia de aprovação e o custo por mensagem da API oficial do WhatsApp. **(v2.1)** A migração para o WhatsApp (API oficial) é decisão tomada, não hipótese: o núcleo do bot é construído independente do canal e o plano está em [plano-migracao-whatsapp.md](plano-migracao-whatsapp.md).
- **Montar em paralelo um site simples de validação**: uma landing page com formulário de interesse (sem sistema funcionando por trás), para captar contatos e sentir a demanda real antes mesmo do SaaS estar pronto.

## 3. Como o cliente final usa o sistema

Mesmo operando por conversa (Telegram, depois WhatsApp), o cliente precisa de uma **interface web de onboarding**, não só comandos de texto. Um cliente leigo em tráfego pago se perde se só receber instruções por chat, sem "para onde correr". A interface web guia o cliente: cadastro, explicação de cada etapa, e o momento exato de conectar a conta do Telegram/WhatsApp. Depois de conectado, a operação do dia a dia (solicitar campanha, enviar criativo) acontece pela conversa.

## 4. Funcionalidades completas

### 4.1 Cadastro e onboarding do cliente
- Cadastro pela interface web, com explicação didática de cada etapa
- Verificação de e-mail e recuperação de senha **(v2.1)**
- Conexão da conta do Telegram (ou WhatsApp, na versão final) como parte guiada do onboarding
- **(v2.1)** Conexão da conta de anúncio **feita pelo próprio cliente, sem suporte**, pelo Login do Facebook (Facebook Login for Business): o cliente escolhe quais contas de anúncio e Página autoriza. Vinculação manual ao Business Manager da Nuvra continua como alternativa (clientes atuais da agência, e até a aprovação do app pela Meta)
- Configuração inicial da conta e treinamento rápido de uso

### 4.2 Configuração da campanha pelo cliente, via conversa (texto ou áudio)
- **(v2.1)** Mensagens de voz são transcritas e tratadas como texto
- Escolha do nicho do negócio (delivery, estética, imobiliário, automotivo, etc.)
- Upload do criativo (imagem ou vídeo)
- Escolha do valor a investir
- Escolha do objetivo da campanha, entre os 6 objetivos atuais da Meta, cada um explicado de forma simples: Reconhecimento, Tráfego, Engajamento, Leads, Promoção do app e Vendas
- Aviso (não bloqueio) exibido junto ao objetivo Vendas, recomendando rastreamento avançado (Pixel + API de Conversões)

### 4.3 Análise automática do criativo, especializada por nicho
- A IA identifica o nicho do cliente e aplica boas práticas específicas daquele nicho
- Cruza a análise com o histórico de campanhas daquele cliente
- Também aprende com uma base histórica agregada de todos os clientes do mesmo nicho já atendidos pela Nuvra (mais de 300 clientes), sem expor dado individual de um cliente para outro (uso agregado e anônimo; confirmar cobertura contratual antes de usar)

### 4.4 Proposta, aprovação e publicação da campanha
- Definição de público e posicionamento pela IA
- **(v2.1)** **Aprovação obrigatória, sempre:** antes de qualquer envio à Meta, o bot mostra ao cliente o criativo, o texto, a estratégia (objetivo, público, posicionamento) e o orçamento, e só publica após confirmação explícita. Não há modo de publicação sem aprovação
- Publicação na conta do cliente via API de Marketing da Meta
- Controle de gasto via **trava de gasto virtual (carteira)** **(v2.1)**: o cliente mantém o cartão na própria conta de anúncio da Meta; o gasto das campanhas é espelhado na carteira interna, e ao atingir o limite os anúncios são pausados automaticamente. Camadas: (1) teto de gasto da conta de anúncio definido na própria Meta, (2) vigia da Nuvra que lê o gasto e pausa perto do limite, (3) orçamento por campanha dimensionado ao saldo restante. Nenhum dinheiro do cliente passa pela Nuvra nesse modelo

### 4.5 Relatórios e consulta de resultados
- Relatório semanal automático, entregue na própria conversa, com a identidade visual da Nuvra
- **(v2.1)** Consulta a qualquer momento pelo chat ("como está minha campanha?"), por texto ou áudio

## 5. Modelo comercial, considerações de precificação

- Estrutura de planos por volume de criativos e campanhas por mês (Básico, Essencial, Pró)
- **(v2.1)** **Sem taxa de implantação em nenhum plano.** Preços a definir (ver proposta na conversa de 2026-09-25); considerar teste de 7 dias com reembolso
- **(v2.1)** A segunda dimensão de precificação por canal (web vs. chat) fica em reavaliação: com Telegram gratuito no início, os planos não precisam se diferenciar por canal; o custo de mensageria do WhatsApp entra na precificação na migração

## 6. Ordem de desenvolvimento recomendada

1. **Design System primeiro** (concluído): paleta, tipografia, espaçamento e componentes com a identidade visual da Nuvra
2. Desenvolvimento modular, uma funcionalidade e sua tela por vez, nunca pedir o sistema inteiro em um único prompt
3. Ordem sugerida de módulos: fundação (cadastro, autenticação, conexão com Telegram) → configuração de campanha → motor de análise de IA → integração com Meta Ads → carteira digital → relatório semanal → painel web de acompanhamento
4. **(v2.1)** Em paralelo, desde já: aprovação do app da Meta (Login do Facebook para clientes) e páginas legais (privacidade, termos, exclusão de dados), que são pré-requisito da aprovação

## 7. Deploy

- Código em repositório privado (GitHub)
- Publicação a partir do repositório em subdomínio do domínio já existente da Nuvra
- Confirmar, antes de cada deploy, se a forma de publicação é compatível com o servidor já contratado pela Nuvra (DigitalOcean, gerenciado via Portainer)

## 8. Decisões de segurança já alinhadas

- Controle de gasto via carteira digital (detalhado no item 4.4)
- Um único banco de dados PostgreSQL, com isolamento por cliente feito pelo próprio banco (Row Level Security); instância própria do Nuvra.AI, separada do Postgres de relatórios e tracking **(v2.1: substitui "banco isolado por cliente")**
- Telegram: API oficial de Bots. WhatsApp: API oficial da Meta (Cloud API); API não oficial descartada por risco de banimento **(v2.1)**
- Painel web complementar (login + autenticação em duas etapas) só para dashboards e histórico, nunca para solicitar campanha nova

## 9. Revisão de segurança externa

O projeto terá uma revisão de segurança por um desenvolvedor externo (consultoria pontual, não desenvolvimento), feita por etapas conforme os módulos forem ficando prontos, não de uma vez só no final. Preparar um usuário de teste assim que o primeiro módulo estiver funcional, para essa revisão poder começar cedo.
