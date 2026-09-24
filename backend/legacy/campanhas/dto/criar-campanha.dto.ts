import { IsEnum, IsInt, IsObject, IsOptional, IsPositive, IsString } from 'class-validator';
import { DestinoConversa, ObjetivoCampanha } from '@prisma/client';

export class CriarCampanhaDto {
  @IsString()
  criativoId: string;

  @IsEnum(ObjetivoCampanha)
  objetivo: ObjetivoCampanha;

  @IsInt()
  @IsPositive()
  valorInvestidoCentavos: number;

  @IsObject()
  publicoAlvo: Record<string, unknown>;

  @IsOptional()
  @IsEnum(DestinoConversa)
  destinoConversa?: DestinoConversa;
}
