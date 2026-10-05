import { BadRequestException, Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { AuditoriaService } from '../auth/auditoria.service.js';
import { PermitirSemOrigem } from '../auth/origem.guard.js';
import { MetaConexaoService } from './meta-conexao.service.js';
import { MetaSignedRequestService } from './meta-signed-request.service.js';

// Avisos que a PRÓPRIA Meta nos manda (servidor para servidor, sem cookie nem Origin). A autenticação é a
// assinatura do "signed_request"; sem ela válida, nada acontece. O endereço de cada um é cadastrado no painel
// do app da Meta (Configurações do app → Básico, e Login do Facebook para Empresas → Configurações).
@Controller('meta')
export class MetaWebhookController {
  constructor(
    private readonly assinaturas: MetaSignedRequestService,
    private readonly conexoes: MetaConexaoService,
    private readonly auditoria: AuditoriaService,
    private readonly config: ConfigService,
  ) {}

  private usuarioDe(signedRequest: unknown): string {
    const dados = this.assinaturas.verificar(signedRequest);
    if (!dados) throw new BadRequestException('Pedido inválido.');
    return dados.userId;
  }

  // O cliente removeu o app nas configurações do Facebook dele: o token deixa de valer, então o apagamos.
  @Post('desautorizacao')
  @HttpCode(200)
  @PermitirSemOrigem()
  async desautorizacao(@Body('signed_request') signedRequest: unknown): Promise<Record<string, never>> {
    const afetados = await this.conexoes.removerPorUsuarioMeta(this.usuarioDe(signedRequest));
    for (const clienteId of afetados) await this.auditoria.registrar('meta_desautorizado', { clienteId });
    return {};
  }

  // A Meta exige esta resposta: uma URL onde a pessoa acompanha o pedido e um código de confirmação.
  // Usuário desconhecido também recebe a resposta normal (não revelamos quem é ou não é cliente).
  @Post('exclusao-dados')
  @HttpCode(200)
  @PermitirSemOrigem()
  async exclusaoDeDados(@Body('signed_request') signedRequest: unknown) {
    const afetados = await this.conexoes.removerPorUsuarioMeta(this.usuarioDe(signedRequest));
    const codigo = randomBytes(12).toString('hex');
    for (const clienteId of afetados) {
      await this.auditoria.registrar('meta_exclusao_solicitada', { clienteId, detalhes: { codigo } });
    }

    const web = this.config.getOrThrow<string>('WEB_ORIGIN').replace(/\/$/, '');
    return { url: `${web}/exclusao-de-dados?codigo=${codigo}`, confirmation_code: codigo };
  }
}
