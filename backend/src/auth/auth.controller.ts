import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, ContextoRequisicao } from './auth.service.js';
import { ClienteAtual } from './cliente-atual.decorator.js';
import { COOKIE_SESSAO, LIMITE_AUTH_POR_MINUTO } from './constantes.js';
import { CadastroDto } from './dto/cadastro.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SessaoGuard } from './sessao.guard.js';

const contexto = (req: Request): ContextoRequisicao => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

function definirCookie(res: Response, token: string, expiraEm: Date) {
  res.cookie(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiraEm,
  });
}

@Controller('auth')
@Throttle({ default: { limit: LIMITE_AUTH_POR_MINUTO, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('cadastro')
  async cadastro(
    @Body() dto: CadastroDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { cliente, token, expiraEm } = await this.auth.cadastrar(dto, contexto(req));
    definirCookie(res, token, expiraEm);
    return { cliente };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { cliente, token, expiraEm } = await this.auth.entrar(dto, contexto(req));
    definirCookie(res, token, expiraEm);
    return { cliente };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE_SESSAO];
    await this.auth.sair(token, contexto(req));
    res.clearCookie(COOKIE_SESSAO, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }

  @Get('eu')
  @UseGuards(SessaoGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  eu(@ClienteAtual() clienteId: string) {
    return this.auth.perfil(clienteId);
  }
}
