# Plano de migração: Telegram → WhatsApp (API oficial)

Decisão (2026-09-25): o MVP roda no Telegram; a migração para o WhatsApp acontece depois, com a API oficial da Meta. O objetivo deste plano é que **trocar o canal não exija refazer o bot**.

## 1. Princípio: o núcleo não conhece o canal

```
Telegram ──► TelegramAdapter ─┐                      ┌─► TelegramAdapter ──► Telegram
                              ├─► Núcleo da conversa ┤
WhatsApp ──► WhatsAppAdapter ─┘   (IA, fluxo, regras) └─► WhatsAppAdapter ──► WhatsApp
```

- **Mensagem de entrada normalizada:** `{ canal, idExterno, idMensagem, tipo: texto | audio | imagem | video | escolha, texto?, midia?, escolha? }`. O adaptador converte o formato do canal para esse.
- **Mensagem de saída abstrata:** texto, lista de opções (botões), mídia, documento (PDF do relatório). O adaptador desenha isso do jeito do canal (teclado inline no Telegram, botões/lista interativa no WhatsApp).
- **Núcleo:** máquina de estados da conversa, IA (análise de criativo, proposta), aprovação obrigatória, carteira. Nunca importa nada de Telegram ou WhatsApp.
- **Vínculo genérico no banco:** ao construir o módulo do Telegram, criar `vinculos_canal` (`canal` TELEGRAM|WHATSAPP, `id_externo`, `chat_id`, único por `(canal, id_externo)`) em vez de `vinculos_telegram`. Um cliente pode ter os dois canais durante a transição.
- **Testes de contrato:** a mesma suíte de testes do núcleo roda com um canal "falso"; cada adaptador tem testes próprios.

## 2. O que muda de um canal para o outro

| Tema | Telegram | WhatsApp (API oficial) |
|---|---|---|
| Identidade do cliente | Link `t.me/bot?start=<token>` de uso único | Link `wa.me/<numero>?text=<codigo>`: o cliente envia o código e o número vem verificado pelo WhatsApp |
| Mensagens ativas (relatório semanal, alerta de saldo) | Livres | Fora da janela de 24 h só com **modelos (templates) aprovados** pela Meta, e cada mensagem pode ser cobrada |
| Botões | Teclado inline, sem limite prático | Até 3 botões ou lista de até 10 itens |
| Áudio | Mensagem de voz (OGG/Opus) | Nota de voz (OGG/Opus), baixada pelo id da mídia |
| Custo | Grátis | Cobrança por conversa/mensagem de modelo (entra na precificação) |
| Segurança do webhook | Cabeçalho com segredo | Assinatura HMAC do app (`X-Hub-Signature-256`) |

## 3. Fases

**Fase 0 – Agora (junto do módulo do Telegram):** construir o núcleo e o adaptador do Telegram já pela interface acima; `vinculos_canal` genérico; testes de contrato.

**Fase 1 – Preparar a Meta (em paralelo, sem depender de código):**
- Número de telefone **dedicado** (não pode estar ativo em outro WhatsApp), WhatsApp Business Account e app no Meta for Developers (recomendado um app separado do de tracking existente)
- Escrever e enviar para aprovação os modelos (templates): relatório semanal, saldo baixo, campanha pausada, aprovação pendente
- Verificar limites de mensagens do número (níveis de envio) e definir a estimativa de volume

**Fase 2 – Piloto:** implementar o `WhatsAppAdapter` (webhook, assinatura, download de mídia, envio de texto/botões/documento) e rodar com clientes internos, em **dois canais ao mesmo tempo** (Telegram continua funcionando).

**Fase 3 – Migração:** no painel/onboarding, botão "Conectar WhatsApp" para cada cliente; mensagens avisam o novo canal; período de convivência (sugestão: 30 dias).

**Fase 4 – Encerramento opcional do Telegram**, ou mantê-lo como canal secundário.

## 4. Critérios para começar a Fase 2
- Módulos de campanha, IA, Meta Ads e carteira validados no Telegram
- Revisão de segurança externa concluída para o núcleo
- Modelos de mensagem aprovados e custo por mensagem incorporado ao preço
- Decisão sobre o preço dos planos incluindo mensageria

## 5. Riscos
- **Aprovação de modelos pela Meta** pode demorar ou ser recusada: escrever os textos cedo e com finalidade clara
- **Custo variável** cresce com mensagens ativas: limitar e agrupar alertas
- **Restrições da janela de 24 h**: o núcleo deve saber quando só pode responder e quando precisa de modelo
- **Banimento do número** por má qualidade/denúncias: nunca enviar sem consentimento, oferecer "parar" em toda mensagem ativa
