import { IsOptional, Matches } from 'class-validator';

// Só IDs: os nomes e a validade de cada escolha são conferidos no servidor, direto na Meta.
export class SelecionarAtivosDto {
  @Matches(/^act_\d+$/, { message: 'Conta de anúncio inválida.' })
  contaAnuncioId: string;

  @IsOptional()
  @Matches(/^\d+$/, { message: 'Página inválida.' })
  paginaId?: string;
}
