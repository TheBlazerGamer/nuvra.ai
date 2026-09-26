import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, ContextoRequisicao } from './auth.service.js';
import { ClienteAtual, SessaoAtual } from './cliente-atual.decorator.js';
import { COOKIE_SESSAO, LIMITE_AUTH_POR_MINUTO } from './constantes.js';
import { CadastroDto } from './dto/cadastro.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AlterarSenhaDto, EsqueciSenhaDto, RedefinirSenhaDto, TokenDto } from './dto/senhas.dto.js';
import { SessaoGuard } from './sessao.guard.js';

const contexto = (req: Request): ContextoRequisicao => ({
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});

function opcoesCookie() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

@Controller('auth')
@Throttle({ default: { limit: LIMITE_AUTH_POR_MINUTO, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Mesma resposta exista ou não uma conta com o e-mail: não permite descobrir quem é cliente.
  @Post('cadastro')
  @HttpCode(202)
  async cadastro(@Body() dto: CadastroDto, @Req() req: Request) {
    await this.auth.cadastrar(dto, contexto(req));
    return { mensagem: 'Enviamos um e-mail para você confirmar sua conta. Confira também a caixa de spam.' };
  }

  @Post('verificar-email')
  @HttpCode(204)
  async verificarEmail(@Body() dto: TokenDto, @Req() req: Request) {
    await this.auth.verificarEmail(dto.token, contexto(req));
  }

  @Post('reenviar-verificacao')
  @HttpCode(202)
  @UseGuards(SessaoGuard)
  async reenviarVerificacao(@ClienteAtual() clienteId: string, @Req() req: Request) {
    await this.auth.reenviarVerificacao(clienteId, contexto(req));
    return { mensagem: 'Se o seu e-mail ainda não foi confirmado, enviamos um novo link.' };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { cliente, token, expiraEm } = await this.auth.entrar(dto, contexto(req));
    res.cookie(COOKIE_SESSAO, token, { ...opcoesCookie(), expires: expiraEm });
    return { cliente };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string> | undefined)?.[COOKIE_SESSAO];
    await this.auth.sair(token, contexto(req));
    res.clearCookie(COOKIE_SESSAO, opcoesCookie());
  }

  @Get('eu')
  @UseGuards(SessaoGuard)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  eu(@ClienteAtual() clienteId: string) {
    return this.auth.perfil(clienteId);
  }

  @Post('esqueci-senha')
  @HttpCode(202)
  esqueciSenha(@Body() dto: EsqueciSenhaDto, @Req() req: Request) {
    this.auth.esqueciSenha(dto.email, contexto(req));
    return { mensagem: 'Se existir uma conta com este e-mail, enviamos as instruções para redefinir a senha.' };
  }

  @Post('redefinir-senha')
  @HttpCode(204)
  async redefinirSenha(@Body() dto: RedefinirSenhaDto, @Req() req: Request) {
    await this.auth.redefinirSenha(dto, contexto(req));
  }

  @Post('alterar-senha')
  @HttpCode(204)
  @UseGuards(SessaoGuard)
  async alterarSenha(
    @ClienteAtual() clienteId: string,
    @SessaoAtual() sessaoId: string,
    @Body() dto: AlterarSenhaDto,
    @Req() req: Request,
  ) {
    await this.auth.alterarSenha(clienteId, sessaoId, dto, contexto(req));
  }

  @Get('sessoes')
  @UseGuards(SessaoGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  sessoes(@ClienteAtual() clienteId: string, @SessaoAtual() sessaoId: string) {
    return this.auth.listarSessoes(clienteId, sessaoId);
  }

  @Post('sessoes/encerrar-outras')
  @HttpCode(204)
  @UseGuards(SessaoGuard)
  async encerrarOutras(@ClienteAtual() clienteId: string, @SessaoAtual() sessaoId: string, @Req() req: Request) {
    await this.auth.encerrarOutrasSessoes(clienteId, sessaoId, contexto(req));
  }

  @Delete('sessoes/:id')
  @HttpCode(204)
  @UseGuards(SessaoGuard)
  async encerrarSessao(
    @ClienteAtual() clienteId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    await this.auth.encerrarSessao(clienteId, id, contexto(req));
  }
}
