import { IsString } from 'class-validator';

export class VincularContaMetaDto {
  @IsString()
  metaBusinessManagerId: string;

  @IsString()
  metaContaAnuncioId: string;

  @IsString()
  metaPaginaId: string;
}
