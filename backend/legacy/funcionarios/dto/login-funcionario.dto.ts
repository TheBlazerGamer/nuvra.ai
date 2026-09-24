import { IsEmail, IsString } from 'class-validator';

export class LoginFuncionarioDto {
  @IsEmail()
  email: string;

  @IsString()
  senha: string;
}
