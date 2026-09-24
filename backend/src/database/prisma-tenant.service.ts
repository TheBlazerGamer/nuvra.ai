import { OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Único caminho para ler/gravar dados de cliente no fluxo normal da API.
// O PrismaClient fica privado: não existe como consultar sem passar por comTenant(),
// e o banco (papel nuvra_app + RLS) recusa qualquer linha de outro cliente mesmo assim.
export class PrismaTenantService implements OnModuleDestroy {
  private readonly cliente: PrismaClient;

  constructor(connectionString: string) {
    this.cliente = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  async comTenant<T>(
    clienteId: string,
    operacao: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!UUID.test(clienteId)) {
      throw new Error('clienteId inválido para o contexto do tenant.');
    }

    return this.cliente.$transaction(async (tx) => {
      // true = vale só até o fim desta transação; a conexão volta limpa para o pool.
      await tx.$queryRaw`SELECT set_config('app.cliente_id', ${clienteId}, true)`;
      return operacao(tx);
    });
  }

  async onModuleDestroy() {
    await this.cliente.$disconnect();
  }
}
