import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SelecionarAtivosDto {
  @IsString()
  @MaxLength(100)
  contaAnuncioId: string;

  @IsString()
  @MaxLength(200)
  contaAnuncioNome: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  paginaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  paginaNome?: string;
}
