import { Injectable } from '@nestjs/common';
import { TipoTokenMeta } from '@prisma/client';
import { PrismaSystemService } from '../database/prisma-system.service.js';
import { PrismaTenantService } from '../database/prisma-tenant.service.js';
import { MetaCriptografiaService } from './meta-criptografia.service.js';
import type { TokenMeta } from './meta-graph.service.js';

// Só o papel de sistema grava e lê o token (sempre cifrado); o cliente só enxerga o status
// (conta/Página escolhidas, validade) e pode apagar a própria conexão — nunca o token em si.
@Injectable()
export class MetaConexaoService {
  constructor(
    private readonly system: PrismaSystemService,
    private readonly tenant: PrismaTenantService,
    private readonly cripto: MetaCriptografiaService,
  ) {}

  async salvar(clienteId: string, tipoToken: TipoTokenMeta, token: TokenMeta, metaUserId: string): Promise<void> {
    const tokenCriptografado = this.cripto.cifrar(token.accessToken);
    const expiraEm = token.expiraEmSegundos ? new Date(Date.now() + token.expiraEmSegundos * 1000) : null;

    await this.system.conexaoMeta.upsert({
      where: { clienteId },
      create: { clienteId, metaUserId, tipoToken, tokenCriptografado, expiraEm },
      update: { metaUserId, tipoToken, tokenCriptografado, expiraEm },
      select: { id: true },
    });
  }

  async definirAtivos(
    clienteId: string,
    contaAnuncio: { id: string; nome: string },
    pagina: { id: string; nome: string } | null,
  ): Promise<void> {
    await this.system.conexaoMeta.update({
      where: { clienteId },
      data: {
        contaAnuncioId: contaAnuncio.id,
        contaAnuncioNome: contaAnuncio.nome,
        paginaId: pagina?.id ?? null,
        paginaNome: pagina?.nome ?? null,
      },
      select: { id: true },
    });
  }

  async obterTokenDecifrado(clienteId: string): Promise<string | null> {
    const registro = await this.system.conexaoMeta.findUnique({
      where: { clienteId },
      select: { tokenCriptografado: true },
    });
    return registro ? this.cripto.decifrar(registro.tokenCriptografado) : null;
  }

  status(clienteId: string) {
    return this.tenant.comTenant(clienteId, (tx) =>
      tx.conexaoMeta.findUnique({
        where: { clienteId },
        select: {
          tipoToken: true,
          contaAnuncioId: true,
          contaAnuncioNome: true,
          paginaId: true,
          paginaNome: true,
          expiraEm: true,
          conectadoEm: true,
        },
      }),
    );
  }

  // Chamado pelos avisos da Meta (sem sessão de cliente): apaga o token de quem removeu o app ou pediu exclusão.
  // Devolve os clientes afetados, para a trilha de auditoria. Usuário desconhecido não é erro (devolve vazio).
  async removerPorUsuarioMeta(metaUserId: string): Promise<string[]> {
    const afetados = await this.system.conexaoMeta.findMany({ where: { metaUserId }, select: { clienteId: true } });
    if (afetados.length > 0) await this.system.conexaoMeta.deleteMany({ where: { metaUserId } });
    return afetados.map((a) => a.clienteId);
  }

  async desconectar(clienteId: string): Promise<boolean> {
    const { count } = await this.tenant.comTenant(clienteId, (tx) =>
      tx.conexaoMeta.deleteMany({ where: { clienteId } }),
    );
    return count > 0;
  }
}
