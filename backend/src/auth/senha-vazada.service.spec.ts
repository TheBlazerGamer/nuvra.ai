import { createHash } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { SenhaVazadaService } from './senha-vazada.service.js';

const SENHA = 'segredo-unico-do-teste';
const SHA1 = createHash('sha1').update(SENHA).digest('hex').toUpperCase();
const PREFIXO = SHA1.slice(0, 5);
const SUFIXO = SHA1.slice(5);

const config = (valor?: string) => ({ get: () => valor }) as unknown as ConfigService;

const resposta = (corpo: string, ok = true) => ({ ok, text: async () => corpo }) as unknown as Response;

describe('SenhaVazadaService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('envia só os 5 primeiros caracteres do hash (a senha nunca sai daqui)', async () => {
    const fetchFalso = vi.fn(async () => resposta(`${SUFIXO}:3861493\nAAAAA0000000000000000000000000000AA:2`));
    vi.stubGlobal('fetch', fetchFalso);

    expect(await new SenhaVazadaService(config()).estaVazada(SENHA)).toBe(true);

    const url = String((fetchFalso.mock.calls[0] as unknown[])[0]);
    expect(url.endsWith(`/range/${PREFIXO}`)).toBe(true);
    expect(url).not.toContain(SUFIXO);
    expect(url).not.toContain(SENHA);
  });

  it('senha que não aparece na lista não é considerada vazada', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta('AAAAA0000000000000000000000000000AA:2')));
    expect(await new SenhaVazadaService(config()).estaVazada(SENHA)).toBe(false);
  });

  it('ignora as linhas de preenchimento (contagem 0) usadas pelo serviço para esconder o padrão', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta(`${SUFIXO}:0`)));
    expect(await new SenhaVazadaService(config()).estaVazada(SENHA)).toBe(false);
  });

  it('se o serviço estiver fora do ar ou lento, o cadastro segue (não derruba o login)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('rede fora'); }));
    expect(await new SenhaVazadaService(config()).estaVazada(SENHA)).toBe(false);

    vi.stubGlobal('fetch', vi.fn(async () => resposta('erro', false)));
    expect(await new SenhaVazadaService(config()).estaVazada(SENHA)).toBe(false);
  });

  it('desligado por configuração, nem consulta a rede', async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);
    expect(await new SenhaVazadaService(config('desligado')).estaVazada(SENHA)).toBe(false);
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
