import { Injectable } from '@nestjs/common';
import { Canal } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaSystemService } from '../database/prisma-system.service.js';

// Curto de propósito: o token só serve para o clique imediato no link t.me/<bot>?start=<token>,
// não para guardar numa aba aberta por horas.
const VALIDADE_MS = 15 * 60 * 1000;

// O parâmetro "start" do Telegram só aceita [A-Za-z0-9_-], até 64 caracteres — base64url cabe exatamente nisso.
@Injectable()
export class TokensCanalService {
  constructor(private readonly system: PrismaSystemService) {}

  private static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // Gerar um novo token invalida os anteriores do mesmo canal: só o link mais recente funciona.
  async criar(clienteId: string, canal: Canal): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.system.$transaction([
      this.system.tokenVinculoCanal.updateMany({
        where: { clienteId, canal, usadoEm: null },
        data: { usadoEm: new Date() },
      }),
      this.system.tokenVinculoCanal.create({
        data: { clienteId, canal, tokenHash: TokensCanalService.hash(token), expiraEm: new Date(Date.now() + VALIDADE_MS) },
        select: { id: true },
      }),
    ]);
    return token;
  }

  async validar(token: string, canal: Canal): Promise<{ id: string; clienteId: string } | null> {
    if (!token || token.length > 64) return null;

    const registro = await this.system.tokenVinculoCanal.findUnique({
      where: { tokenHash: TokensCanalService.hash(token) },
      select: { id: true, clienteId: true, canal: true, expiraEm: true, usadoEm: true },
    });

    if (!registro || registro.canal !== canal || registro.usadoEm || registro.expiraEm.getTime() <= Date.now()) {
      return null;
    }
    return { id: registro.id, clienteId: registro.clienteId };
  }

  // Atômico: se a mesma pessoa clicar o link duas vezes ao mesmo tempo, só uma vence.
  async marcarUsado(id: string): Promise<boolean> {
    const { count } = await this.system.tokenVinculoCanal.updateMany({
      where: { id, usadoEm: null },
      data: { usadoEm: new Date() },
    });
    return count === 1;
  }

  contarRecentes(clienteId: string, canal: Canal, janelaMs = 60 * 60 * 1000): Promise<number> {
    return this.system.tokenVinculoCanal.count({
      where: { clienteId, canal, criadoEm: { gt: new Date(Date.now() - janelaMs) } },
    });
  }
}
