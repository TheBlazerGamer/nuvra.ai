import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';

// Argon2id com os parâmetros mínimos recomendados pela OWASP (19 MiB, 2 iterações, 1 thread).
// 2 = Argon2id: o enum da biblioteca é "const enum" e não pode ser importado com isolatedModules.
const ARGON2ID = 2;
const OPCOES = { algorithm: ARGON2ID, memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const SENHA_MIN = 12;
// Teto contra abuso: hashear uma senha de 10 MB seria um ataque de negação de serviço.
export const SENHA_MAX = 128;

@Injectable()
export class SenhaService {
  private hashFalso?: Promise<string>;

  hashear(senha: string): Promise<string> {
    return hash(senha, OPCOES);
  }

  async verificar(hashArmazenado: string, senha: string): Promise<boolean> {
    try {
      return await verify(hashArmazenado, senha);
    } catch {
      return false;
    }
  }

  // Login com e-mail inexistente gasta o mesmo tempo de um login real,
  // para não permitir descobrir quais e-mails têm conta pela diferença de tempo de resposta.
  async verificarFalso(senha: string): Promise<void> {
    this.hashFalso ??= hash(randomBytes(16).toString('hex'), OPCOES);
    await this.verificar(await this.hashFalso, senha);
  }
}
