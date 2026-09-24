import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { LoginFuncionarioDto } from './dto/login-funcionario.dto.js';

@Injectable()
export class FuncionariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginFuncionarioDto) {
    const funcionario = await this.prisma.funcionario.findUnique({ where: { email: dto.email } });
    if (!funcionario) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const senhaValida = await bcrypt.compare(dto.senha, funcionario.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }

    const accessToken = this.jwtService.sign({
      sub: funcionario.id,
      email: funcionario.email,
      tipo: 'funcionario',
    });

    return { accessToken };
  }
}
