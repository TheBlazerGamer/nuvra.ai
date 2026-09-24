import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { SENHA_MAX, SENHA_MIN } from '../senha.service.js';

const texto = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emailNormalizado = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CadastroDto {
  @Transform(texto)
  @IsString({ message: 'Informe seu nome.' })
  @MinLength(2, { message: 'Informe seu nome.' })
  @MaxLength(120, { message: 'O nome é muito longo.' })
  nome: string;

  @Transform(emailNormalizado)
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  @MaxLength(254, { message: 'O e-mail é muito longo.' })
  email: string;

  @IsString({ message: 'Informe uma senha.' })
  @MinLength(SENHA_MIN, { message: `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.` })
  @MaxLength(SENHA_MAX, { message: `A senha pode ter no máximo ${SENHA_MAX} caracteres.` })
  senha: string;
}
