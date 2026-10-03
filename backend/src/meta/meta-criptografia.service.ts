import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_IV = 12;

// Token de acesso da Meta cifrado em repouso: um vazamento do banco sozinho não expõe a conta de
// anúncio do cliente. A chave nunca fica no banco, só em META_TOKEN_ENCRYPTION_KEY (32 bytes, base64).
@Injectable()
export class MetaCriptografiaService {
  private readonly chave: Buffer;

  constructor(config: ConfigService) {
    const chaveBase64 = config.getOrThrow<string>('META_TOKEN_ENCRYPTION_KEY');
    const chave = Buffer.from(chaveBase64, 'base64');
    if (chave.length !== 32) {
      throw new Error('META_TOKEN_ENCRYPTION_KEY deve ser uma chave de 32 bytes em base64.');
    }
    this.chave = chave;
  }

  cifrar(texto: string): string {
    const iv = randomBytes(TAMANHO_IV);
    const cifra = createCipheriv(ALGORITMO, this.chave, iv);
    const cifrado = Buffer.concat([cifra.update(texto, 'utf8'), cifra.final()]);
    const tag = cifra.getAuthTag();
    return Buffer.concat([iv, tag, cifrado]).toString('base64');
  }

  decifrar(valor: string): string {
    const dados = Buffer.from(valor, 'base64');
    const iv = dados.subarray(0, TAMANHO_IV);
    const tag = dados.subarray(TAMANHO_IV, TAMANHO_IV + 16);
    const cifrado = dados.subarray(TAMANHO_IV + 16);

    const decifra = createDecipheriv(ALGORITMO, this.chave, iv);
    decifra.setAuthTag(tag);
    return Buffer.concat([decifra.update(cifrado), decifra.final()]).toString('utf8');
  }
}
