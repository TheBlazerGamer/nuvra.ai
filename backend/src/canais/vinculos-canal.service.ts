import { ConflictException, Injectable } from '@nestjs/common';
import { Canal, Prisma } from '@prisma/client';
import { PrismaSystemService } from '../database/prisma-system.service.js';
import { PrismaTenantService } from '../database/prisma-tenant.service.js';

// Só o papel de sistema pode gravar um vínculo (o webhook do canal resolve o cliente pelo token,
// não pelo cliente autenticado); o cliente só lê e apaga o próprio (ver migration "canais_genericos").
@Injectable()
export class VinculosCanalService {
  constructor(
    private readonly system: PrismaSystemService,
    private readonly tenant: PrismaTenantService,
  ) {}

  async vincular(clienteId: string, canal: Canal, idExterno: string, chatId: string): Promise<void> {
    try {
      await this.system.vinculoCanal.create({
        data: { clienteId, canal, idExterno, chatId },
        select: { id: true },
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw new ConflictException('Esta conta já está conectada a este canal.');
      }
      throw erro;
    }
  }

  async buscarPorExterno(canal: Canal, idExterno: string) {
    return this.system.vinculoCanal.findUnique({
      where: { canal_idExterno: { canal, idExterno } },
      select: { clienteId: true, chatId: true },
    });
  }

  async desvincular(clienteId: string, canal: Canal): Promise<boolean> {
    const { count } = await this.tenant.comTenant(clienteId, (tx) =>
      tx.vinculoCanal.deleteMany({ where: { clienteId, canal } }),
    );
    return count > 0;
  }
}
