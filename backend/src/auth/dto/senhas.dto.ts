import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { SENHA_MAX, SENHA_MIN } from './../senha.service.js';

const emailNormalizado = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const MSG_SENHA_NOVA = `A nova senha precisa ter entre ${SENHA_MIN} e ${SENHA_MAX} caracteres.`;

export class TokenDto {
  @IsString({ message: 'Link inválido.' })
  @MaxLength(200, { message: 'Link inválido.' })
  token: string;
}

export class EsqueciSenhaDto {
  @Transform(emailNormalizado)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(254)
  email: string;
}

export class RedefinirSenhaDto extends TokenDto {
  @IsString({ message: MSG_SENHA_NOVA })
  @MinLength(SENHA_MIN, { message: MSG_SENHA_NOVA })
  @MaxLength(SENHA_MAX, { message: MSG_SENHA_NOVA })
  novaSenha: string;
}

export class AlterarSenhaDto {
  @IsString({ message: 'Informe a senha atual.' })
  @MaxLength(SENHA_MAX)
  senhaAtual: string;

  @IsString({ message: MSG_SENHA_NOVA })
  @MinLength(SENHA_MIN, { message: MSG_SENHA_NOVA })
  @MaxLength(SENHA_MAX, { message: MSG_SENHA_NOVA })
  novaSenha: string;
}
