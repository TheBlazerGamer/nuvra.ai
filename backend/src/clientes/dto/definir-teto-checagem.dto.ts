import { IsInt, IsPositive } from 'class-validator';

export class DefinirTetoChecagemDto {
  @IsInt()
  @IsPositive()
  tetoCentavos: number;
}
