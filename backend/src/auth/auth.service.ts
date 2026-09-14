import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { PlanosService } from '../planos/planos.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planosService: PlanosService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existente = await this.prisma.cliente.findUnique({ where: { email: dto.email } });
    if (existente) {
      throw new ConflictException('Já existe um cadastro com este e-mail.');
    }

    const plano = await this.planosService.findByNome(dto.plano);
    const senhaHash = await bcrypt.hash(dto.senha, SALT_ROUNDS);

    const cliente = await this.prisma.cliente.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        telefone: dto.telefone,
        planoId: plano.id,
      },
    });

    return this.gerarToken(cliente.id, cliente.email);
  }

  async login(dto: LoginDto) {
    const cliente = await this.prisma.cliente.findUnique({ where: { email: dto.email } });
    if (!cliente) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const senhaValida = await bcrypt.compare(dto.senha, cliente.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    return this.gerarToken(cliente.id, cliente.email);
  }

  private gerarToken(clienteId: string, email: string) {
    const accessToken = this.jwtService.sign({ sub: clienteId, email });
    return { accessToken };
  }
}
