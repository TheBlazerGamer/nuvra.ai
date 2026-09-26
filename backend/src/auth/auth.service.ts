import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaSystemService } from '../database/prisma-system.service.js';
import { PrismaTenantService } from '../database/prisma-tenant.service.js';
import { EmailService } from '../email/email.service.js';
import { AuditoriaService } from './auditoria.service.js';
import { BLOQUEIO_LOGIN_MS, MAX_EMAILS_POR_HORA, MAX_TENTATIVAS_LOGIN } from './constantes.js';
import { CadastroDto } from './dto/cadastro.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { AlterarSenhaDto, RedefinirSenhaDto } from './dto/senhas.dto.js';
import { PoliticaSenhaService } from './politica-senha.service.js';
import { SenhaService } from './senha.service.js';
import { SessaoService } from './sessao.service.js';
import { TokensEmailService } from './tokens-email.service.js';

export interface ContextoRequisicao {
  ip?: string;
  userAgent?: string;
}

// Mesma mensagem para e-mail inexistente e senha errada: não revela quais e-mails têm conta.
const MSG_CREDENCIAIS = 'E-mail ou senha incorretos.';
const MSG_LINK_INVALIDO = 'Link inválido ou expirado. Peça um novo.';
const MSG_MUITAS_TENTATIVAS = 'Muitas tentativas incorretas. Tente novamente em alguns minutos.';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly tarefas = new Set<Promise<void>>();

  constructor(
    private readonly system: PrismaSystemService,
    private readonly tenant: PrismaTenantService,
    private readonly senhas: SenhaService,
    private readonly politica: PoliticaSenhaService,
    private readonly sessoes: SessaoService,
    private readonly tokens: TokensEmailService,
    private readonly email: EmailService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // Envio de e-mail e trabalho parecido roda em segundo plano: a resposta da API sai no mesmo tempo
  // exista a conta ou não (impede descobrir contas pelo tempo de resposta).
  private emSegundoPlano(nome: string, tarefa: () => Promise<void>): void {
    const promessa: Promise<void> = tarefa()
      .catch((erro) => this.logger.error(`Falha na tarefa em segundo plano "${nome}"`, erro as Error))
      .finally(() => this.tarefas.delete(promessa));
    this.tarefas.add(promessa);
  }

  async aguardarTarefas(): Promise<void> {
    await Promise.all([...this.tarefas]);
  }

  // ---------- cadastro e verificação de e-mail ----------

  // Sempre termina do mesmo jeito (sem revelar se o e-mail já tinha conta) e NÃO abre sessão:
  // a pessoa precisa confirmar o e-mail e entrar.
  async cadastrar(dto: CadastroDto, ctx: ContextoRequisicao): Promise<void> {
    await this.politica.validar(dto.senha, dto.email);
    const senhaHash = await this.senhas.hashear(dto.senha);

    let cliente: { id: string; nome: string } | null = null;
    try {
      cliente = await this.system.cliente.create({
        data: { nome: dto.nome, email: dto.email, senhaHash },
        select: { id: true, nome: true },
      });
    } catch (erro) {
      if (!(erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === 'P2002')) throw erro;
    }

    if (!cliente) {
      this.emSegundoPlano('cadastro_email_existente', async () => {
        await this.auditoria.registrar('cadastro_email_existente', { ip: ctx.ip });
        await this.email.enviarContaExistente(dto.email);
      });
      return;
    }

    const clienteCriado = cliente;
    this.emSegundoPlano('cadastro', async () => {
      await this.auditoria.registrar('cadastro', { clienteId: clienteCriado.id, ip: ctx.ip });
      const token = await this.tokens.criar(clienteCriado.id, 'VERIFICACAO_EMAIL');
      await this.email.enviarVerificacao(dto.email, clienteCriado.nome, token);
    });
  }

  async verificarEmail(token: string, ctx: ContextoRequisicao): Promise<void> {
    const registro = await this.tokens.validar(token, 'VERIFICACAO_EMAIL');
    if (!registro || !(await this.tokens.marcarUsado(registro.id))) {
      throw new BadRequestException(MSG_LINK_INVALIDO);
    }

    await this.system.cliente.updateMany({
      where: { id: registro.clienteId, emailVerificadoEm: null },
      data: { emailVerificadoEm: new Date() },
    });
    await this.auditoria.registrar('email_verificado', { clienteId: registro.clienteId, ip: ctx.ip });
  }

  async reenviarVerificacao(clienteId: string, ctx: ContextoRequisicao): Promise<void> {
    const cliente = await this.system.cliente.findUniqueOrThrow({
      where: { id: clienteId },
      select: { nome: true, email: true, emailVerificadoEm: true },
    });
    if (cliente.emailVerificadoEm) return;

    if ((await this.tokens.contarRecentes(clienteId, 'VERIFICACAO_EMAIL')) >= MAX_EMAILS_POR_HORA) {
      throw new HttpException(
        'Você já pediu vários e-mails de confirmação. Aguarde um pouco e verifique sua caixa de spam.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const token = await this.tokens.criar(clienteId, 'VERIFICACAO_EMAIL');
    await this.auditoria.registrar('verificacao_reenviada', { clienteId, ip: ctx.ip });
    this.emSegundoPlano('reenviar_verificacao', () =>
      this.email.enviarVerificacao(cliente.email, cliente.nome, token),
    );
  }

  // ---------- login / logout ----------

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
      throw new HttpException(MSG_MUITAS_TENTATIVAS, HttpStatus.TOO_MANY_REQUESTS);
    }

    const senhaCorreta = await this.senhas.verificar(cliente.senhaHash, dto.senha);
    if (!senhaCorreta) {
      await this.registrarFalha(cliente.id, ctx, 'senha_incorreta');
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
        select: { id: true, nome: true, email: true, criadoEm: true, emailVerificadoEm: true },
      });
      const vinculo = await tx.vinculoTelegram.findUnique({
        where: { clienteId },
        select: { vinculadoEm: true },
      });
      const { emailVerificadoEm, ...publico } = cliente;
      return { cliente: publico, emailVerificado: emailVerificadoEm !== null, telegramConectado: vinculo !== null };
    });
  }

  // ---------- recuperação e troca de senha ----------

  // Resposta idêntica exista a conta ou não; tudo o que depende disso acontece em segundo plano.
  esqueciSenha(email: string, ctx: ContextoRequisicao): void {
    this.emSegundoPlano('esqueci_senha', async () => {
      const cliente = await this.system.cliente.findUnique({
        where: { email },
        select: { id: true, nome: true, status: true },
      });

      if (!cliente || cliente.status !== 'ATIVO') {
        await this.auditoria.registrar('recuperacao_email_desconhecido', { ip: ctx.ip });
        return;
      }

      if ((await this.tokens.contarRecentes(cliente.id, 'RECUPERACAO_SENHA')) >= MAX_EMAILS_POR_HORA) {
        await this.auditoria.registrar('recuperacao_limitada', { clienteId: cliente.id, ip: ctx.ip });
        return;
      }

      const token = await this.tokens.criar(cliente.id, 'RECUPERACAO_SENHA');
      await this.auditoria.registrar('recuperacao_solicitada', { clienteId: cliente.id, ip: ctx.ip });
      await this.email.enviarRecuperacao(email, cliente.nome, token);
    });
  }

  async redefinirSenha(dto: RedefinirSenhaDto, ctx: ContextoRequisicao): Promise<void> {
    const registro = await this.tokens.validar(dto.token, 'RECUPERACAO_SENHA');
    if (!registro) throw new BadRequestException(MSG_LINK_INVALIDO);

    const cliente = await this.system.cliente.findUniqueOrThrow({
      where: { id: registro.clienteId },
      select: { id: true, nome: true, email: true },
    });

    // Se a senha nova for recusada, o link continua valendo: a pessoa pode tentar outra.
    await this.politica.validar(dto.novaSenha, cliente.email);
    if (!(await this.tokens.marcarUsado(registro.id))) throw new BadRequestException(MSG_LINK_INVALIDO);

    const senhaHash = await this.senhas.hashear(dto.novaSenha);
    const agora = new Date();
    await this.system.$transaction([
      this.system.cliente.update({
        where: { id: cliente.id },
        data: { senhaHash, bloqueadoAte: null },
        select: { id: true },
      }),
      // Quem recebeu o link no e-mail comprovou que controla o endereço.
      this.system.cliente.updateMany({
        where: { id: cliente.id, emailVerificadoEm: null },
        data: { emailVerificadoEm: agora },
      }),
      // Toda sessão aberta cai: se a conta foi invadida, o invasor perde o acesso.
      this.system.sessao.updateMany({
        where: { clienteId: cliente.id, revogadaEm: null },
        data: { revogadaEm: agora },
      }),
    ]);

    await this.auditoria.registrar('senha_redefinida', { clienteId: cliente.id, ip: ctx.ip });
    this.emSegundoPlano('aviso_senha_redefinida', () => this.email.enviarSenhaAlterada(cliente.email, cliente.nome));
  }

  async alterarSenha(clienteId: string, sessaoAtualId: string, dto: AlterarSenhaDto, ctx: ContextoRequisicao) {
    const cliente = await this.system.cliente.findUniqueOrThrow({
      where: { id: clienteId },
      select: { nome: true, email: true, senhaHash: true, bloqueadoAte: true },
    });

    if (cliente.bloqueadoAte && cliente.bloqueadoAte.getTime() > Date.now()) {
      throw new HttpException(MSG_MUITAS_TENTATIVAS, HttpStatus.TOO_MANY_REQUESTS);
    }

    // Quem tem uma sessão roubada não consegue descobrir a senha atual por tentativa e erro:
    // as falhas aqui contam para o bloqueio da conta.
    if (!(await this.senhas.verificar(cliente.senhaHash, dto.senhaAtual))) {
      await this.registrarFalha(clienteId, ctx, 'alterar_senha');
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    if (dto.novaSenha === dto.senhaAtual) {
      throw new BadRequestException('A nova senha precisa ser diferente da atual.');
    }
    await this.politica.validar(dto.novaSenha, cliente.email);

    const senhaHash = await this.senhas.hashear(dto.novaSenha);
    await this.system.$transaction([
      this.system.cliente.update({ where: { id: clienteId }, data: { senhaHash }, select: { id: true } }),
      this.system.sessao.updateMany({
        where: { clienteId, revogadaEm: null, id: { not: sessaoAtualId } },
        data: { revogadaEm: new Date() },
      }),
    ]);

    await this.auditoria.registrar('senha_alterada', { clienteId, ip: ctx.ip });
    this.emSegundoPlano('aviso_senha_alterada', () => this.email.enviarSenhaAlterada(cliente.email, cliente.nome));
  }

  // ---------- gerenciamento de sessões (dispositivos conectados) ----------

  listarSessoes(clienteId: string, sessaoAtualId: string) {
    return this.tenant.comTenant(clienteId, async (tx) => {
      const sessoes = await tx.sessao.findMany({
        where: { revogadaEm: null, expiraEm: { gt: new Date() } },
        orderBy: { ultimoUsoEm: 'desc' },
        select: { id: true, criadoEm: true, ultimoUsoEm: true, userAgent: true },
      });
      return sessoes.map((s) => ({ ...s, atual: s.id === sessaoAtualId }));
    });
  }

  async encerrarSessao(clienteId: string, sessaoId: string, ctx: ContextoRequisicao): Promise<void> {
    const { count } = await this.tenant.comTenant(clienteId, (tx) =>
      tx.sessao.updateMany({
        where: { id: sessaoId, revogadaEm: null },
        data: { revogadaEm: new Date() },
      }),
    );
    if (count === 0) throw new NotFoundException('Sessão não encontrada.');
    await this.auditoria.registrar('sessao_encerrada', { clienteId, ip: ctx.ip });
  }

  async encerrarOutrasSessoes(clienteId: string, sessaoAtualId: string, ctx: ContextoRequisicao): Promise<void> {
    await this.tenant.comTenant(clienteId, (tx) =>
      tx.sessao.updateMany({
        where: { revogadaEm: null, id: { not: sessaoAtualId } },
        data: { revogadaEm: new Date() },
      }),
    );
    await this.auditoria.registrar('sessoes_encerradas', { clienteId, ip: ctx.ip });
  }

  // O bloqueio conta as falhas dos últimos 15 minutos, desconsiderando as anteriores ao último login bem-sucedido.
  private async registrarFalha(clienteId: string, ctx: ContextoRequisicao, motivo: string) {
    await this.auditoria.registrar('login_falha', { clienteId, ip: ctx.ip, detalhes: { motivo } });

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
