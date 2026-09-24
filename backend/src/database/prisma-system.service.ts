import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Acesso total (papel nuvra_system, sem RLS). Uso restrito a: autenticação (login/sessão),
// resolução do cliente pelo Telegram e rotinas em segundo plano. Toda escrita relevante
// deve gerar um EventoAuditoria. Código de tela/consulta de dados do cliente NÃO usa isto.
export class PrismaSystemService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(connectionString: string) {
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
