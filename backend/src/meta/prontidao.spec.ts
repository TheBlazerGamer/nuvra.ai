import { avaliarProntidao, LINKS, type Entrada, type IdEtapa } from './prontidao.js';

const AGORA = new Date('2026-10-10T12:00:00Z');
const emDias = (n: number) => new Date(AGORA.getTime() + n * 86_400_000);

const base: Entrada = {
  emailVerificado: true,
  telegramConectado: true,
  temContaAnuncio: null,
  confirmacoes: [],
  conexao: null,
  agora: AGORA,
};

const conexaoCompleta = {
  contaAnuncioId: 'act_123',
  contaAnuncioNome: 'CA | Minha Loja',
  paginaId: '555',
  paginaNome: 'Minha Loja',
  expiraEm: emDias(50),
};

// Tudo certo na Meta: serve de ponto de partida para cada cenário "falta só X".
const tudoPronto: Entrada = {
  ...base,
  temContaAnuncio: 'SIM',
  conexao: conexaoCompleta,
  detalhesConta: { accountStatus: 1, disableReason: null, temFormaDePagamento: true },
  instagram: [{ usuario: 'minhaloja' }],
};

const estado = (e: Entrada, id: IdEtapa) => avaliarProntidao(e).etapas.find((x) => x.id === id)?.estado;
const ordem = (e: Entrada) => avaliarProntidao(e).etapas.map((x) => x.id);

describe('avaliarProntidao: ordem conforme a situação da pessoa', () => {
  it('quem NÃO tem conta de anúncio prepara tudo antes de conectar: Página, conta, pagamento, Instagram', () => {
    const e: Entrada = { ...base, temContaAnuncio: 'NAO' };
    expect(ordem(e).slice(0, 6)).toEqual(['email', 'pagina', 'conta_anuncio', 'pagamento', 'instagram', 'meta']);
    expect(avaliarProntidao(e).proxima).toBe('pagina');
  });

  it('o "já fiz" avança passo a passo: Página → conta de anúncio → pagamento → Instagram → conectar', () => {
    const sem = { ...base, temContaAnuncio: 'NAO' } as Entrada;
    const proxima = (confirmacoes: string[]) => avaliarProntidao({ ...sem, confirmacoes }).proxima;

    expect(proxima([])).toBe('pagina');
    expect(proxima(['pagina'])).toBe('conta_anuncio');
    expect(proxima(['pagina', 'conta_anuncio'])).toBe('pagamento'); // criou a conta, vai direto para o pagamento
    expect(proxima(['pagina', 'conta_anuncio', 'pagamento'])).toBe('instagram');
    expect(proxima(['pagina', 'conta_anuncio', 'pagamento', 'instagram'])).toBe('meta');
  });

  it('quem já tem conta (ou não sabe) conecta primeiro; o resto só é conferido depois', () => {
    for (const resposta of ['SIM', 'NAO_SEI', null] as const) {
      const r = avaliarProntidao({ ...base, temContaAnuncio: resposta });
      expect(r.proxima).toBe('meta');
      for (const id of ['pagina', 'conta_anuncio', 'pagamento', 'instagram', 'conta_ativa'] as const) {
        expect(r.etapas.find((x) => x.id === id)?.estado).toBe('aguardando');
      }
    }
  });

  it('e-mail não confirmado vem primeiro e segura a conexão', () => {
    const r = avaliarProntidao({ ...base, emailVerificado: false, temContaAnuncio: 'SIM' });
    expect(r.proxima).toBe('email');
    expect(r.etapas.find((x) => x.id === 'meta')?.estado).toBe('aguardando');
    expect(r.etapas.find((x) => x.id === 'email')?.acoes[0].tipo).toBe('reenviar_email');
  });
});

