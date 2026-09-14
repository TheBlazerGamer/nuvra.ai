import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PlanosService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.plano.findMany({ orderBy: { precoMensalCentavos: 'asc' } });
  }

  findByNome(nome: 'BASICO' | 'ESSENCIAL' | 'PRO') {
    return this.prisma.plano.findUniqueOrThrow({ where: { nome } });
  }
}
