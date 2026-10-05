import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MetaConexaoService } from './meta-conexao.service.js';
import { MetaCriptografiaService } from './meta-criptografia.service.js';
import { MetaGraphService } from './meta-graph.service.js';
import { MetaOAuthEstadoService } from './meta-oauth-estado.service.js';
import { MetaSignedRequestService } from './meta-signed-request.service.js';
import { MetaWebhookController } from './meta-webhook.controller.js';
import { MetaController } from './meta.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [MetaController, MetaWebhookController],
  providers: [
    MetaOAuthEstadoService,
    MetaConexaoService,
    MetaCriptografiaService,
    MetaGraphService,
    MetaSignedRequestService,
  ],
})
export class MetaModule {}
