import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MetaConexaoService } from './meta-conexao.service.js';
import { MetaCriptografiaService } from './meta-criptografia.service.js';
import { MetaGraphService } from './meta-graph.service.js';
import { MetaOAuthEstadoService } from './meta-oauth-estado.service.js';
import { MetaController } from './meta.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [MetaController],
  providers: [MetaOAuthEstadoService, MetaConexaoService, MetaCriptografiaService, MetaGraphService],
})
export class MetaModule {}
