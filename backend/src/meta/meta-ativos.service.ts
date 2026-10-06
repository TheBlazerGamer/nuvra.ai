import { Injectable } from '@nestjs/common';
import { MetaGraphService, type AtivoMeta } from './meta-graph.service.js';

// Regras sobre QUAIS contas e Páginas do cliente a Nuvra pode mostrar e usar. Compartilhado pela escolha de conta
// (MetaController) e pelo assistente de preparação (MetaProntidaoService).
@Injectable()
export class MetaAtivosService {
  constructor(private readonly graph: MetaGraphService) {}

  // Só as contas que o cliente liberou na tela da Meta ("todas" ou "só algumas"): o perfil dele pode enxergar mais
  // (ex.: uma agência com dezenas de contas), mas a Nuvra só mostra e só usa o que foi autorizado.
  async contasDoCliente(token: string): Promise<AtivoMeta[]> {
    const [contas, autorizadas] = await Promise.all([
      this.graph.listarContasDeAnuncio(token),
      this.graph.contasAutorizadas(token),
    ]);
    return autorizadas ? contas.filter((c) => autorizadas.has(c.id)) : contas;
  }

  // Páginas que podem anunciar por esta conta (inclui as do portfólio empresarial) mais as que o usuário administra.
  // Se as DUAS consultas falharem, a falha sobe (não é o mesmo que "não há Páginas"); se só uma falhar, vale a outra.
  async paginasDaConta(token: string, contaId: string): Promise<AtivoMeta[]> {
    const resultados = await Promise.allSettled([
      this.graph.listarPaginasDaConta(token, contaId),
      this.graph.listarPaginas(token),
    ]);
    const falhas = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (falhas.length === resultados.length) throw falhas[0].reason;

    const vistos = new Set<string>();
    return resultados
      .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      .filter((p) => !vistos.has(p.id) && vistos.add(p.id));
  }
}
