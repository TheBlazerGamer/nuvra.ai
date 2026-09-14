import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { FuncionarioAuthGuard } from '../auth/funcionario-auth.guard.js';
import { CurrentFuncionario } from '../auth/current-funcionario.decorator.js';
import { CampanhasService } from '../campanhas/campanhas.service.js';

@Controller('admin/campanhas')
@UseGuards(FuncionarioAuthGuard)
export class AdminCampanhasController {
  constructor(private readonly campanhasService: CampanhasService) {}

  @Post(':campanhaId/aprovar-checagem')
  aprovarChecagem(
    @Param('campanhaId') campanhaId: string,
    @CurrentFuncionario() funcionario: { email: string },
  ) {
    return this.campanhasService.aprovarChecagemManual(campanhaId, funcionario.email);
  }
}
