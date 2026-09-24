import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { NomePlano } from '@prisma/client';

export class RegisterDto {
  @IsString()
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  senha: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsEnum(NomePlano)
  plano: NomePlano;
}