describe('avaliarProntidao: já conectada, o app confere sozinho', () => {
  it('tudo pronto: pode anunciar, sem próxima pendência', () => {
    const r = avaliarProntidao(tudoPronto);
    expect(r.prontoParaAnunciar).toBe(true);
    expect(r.proxima).toBeNull();
    expect(r.etapas.find((x) => x.id === 'instagram')?.descricao).toContain('@minhaloja');
  });

  it('só falta a forma de pagamento: mostra direto o pagamento, com o link da conta certa', () => {
    const r = avaliarProntidao({
      ...tudoPronto,
      detalhesConta: { accountStatus: 1, disableReason: null, temFormaDePagamento: false },
    });
    expect(r.proxima).toBe('pagamento');
    expect(r.prontoParaAnunciar).toBe(false);
    const etapa = r.etapas.find((x) => x.id === 'pagamento');
    expect(etapa?.acoes).toEqual([
      { tipo: 'link', rotulo: 'Adicionar forma de pagamento', url: 'https://business.facebook.com/billing_hub/payment_settings?asset_id=123' },
    ]);
    expect(etapa?.confirmar).toEqual([{ id: 'pagamento', rotulo: 'Já adicionei' }]);
  });

  it('sem Instagram vinculado, anuncia com a identidade da Página e NÃO bloqueia', () => {
    const r = avaliarProntidao({ ...tudoPronto, instagram: [] });
    const ig = r.etapas.find((x) => x.id === 'instagram');
    expect(ig?.estado).toBe('atencao');
    expect(ig?.descricao).toContain('nome e a foto da Página');
    expect(r.prontoParaAnunciar).toBe(true);
    expect(r.proxima).toBeNull();
  });

  it('não conseguir conferir o Instagram é diferente de não ter: pede confirmação e bloqueia o "pronto"', () => {
    const r = avaliarProntidao({ ...tudoPronto, instagram: null });
    const ig = r.etapas.find((x) => x.id === 'instagram');
    expect(ig?.estado).toBe('desconhecido');
    expect(ig?.confirmar.map((c) => c.id)).toEqual(['instagram', 'instagram_pagina']);
    expect(r.prontoParaAnunciar).toBe(false);
  });

  it('falha ao listar contas ou Páginas vira "não consegui conferir", nunca "você não tem"', () => {
    const semConta = { ...tudoPronto, conexao: { ...conexaoCompleta, contaAnuncioId: null, contaAnuncioNome: null, paginaId: null, paginaNome: null } };
    expect(estado({ ...semConta, contasDisponiveis: null }, 'conta_anuncio')).toBe('desconhecido');
    expect(estado({ ...semConta, contasDisponiveis: 0 }, 'conta_anuncio')).toBe('pendente');

    const semPagina = { ...tudoPronto, conexao: { ...conexaoCompleta, paginaId: null, paginaNome: null } };
    expect(estado({ ...semPagina, paginasDisponiveis: null }, 'pagina')).toBe('desconhecido');
    expect(estado({ ...semPagina, paginasDisponiveis: 0 }, 'pagina')).toBe('pendente');
    const comPaginas = avaliarProntidao({ ...semPagina, paginasDisponiveis: 3 }).etapas.find((x) => x.id === 'pagina');
    expect(comPaginas?.acoes[0].tipo).toBe('escolher');
  });

  it('sem Página disponível, oferece criar a Página e reconectar', () => {
    const r = avaliarProntidao({
      ...tudoPronto,
      conexao: { ...conexaoCompleta, paginaId: null, paginaNome: null },
      paginasDisponiveis: 0,
    });
    const pagina = r.etapas.find((x) => x.id === 'pagina');
    expect(pagina?.acoes.map((a) => a.tipo)).toEqual(['link', 'conectar']);
    expect(r.proxima).toBe('pagina');
  });

  it('a Página e o pagamento esperam a escolha da conta de anúncio', () => {
    const r = avaliarProntidao({
      ...tudoPronto,
      conexao: { ...conexaoCompleta, contaAnuncioId: null, contaAnuncioNome: null, paginaId: null, paginaNome: null },
      contasDisponiveis: 2,
      detalhesConta: undefined,
      instagram: undefined,
    });
    expect(r.proxima).toBe('conta_anuncio');
    for (const id of ['pagina', 'pagamento', 'instagram', 'conta_ativa'] as const) {
      expect(r.etapas.find((x) => x.id === id)?.estado).toBe('aguardando');
    }
  });
});

