import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuditoriaService } from '../auth/auditoria.service.js';
import { ClienteAtual } from '../auth/cliente-atual.decorator.js';
import { EmailVerificadoGuard } from '../auth/email-verificado.guard.js';
import { SessaoGuard } from '../auth/sessao.guard.js';
import { SelecionarAtivosDto } from './dto/selecionar-ativos.dto.js';
import { MetaAtivosService } from './meta-ativos.service.js';
import { MetaConexaoService } from './meta-conexao.service.js';
import { MetaGraphService, type AtivoMeta } from './meta-graph.service.js';
import { MetaOAuthEstadoService } from './meta-oauth-estado.service.js';

const ESCOPO_PADRAO = 'ads_management,ads_read,pages_show_list,pages_read_engagement';

@Controller('meta')
export class MetaController {
  private readonly logger = new Logger(MetaController.name);

  constructor(
    private readonly estados: MetaOAuthEstadoService,
    private readonly conexoes: MetaConexaoService,
    private readonly graph: MetaGraphService,
    private readonly regras: MetaAtivosService,
    private readonly config: ConfigService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private redirectUri(): string {
    return `${this.config.getOrThrow<string>('API_ORIGIN')}/meta/callback`;
  }

  private async tokenOuErro(clienteId: string): Promise<string> {
    const token = await this.conexoes.obterTokenDecifrado(clienteId);
    if (!token) throw new NotFoundException('Conecte sua conta da Meta primeiro.');
    return token;
  }

  @Get('conectar')
  @UseGuards(SessaoGuard, EmailVerificadoGuard)
  async conectar(@ClienteAtual() clienteId: string, @Res() res: Response) {
    const estado = await this.estados.criar(clienteId);

    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('META_APP_ID'),
      redirect_uri: this.redirectUri(),
      state: estado,
      response_type: 'code',
    });
    const configId = this.config.get<string>('META_LOGIN_CONFIG_ID');
    if (configId) params.set('config_id', configId);
    else params.set('scope', ESCOPO_PADRAO);

    res.redirect(`https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`);
  }

  // A Meta manda o cliente de volta pra cá (navegação do navegador, não chamada nossa) — por isso
  // resolvemos QUEM é pelo "state", nunca por um cookie de sessão que pode nem estar presente.
  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response) {
    const webOrigin = this.config.getOrThrow<string>('WEB_ORIGIN').replace(/\/$/, '');
    const erroMeta = req.query.error_message ?? req.query.error;
    if (erroMeta) {
      res.redirect(`${webOrigin}/conta?meta=erro`);
      return;
    }

    const estado = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const registro = estado ? await this.estados.validar(estado) : null;

    if (!registro || !code || !(await this.estados.marcarUsado(registro.id))) {
      res.redirect(`${webOrigin}/conta?meta=erro`);
      return;
    }

    const { clienteId } = registro;
    try {
      const curto = await this.graph.trocarCodigoPorToken(code, this.redirectUri());
      const longo = await this.graph.paraTokenDeLongaDuracao(curto.accessToken);
      const usuario = await this.graph.obterUsuario(longo.accessToken);
      await this.conexoes.salvar(clienteId, 'USUARIO', longo, usuario.id);

      // Se só há uma conta liberada, já a escolhe. A Página só é escolhida sozinha quando também é única:
      // com várias, adivinhar poderia anunciar pela Página errada.
      const contas = await this.regras.contasDoCliente(longo.accessToken);
      if (contas.length === 1) {
        const paginas = await this.regras.paginasDaConta(longo.accessToken, contas[0].id).catch(() => [] as AtivoMeta[]);
        await this.conexoes.definirAtivos(clienteId, contas[0], paginas.length === 1 ? paginas[0] : null);
      }

      await this.auditoria.registrar('meta_conectado', { clienteId, detalhes: { contas: contas.length } });
      res.redirect(`${webOrigin}/conta?meta=conectado`);
    } catch (erro) {
      this.logger.error('Falha ao concluir a conexão com a Meta', erro as Error);
      await this.auditoria.registrar('meta_erro_callback', { clienteId });
      res.redirect(`${webOrigin}/conta?meta=erro`);
    }
  }

  @Get('status')
  @UseGuards(SessaoGuard)
  status(@ClienteAtual() clienteId: string) {
    return this.conexoes.status(clienteId);
  }

  @Get('ativos')
  @UseGuards(SessaoGuard, EmailVerificadoGuard)
  async ativos(@ClienteAtual() clienteId: string) {
    return { contas: await this.regras.contasDoCliente(await this.tokenOuErro(clienteId)) };
  }

  // As Páginas dependem da conta escolhida (cada conta de anúncio pode anunciar por Páginas diferentes).
  @Get('paginas')
  @UseGuards(SessaoGuard, EmailVerificadoGuard)
  async paginas(@ClienteAtual() clienteId: string, @Query('conta') conta: string) {
    const token = await this.tokenOuErro(clienteId);
    if (!(await this.regras.contasDoCliente(token)).some((c) => c.id === conta)) {
      throw new BadRequestException('Conta de anúncio inválida.');
    }
    return { paginas: await this.regras.paginasDaConta(token, conta) };
  }

  // O navegador manda só os IDs; nomes e validade vêm da Meta (o cliente não consegue gravar uma conta ou Página
  // que a Meta não liberou para ele).
  @Post('selecionar')
  @HttpCode(204)
  @UseGuards(SessaoGuard, EmailVerificadoGuard)
  async selecionar(@ClienteAtual() clienteId: string, @Body() dto: SelecionarAtivosDto): Promise<void> {
    const token = await this.tokenOuErro(clienteId);

    const conta = (await this.regras.contasDoCliente(token)).find((c) => c.id === dto.contaAnuncioId);
    if (!conta) throw new BadRequestException('Conta de anúncio inválida.');

    let pagina: AtivoMeta | null = null;
    if (dto.paginaId) {
      pagina = (await this.regras.paginasDaConta(token, conta.id)).find((p) => p.id === dto.paginaId) ?? null;
      if (!pagina) throw new BadRequestException('Página inválida para esta conta de anúncio.');
    }

    await this.conexoes.definirAtivos(clienteId, conta, pagina);
    await this.auditoria.registrar('meta_ativos_selecionados', { clienteId });
  }

  @Delete('conexao')
  @HttpCode(204)
  @UseGuards(SessaoGuard)
  async desconectar(@ClienteAtual() clienteId: string): Promise<void> {
    const removeu = await this.conexoes.desconectar(clienteId);
    if (removeu) await this.auditoria.registrar('meta_desconectado', { clienteId });
  }
}
