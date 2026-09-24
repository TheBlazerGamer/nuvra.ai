import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaSystemService } from '../database/prisma-system.service.js';
import { PrismaTenantService } from '../database/prisma-tenant.service.js';
import { AuditoriaService } from './auditoria.service.js';
import { BLOQUEIO_LOGIN_MS, MAX_TENTATIVAS_LOGIN } from './constantes.js';
import { CadastroDto } from './dto/cadastro.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { SenhaService } from './senha.service.js';
import { SessaoService } from './sessao.service.js';

export interface ContextoRequisicao {
  ip?: string;
  userAgent?: string;
}

// Mesma mensagem para e-mail inexistente e senha errada: não revela quais e-mails têm conta.
const MSG_CREDENCIAIS = 'E-mail ou senha incorretos.';

@Injectable()
export class AuthService {
  constructor(
    private readonly system: PrismaSystemService,
    private readonly tenant: PrismaTenantService,
    private readonly senhas: SenhaService,
    private readonly sessoes: SessaoService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async cadastrar(dto: CadastroDto, ctx: ContextoRequisicao) {
    if (dto.senha.toLowerCase() === dto.email) {
      throw new BadRequestException('A senha não pode ser igual ao e-mail.');
    }

    const senhaHash = await this.senhas.hashear(dto.senha);

    let cliente: { id: string; nome: string; email: string };
    try {
      cliente = await this.system.cliente.create({
        data: { nome: dto.nome, email: dto.email, senhaHash },
        select: { id: true, nome: true, email: true },
      });
    } catch (erro) {
      if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw new ConflictException('Já existe uma conta com este e-mail.');
      }
      throw erro;
    }

    const sessao = await this.sessoes.criar(cliente.id, ctx.userAgent);
    await this.auditoria.registrar('cadastro', { clienteId: cliente.id, ip: ctx.ip });
    return { cliente, ...sessao };
  }

  async entrar(dto: LoginDto, ctx: ContextoRequisicao) {
    const cliente = await this.system.cliente.findUnique({
      where: { email: dto.email },
      select: { id: true, nome: true, email: true, senhaHash: true, status: true, bloqueadoAte: true },
    });

    if (!cliente) {
      await this.senhas.verificarFalso(dto.senha);
      await this.auditoria.registrar('login_falha', { ip: ctx.ip, detalhes: { motivo: 'email_desconhecido' } });
      throw new UnauthorizedException(MSG_CREDENCIAIS);
    }

    if (cliente.bloqueadoAte && cliente.bloqueadoAte.getTime() > Date.now()) {
      await this.auditoria.registrar('login_bloqueado', { clienteId: cliente.id, ip: ctx.ip });
      throw new HttpException(
        'Muitas tentativas incorretas. Tente novamente em alguns minutos.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const senhaCorreta = await this.senhas.verificar(cliente.senhaHash, dto.senha);
    if (!senhaCorreta) {
      await this.registrarFalha(cliente.id, ctx);
      throw new UnauthorizedException(MSG_CREDENCIAIS);
    }

    if (cliente.status !== 'ATIVO') {
      await this.auditoria.registrar('login_falha', {
        clienteId: cliente.id,
        ip: ctx.ip,
        detalhes: { motivo: 'conta_suspensa' },
      });
      throw new UnauthorizedException(MSG_CREDENCIAIS);
    }

    if (cliente.bloqueadoAte) {
      await this.system.cliente.update({
        where: { id: cliente.id },
        data: { bloqueadoAte: null },
        select: { id: true },
      });
    }

    const sessao = await this.sessoes.criar(cliente.id, ctx.userAgent);
    await this.auditoria.registrar('login_ok', { clienteId: cliente.id, ip: ctx.ip });
    return { cliente: { id: cliente.id, nome: cliente.nome, email: cliente.email }, ...sessao };
  }

  async sair(token: string | undefined, ctx: ContextoRequisicao) {
    if (!token) return;
    await this.sessoes.revogar(token);
    await this.auditoria.registrar('logout', { ip: ctx.ip });
  }

  async perfil(clienteId: string) {
    return this.tenant.comTenant(clienteId, async (tx) => {
      const cliente = await tx.cliente.findUniqueOrThrow({
        where: { id: clienteId },
        select: { id: true, nome: true, email: true, criadoEm: true },
      });
      const vinculo = await tx.vinculoTelegram.findUnique({
        where: { clienteId },
        select: { vinculadoEm: true },
      });
      return { cliente, telegramConectado: vinculo !== null };
    });
  }

  // O bloqueio conta as falhas dos últimos 15 minutos, desconsiderando as anteriores ao último login bem-sucedido.
  private async registrarFalha(clienteId: string, ctx: ContextoRequisicao) {
    await this.auditoria.registrar('login_falha', { clienteId, ip: ctx.ip });

    const janela = new Date(Date.now() - BLOQUEIO_LOGIN_MS);
    const ultimoSucesso = await this.system.eventoAuditoria.findFirst({
      where: { clienteId, tipo: 'login_ok' },
      orderBy: { criadoEm: 'desc' },
      select: { criadoEm: true },
    });
    const desde = ultimoSucesso && ultimoSucesso.criadoEm > janela ? ultimoSucesso.criadoEm : janela;

    const falhas = await this.system.eventoAuditoria.count({
      where: { clienteId, tipo: 'login_falha', criadoEm: { gt: desde } },
    });

    if (falhas >= MAX_TENTATIVAS_LOGIN) {
      await this.system.cliente.update({
        where: { id: clienteId },
        data: { bloqueadoAte: new Date(Date.now() + BLOQUEIO_LOGIN_MS) },
        select: { id: true },
      });
      await this.auditoria.registrar('conta_bloqueada', { clienteId, ip: ctx.ip });
    }
  }
}