describe('avaliarProntidao: situação da conta de anúncio na Meta', () => {
  const comStatus = (accountStatus: number, disableReason: number | null = null): Entrada => ({
    ...tudoPronto,
    detalhesConta: { accountStatus, disableReason, temFormaDePagamento: true },
  });

  it('1 = ativa', () => expect(estado(comStatus(1), 'conta_ativa')).toBe('ok'));
  it('3 e 9 = pagamento em aberto (pendente, com link para regularizar)', () => {
    for (const s of [3, 9]) {
      const r = avaliarProntidao(comStatus(s));
      expect(r.etapas.find((x) => x.id === 'conta_ativa')?.estado).toBe('pendente');
      expect(r.proxima).toBe('conta_ativa');
    }
  });
  it('7 e 8 = em análise pela Meta (esperar)', () => {
    for (const s of [7, 8]) expect(estado(comStatus(s), 'conta_ativa')).toBe('em_analise');
  });
  it('2, 100 e 101 = bloqueada, com o motivo quando conhecido', () => {
    for (const s of [2, 100, 101]) expect(estado(comStatus(s), 'conta_ativa')).toBe('bloqueado');
    const motivo = avaliarProntidao(comStatus(2, 3)).etapas.find((x) => x.id === 'conta_ativa');
    expect(motivo?.descricao).toContain('risco no pagamento');
  });
  it('status desconhecido ou consulta que falhou = "não consegui conferir"', () => {
    expect(estado(comStatus(999), 'conta_ativa')).toBe('desconhecido');
    expect(estado({ ...tudoPronto, detalhesConta: null }, 'conta_ativa')).toBe('desconhecido');
  });
});

describe('avaliarProntidao: validade da conexão e Telegram', () => {
  it('faltando mais de 7 dias, nem aparece', () => {
    expect(ordem(tudoPronto)).not.toContain('reconexao');
  });
  it('faltando 7 dias ou menos, avisa mas não bloqueia', () => {
    const r = avaliarProntidao({ ...tudoPronto, conexao: { ...conexaoCompleta, expiraEm: emDias(3) } });
    const etapa = r.etapas.find((x) => x.id === 'reconexao');
    expect(etapa?.estado).toBe('atencao');
    expect(etapa?.descricao).toContain('3 dias');
    expect(r.prontoParaAnunciar).toBe(true);
  });
  it('vencida: pendente, bloqueia e vira a próxima', () => {
    const r = avaliarProntidao({ ...tudoPronto, conexao: { ...conexaoCompleta, expiraEm: emDias(-1) } });
    expect(r.proxima).toBe('reconexao');
    expect(r.prontoParaAnunciar).toBe(false);
  });
  it('sem Telegram conectado não está pronto (a aprovação das campanhas é por lá)', () => {
    const r = avaliarProntidao({ ...tudoPronto, telegramConectado: false });
    expect(r.proxima).toBe('telegram');
    expect(r.prontoParaAnunciar).toBe(false);
  });
});

describe('avaliarProntidao: Instagram antes de conectar', () => {
  it('"anunciar com a identidade da Página" vale como atenção e não trava a fila', () => {
    const r = avaliarProntidao({
      ...base,
      temContaAnuncio: 'NAO',
      confirmacoes: ['pagina', 'conta_anuncio', 'pagamento', 'instagram_pagina'],
    });
    expect(r.etapas.find((x) => x.id === 'instagram')?.estado).toBe('atencao');
    expect(r.proxima).toBe('meta');
  });
});

describe('LINKS', () => {
  it('todos são https e o de pagamento usa o número da conta (sem o prefixo act_)', () => {
    expect(LINKS.pagamentos('act_999')).toContain('asset_id=999');
    expect(LINKS.pagamentos(null)).toMatch(/^https:\/\//);
    for (const url of [LINKS.criarPagina, LINKS.gerenciadorDeAnuncios, LINKS.instagramVinculo, LINKS.contaProfissionalInstagram]) {
      expect(url).toMatch(/^https:\/\//);
    }
  });
});
