import type { RespostaContaAnuncio } from '@prisma/client';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { CONFIRMAVEIS, type Confirmavel } from '../prontidao.js';

export class PerguntaDto {
  @IsIn(['SIM', 'NAO', 'NAO_SEI'], { message: 'Resposta inválida.' })
  resposta: RespostaContaAnuncio;
}

export class ConfirmarEtapaDto {
  @IsIn([...CONFIRMAVEIS], { message: 'Etapa inválida.' })
  etapa: Confirmavel;

  // true = "já fiz"; false = desfazer.
  @IsOptional()
  @IsBoolean()
  feito?: boolean;
}
