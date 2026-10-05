import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { MetaSignedRequestService } from './meta-signed-request.service.js';

const SEGREDO = 'segredo-do-app-de-teste';
const servico = (segredo = SEGREDO) =>
  new MetaSignedRequestService({ getOrThrow: () => segredo } as unknown as ConfigService);

const assinar = (dados: object, segredo = SEGREDO) => {
  const dadosB64 = Buffer.from(JSON.stringify(dados)).toString('base64url');
  const assinatura = createHmac('sha256', segredo).update(dadosB64).digest('base64url');
  return `${assinatura}.${dadosB64}`;
};

describe('MetaSignedRequestService', () => {
  it('aceita uma assinatura válida e devolve o id do usuário', () => {
    const pedido = assinar({ algorithm: 'HMAC-SHA256', user_id: '12345', issued_at: 1 });
    expect(servico().verificar(pedido)).toEqual({ userId: '12345' });
  });

  it('recusa quando foi assinado com outro segredo', () => {
    const pedido = assinar({ algorithm: 'HMAC-SHA256', user_id: '12345' }, 'segredo-de-um-atacante');
    expect(servico().verificar(pedido)).toBeNull();
  });

  it('recusa quando os dados foram trocados depois de assinar (ex.: outro user_id)', () => {
    const [assinatura] = assinar({ algorithm: 'HMAC-SHA256', user_id: '12345' }).split('.');
    const adulterado = Buffer.from(JSON.stringify({ algorithm: 'HMAC-SHA256', user_id: '99999' })).toString('base64url');
    expect(servico().verificar(`${assinatura}.${adulterado}`)).toBeNull();
  });

  it('recusa algoritmo diferente de HMAC-SHA256, mesmo com assinatura correta', () => {
    expect(servico().verificar(assinar({ algorithm: 'none', user_id: '12345' }))).toBeNull();
  });

  it('recusa formatos inválidos sem estourar', () => {
    for (const lixo of [undefined, null, 42, '', 'sem-ponto', 'a.b.c', '.', 'a.', '.b', { x: 1 }, 'x'.repeat(5000)]) {
      expect(servico().verificar(lixo)).toBeNull();
    }
  });

  it('recusa user_id ausente, vazio ou que não seja texto', () => {
    expect(servico().verificar(assinar({ algorithm: 'HMAC-SHA256' }))).toBeNull();
    expect(servico().verificar(assinar({ algorithm: 'HMAC-SHA256', user_id: '' }))).toBeNull();
    expect(servico().verificar(assinar({ algorithm: 'HMAC-SHA256', user_id: 123 }))).toBeNull();
  });
});
