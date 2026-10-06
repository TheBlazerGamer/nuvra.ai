import { Injectable } from '@nestjs/common';
import type { RespostaContaAnuncio } from '@prisma/client';
import { PrismaTenantService } from '../database/prisma-tenant.service.js';
import { MetaAtivosService } from './meta-ativos.service.js';
import { MetaConexaoService } from './meta-conexao.service.js';
import { MetaGraphService } from './meta-graph.service.js';
import { avaliarProntidao, type Confirmavel, type Entrada, type Prontidao } from './prontidao.js';

// Junta o que o cliente informou (banco), o que ele já conectou e o que a Meta diz sobre a conta dele, e entrega
// ao avaliador o retrato completo. Cada consulta à Meta que falha vira "não consegui conferir" (null), nunca erro.
@Injectable()
export class MetaProntidaoService {
  constructor(
    private readonly tenant: PrismaTenantService,
    private readonly conexoes: MetaConexaoService,
    private readonly ativos: MetaAtivosService,
    private readonly graph: MetaGraphService,
  ) {}

  async avaliar(clienteId: string): Promise<Prontidao> {
    const { cliente, telegram, preparacao, conexao } = await this.tenant.comTenant(clienteId, async (tx) => ({
      cliente: await tx.cliente.findUniqueOrThrow({ where: { id: clienteId }, select: { emailVerificadoEm: true } }),
      telegram: await tx.vinculoCanal.findUnique({
        where: { clienteId_canal: { clienteId, canal: 'TELEGRAM' } },
        select: { id: true },
      }),
      preparacao: await tx.preparacaoConta.findUnique({
        where: { clienteId },
        select: { temContaAnuncio: true, confirmacoes: true },
      }),
      conexao: await tx.conexaoMeta.findUnique({
        where: { clienteId },
        select: { contaAnuncioId: true, contaAnuncioNome: true, paginaId: true, paginaNome: true, expiraEm: true },
      }),
    }));

    const entrada: Entrada = {
      emailVerificado: cliente.emailVerificadoEm !== null,
      telegramConectado: telegram !== null,
      temContaAnuncio: preparacao?.temContaAnuncio ?? null,
      confirmacoes: preparacao?.confirmacoes ?? [],
      conexao,
      agora: new Date(),
    };

    if (conexao) {
      // Token ilegível (ex.: chave de criptografia trocada) não derruba o assistente: as etapas viram "não consegui conferir".
      const token = await this.conexoes.obterTokenDecifrado(clienteId).catch(() => null);
      if (token) await this.consultarMeta(token, entrada);
    }

    return avaliarProntidao(entrada);
  }

  // Consulta só o necessário para o ponto em que a pessoa está; cada falha fica como null.
  private async consultarMeta(token: string, entrada: Entrada): Promise<void> {
    const contaId = entrada.conexao?.contaAnuncioId ?? null;
    const talvez = async <T>(consulta: () => Promise<T>): Promise<T | null> => {
      try {
        return await consulta();
      } catch {
        return null;
      }
    };

    if (!contaId) {
      entrada.contasDisponiveis = (await talvez(() => this.ativos.contasDoCliente(token)))?.length ?? null;
      return;
    }

    const [detalhes, instagram, paginas] = await Promise.all([
      talvez(() => this.graph.detalhesDaConta(token, contaId)),
      talvez(() => this.graph.instagramDaConta(token, contaId)),
      entrada.conexao?.paginaId ? Promise.resolve(undefined) : talvez(() => this.ativos.paginasDaConta(token, contaId)),
    ]);
    entrada.detalhesConta = detalhes;
    entrada.instagram = instagram;
    if (paginas !== undefined) entrada.paginasDisponiveis = paginas?.length ?? null;
  }

  async responderPergunta(clienteId: string, resposta: RespostaContaAnuncio): Promise<void> {
    await this.tenant.comTenant(clienteId, (tx) =>
      tx.preparacaoConta.upsert({
        where: { clienteId },
        create: { clienteId, temContaAnuncio: resposta },
        update: { temContaAnuncio: resposta },
        select: { id: true },
      }),
    );
  }

  // "Já fiz" (feito = true) ou "desfazer" (feito = false) de uma etapa. Sem duplicar nem aceitar etapas desconhecidas
  // (o controller já valida a lista).
  async confirmar(clienteId: string, etapa: Confirmavel, feito: boolean): Promise<void> {
    await this.tenant.comTenant(clienteId, async (tx) => {
      const atual = await tx.preparacaoConta.findUnique({ where: { clienteId }, select: { confirmacoes: true } });
      const resto = (atual?.confirmacoes ?? []).filter((c) => c !== etapa);
      // "Já vinculei" e "usar a identidade da Página" são respostas que se excluem.
      const exclusivas = etapa === 'instagram' ? 'instagram_pagina' : etapa === 'instagram_pagina' ? 'instagram' : null;
      const confirmacoes = (feito ? [...resto, etapa] : resto).filter((c) => !(feito && c === exclusivas));
      await tx.preparacaoConta.upsert({
        where: { clienteId },
        create: { clienteId, confirmacoes },
        update: { confirmacoes },
        select: { id: true },
      });
    });
  }
}
