import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { MetaCriptografiaService } from './meta-criptografia.service.js';

const chave = () => randomBytes(32).toString('base64');
const servico = (chaveBase64: string) =>
  new MetaCriptografiaService({ getOrThrow: () => chaveBase64 } as unknown as ConfigService);

describe('MetaCriptografiaService', () => {
  it('cifra e decifra de volta ao texto original', () => {
    const svc = servico(chave());
    const original = 'EAAG...token-de-acesso-da-meta...xyz';
    const cifrado = svc.cifrar(original);

    expect(cifrado).not.toBe(original);
    expect(svc.decifrar(cifrado)).toBe(original);
  });

  it('cada chamada gera um resultado diferente (IV aleatório) mesmo para o mesmo texto', () => {
    const svc = servico(chave());
    const a = svc.cifrar('mesmo-texto');
    const b = svc.cifrar('mesmo-texto');
    expect(a).not.toBe(b);
  });

  it('recusa decifrar com a chave errada (autenticidade do GCM)', () => {
    const cifrado = servico(chave()).cifrar('segredo');
    expect(() => servico(chave()).decifrar(cifrado)).toThrow();
  });

  it('recusa decifrar um valor adulterado', () => {
    const svc = servico(chave());
    const cifrado = svc.cifrar('segredo');
    const bytes = Buffer.from(cifrado, 'base64');
    bytes[bytes.length - 1] ^= 0xff;
    expect(() => svc.decifrar(bytes.toString('base64'))).toThrow();
  });

  it('recusa uma chave que não tenha exatamente 32 bytes', () => {
    expect(() => servico(Buffer.from('curta-demais').toString('base64'))).toThrow(/32 bytes/);
  });
});
