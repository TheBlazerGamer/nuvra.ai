// Lógica do assistente de preparação da conta: dado o que sabemos da pessoa e da conta dela na Meta, decide
// o estado de cada etapa e qual é a PRÓXIMA pendência, na ordem que faz sentido para aquela situação.
// Sem acesso a banco nem rede: só regras (por isso é fácil de testar com muitos cenários).

export type IdEtapa =
  | 'email'
  | 'pagina'
  | 'conta_anuncio'
  | 'pagamento'
  | 'instagram'
  | 'meta'
  | 'conta_ativa'
  | 'reconexao'
  | 'telegram';

// O que a pessoa pode informar quando ainda não dá para conferir sozinho na Meta.
// "instagram_pagina" = "vou anunciar só com a identidade da Página por enquanto".
export const CONFIRMAVEIS = ['pagina', 'conta_anuncio', 'pagamento', 'instagram', 'instagram_pagina'] as const;
export type Confirmavel = (typeof CONFIRMAVEIS)[number];

export type EstadoEtapa =
  | 'ok' // pronta
  | 'atencao' // funciona, mas dá para melhorar (não bloqueia)
  | 'pendente' // falta fazer
  | 'bloqueado' // a Meta bloqueou; precisa de ação da pessoa na Meta
  | 'em_analise' // a Meta está analisando; só esperar
  | 'aguardando' // depende de outra etapa, ou só dá para conferir depois de conectar
  | 'desconhecido'; // não conseguimos conferir agora

export type Acao =
  | { tipo: 'link'; rotulo: string; url: string }
  | { tipo: 'conectar'; rotulo: string }
  | { tipo: 'escolher'; rotulo: string }
  | { tipo: 'reenviar_email'; rotulo: string }
  | { tipo: 'telegram'; rotulo: string };

export interface Etapa {
  id: IdEtapa;
  titulo: string;
  estado: EstadoEtapa;
  descricao: string;
  obrigatoria: boolean;
  acoes: Acao[];
  // Respostas que a pessoa pode dar ("já fiz"), quando a etapa ainda não pôde ser conferida.
  confirmar: { id: Confirmavel; rotulo: string }[];
  // De onde veio o "ok": conferido na Meta ou só informado pela pessoa.
  origem: 'conferido' | 'informado' | null;
}

export interface Prontidao {
  temContaAnuncio: 'SIM' | 'NAO' | 'NAO_SEI' | null;
  conectada: boolean;
  etapas: Etapa[];
  proxima: IdEtapa | null;
  prontoParaAnunciar: boolean;
}

export interface DetalhesConta {
  accountStatus: number;
  disableReason: number | null;
  temFormaDePagamento: boolean;
}

export interface Entrada {
  emailVerificado: boolean;
  telegramConectado: boolean;
  temContaAnuncio: 'SIM' | 'NAO' | 'NAO_SEI' | null;
  confirmacoes: string[];
  conexao: {
    contaAnuncioId: string | null;
    contaAnuncioNome: string | null;
    paginaId: string | null;
    paginaNome: string | null;
    expiraEm: Date | null;
  } | null;
  agora: Date;
  // Resultados das consultas à Meta. undefined = não consultado; null = consultou e falhou.
  contasDisponiveis?: number | null;
  paginasDisponiveis?: number | null;
  detalhesConta?: DetalhesConta | null;
  instagram?: { usuario: string }[] | null;
}

// Endereços da Meta ficam todos aqui (mudam de tempos em tempos; é o único lugar a ajustar).
export const LINKS = {
  criarPagina: 'https://www.facebook.com/pages/create',
  gerenciadorDeAnuncios: 'https://adsmanager.facebook.com/',
  pagamentos: (contaId: string | null) =>
    contaId
      ? `https://business.facebook.com/billing_hub/payment_settings?asset_id=${contaId.replace(/^act_/, '')}`
      : 'https://business.facebook.com/billing_hub/accounts',
  instagramVinculo: 'https://business.facebook.com/latest/settings/instagram_account',
  contaProfissionalInstagram: 'https://help.instagram.com/502981923235522',
} as const;

const MOTIVOS_BLOQUEIO: Record<number, string> = {
  1: 'a Meta barrou a conta por política de anúncios',
  2: 'a conta está em revisão de propriedade intelectual',
  3: 'a conta foi barrada por risco no pagamento',
  4: 'a conta foi desativada por atividade suspeita',
  7: 'a conta foi encerrada de forma permanente',
};

const diasAte = (de: Date, ate: Date) => Math.floor((ate.getTime() - de.getTime()) / 86_400_000);

export function avaliarProntidao(e: Entrada): Prontidao {
  const conectada = e.conexao !== null;
  const contaId = e.conexao?.contaAnuncioId ?? null;
  const informou = (c: Confirmavel) => e.confirmacoes.includes(c);
  // Quem ainda NÃO tem conta de anúncio prepara tudo ANTES de conectar; quem já tem conecta primeiro e o app
  // confere o resto sozinho.
  const preparaAntes = e.temContaAnuncio === 'NAO' && !conectada;

  const etapa = (p: Pick<Etapa, 'id' | 'titulo' | 'estado' | 'descricao'> & Partial<Etapa>): Etapa => ({
    obrigatoria: true,
    acoes: [],
    confirmar: [],
    origem: null,
    ...p,
  });

  const conectar: Acao = { tipo: 'conectar', rotulo: 'Conectar conta de anúncio' };
  const reconectar: Acao = { tipo: 'conectar', rotulo: 'Reconectar' };

  // Etapa que, sem conexão, depende do que a pessoa informa. Para quem já tem conta, só "conferimos depois".
  const antesDeConectar = (
    id: Confirmavel & IdEtapa,
    titulo: string,
    pendente: { descricao: string; acoes: Acao[]; confirmar: Etapa['confirmar'] },
    informado: string,
  ): Etapa => {
    if (informou(id)) return etapa({ id, titulo, estado: 'ok', descricao: informado, origem: 'informado' });
    if (preparaAntes) return etapa({ id, titulo, estado: 'pendente', ...pendente });
    return etapa({ id, titulo, estado: 'aguardando', descricao: 'Conferimos depois que você conectar sua conta da Meta.' });
  };

  // ---- e-mail ----
  const email = etapa({
    id: 'email',
    titulo: 'Confirmar seu e-mail',
    estado: e.emailVerificado ? 'ok' : 'pendente',
    descricao: e.emailVerificado
      ? 'E-mail confirmado.'
      : 'Confirme seu e-mail para liberar a conexão com a Meta. Procure a mensagem na caixa de entrada (e no spam).',
    acoes: e.emailVerificado ? [] : [{ tipo: 'reenviar_email', rotulo: 'Reenviar e-mail de confirmação' }],
    origem: e.emailVerificado ? 'conferido' : null,
  });

  // ---- conexão com a Meta ----
  const meta = etapa({
    id: 'meta',
    titulo: 'Conectar sua conta da Meta',
    estado: conectada ? 'ok' : e.emailVerificado ? 'pendente' : 'aguardando',
    descricao: conectada
      ? 'Conectada. Na tela da Meta você escolheu quais contas libera.'
      : 'Você entra com o perfil que usa para anunciar e escolhe quais contas a Nuvra pode usar.',
    acoes: conectada ? [] : [conectar],
    origem: conectada ? 'conferido' : null,
  });

  // ---- conta de anúncio ----
  let contaAnuncio: Etapa;
  if (conectada && contaId) {
    contaAnuncio = etapa({
      id: 'conta_anuncio',
      titulo: 'Conta de anúncio',
      estado: 'ok',
      descricao: `Conta: ${e.conexao?.contaAnuncioNome ?? contaId}.`,
      origem: 'conferido',
    });
  } else if (conectada && e.contasDisponiveis === null) {
    contaAnuncio = etapa({
      id: 'conta_anuncio',
      titulo: 'Conta de anúncio',
      estado: 'desconhecido',
      descricao: 'Não conseguimos listar suas contas de anúncio agora. Tente de novo em instantes.',
      acoes: [{ tipo: 'escolher', rotulo: 'Escolher conta' }],
    });
  } else if (conectada && e.contasDisponiveis) {
    contaAnuncio = etapa({
      id: 'conta_anuncio',
      titulo: 'Conta de anúncio',
      estado: 'pendente',
      descricao: 'Escolha qual conta de anúncio a Nuvra deve usar.',
      acoes: [{ tipo: 'escolher', rotulo: 'Escolher conta' }],
    });
  } else if (conectada) {
    contaAnuncio = etapa({
      id: 'conta_anuncio',
      titulo: 'Conta de anúncio',
      estado: 'pendente',
      descricao:
        'Nenhuma conta de anúncio liberada. Se você acabou de criar uma, reconecte e marque a conta nova; se ainda não criou, crie no Gerenciador de Anúncios.',
      acoes: [{ tipo: 'link', rotulo: 'Criar conta de anúncio', url: LINKS.gerenciadorDeAnuncios }, reconectar],
    });
  } else {
    contaAnuncio = antesDeConectar(
      'conta_anuncio',
      'Conta de anúncio',
      {
        descricao: 'É nela que os anúncios são criados e cobrados. Crie a sua no Gerenciador de Anúncios da Meta.',
        acoes: [{ tipo: 'link', rotulo: 'Criar conta de anúncio', url: LINKS.gerenciadorDeAnuncios }],
        confirmar: [{ id: 'conta_anuncio', rotulo: 'Já criei' }],
      },
      'Você disse que já tem a conta de anúncio. Conferimos quando você conectar.',
    );
  }

  // ---- Página ----
  let pagina: Etapa;
  if (conectada && e.conexao?.paginaId) {
    pagina = etapa({
      id: 'pagina',
      titulo: 'Página do Facebook',
      estado: 'ok',
      descricao: `Página: ${e.conexao.paginaNome ?? e.conexao.paginaId}.`,
      origem: 'conferido',
    });
  } else if (conectada && !contaId) {
    pagina = etapa({
      id: 'pagina',
      titulo: 'Página do Facebook',
      estado: 'aguardando',
      descricao: 'Primeiro escolha a conta de anúncio; as Páginas disponíveis dependem dela.',
    });
  } else if (conectada && e.paginasDisponiveis === null) {
    pagina = etapa({
      id: 'pagina',
      titulo: 'Página do Facebook',
      estado: 'desconhecido',
      descricao: 'Não conseguimos listar as Páginas agora. Tente de novo em instantes.',
      acoes: [{ tipo: 'escolher', rotulo: 'Escolher Página' }],
    });
  } else if (conectada && e.paginasDisponiveis) {
    pagina = etapa({
      id: 'pagina',
      titulo: 'Página do Facebook',
      estado: 'pendente',
      descricao: 'Escolha a Página que vai aparecer nos seus anúncios: a Meta exige uma Página em todo anúncio.',
      acoes: [{ tipo: 'escolher', rotulo: 'Escolher Página' }],
    });
  } else if (conectada) {
    pagina = etapa({
      id: 'pagina',
      titulo: 'Página do Facebook',
      estado: 'pendente',
      descricao:
        'Não encontramos uma Página que possa anunciar com esta conta. Crie uma Página (leva 2 minutos) ou ligue a que você já tem a esta conta, e depois reconecte.',
      acoes: [{ tipo: 'link', rotulo: 'Criar uma Página', url: LINKS.criarPagina }, reconectar],
    });
  } else {
    pagina = antesDeConectar(
      'pagina',
      'Página do Facebook',
      {
        descricao: 'Todo anúncio sai por uma Página do Facebook. Se você ainda não tem uma, crie agora.',
        acoes: [{ tipo: 'link', rotulo: 'Criar uma Página', url: LINKS.criarPagina }],
        confirmar: [{ id: 'pagina', rotulo: 'Já criei' }],
      },
      'Você disse que já tem a Página. Conferimos quando você conectar.',
    );
  }

  // ---- forma de pagamento ----
  const linkPagamento: Acao = { tipo: 'link', rotulo: 'Adicionar forma de pagamento', url: LINKS.pagamentos(contaId) };
  const descPagamento = 'A Meta cobra os anúncios direto de você: cadastre cartão, Pix ou boleto na sua conta de anúncio.';
  let pagamento: Etapa;
  if (conectada && !contaId) {
    pagamento = etapa({
      id: 'pagamento',
      titulo: 'Forma de pagamento',
      estado: 'aguardando',
      descricao: 'Depois de escolher a conta de anúncio, conferimos se ela já tem cartão, Pix ou boleto cadastrado.',
    });
  } else if (conectada && e.detalhesConta) {
    pagamento = e.detalhesConta.temFormaDePagamento
      ? etapa({
          id: 'pagamento',
          titulo: 'Forma de pagamento',
          estado: 'ok',
          descricao: 'A conta já tem uma forma de pagamento cadastrada.',
          origem: 'conferido',
        })
      : etapa({
          id: 'pagamento',
          titulo: 'Forma de pagamento',
          estado: 'pendente',
          descricao: descPagamento,
          acoes: [linkPagamento],
          confirmar: [{ id: 'pagamento', rotulo: 'Já adicionei' }],
        });
  } else if (conectada) {
    pagamento = informou('pagamento')
      ? etapa({
          id: 'pagamento',
          titulo: 'Forma de pagamento',
          estado: 'ok',
          descricao: 'Você disse que já cadastrou. Não conseguimos conferir agora.',
          acoes: [linkPagamento],
          origem: 'informado',
        })
      : etapa({
          id: 'pagamento',
          titulo: 'Forma de pagamento',
          estado: 'desconhecido',
          descricao: 'Não conseguimos conferir a forma de pagamento agora. Se já cadastrou, é só confirmar.',
          acoes: [linkPagamento],
          confirmar: [{ id: 'pagamento', rotulo: 'Já adicionei' }],
        });
  } else {
    pagamento = antesDeConectar(
      'pagamento',
      'Forma de pagamento',
      { descricao: descPagamento, acoes: [linkPagamento], confirmar: [{ id: 'pagamento', rotulo: 'Já adicionei' }] },
      'Você disse que já cadastrou. Conferimos quando você conectar.',
    );
  }

  // ---- Instagram (o posicionamento mais importante) ----
  const guiaInstagram: Acao[] = [
    { tipo: 'link', rotulo: 'Como virar conta profissional', url: LINKS.contaProfissionalInstagram },
    { tipo: 'link', rotulo: 'Vincular à Página', url: LINKS.instagramVinculo },
  ];
  const comoVincular =
    'Para o Instagram aparecer com o @ da sua marca: (1) o perfil precisa ser conta profissional (é grátis, leva 1 minuto); (2) na Página, em Contas vinculadas, conecte o Instagram.';
  const respostasInstagram: Etapa['confirmar'] = [
    { id: 'instagram', rotulo: 'Já vinculei' },
    { id: 'instagram_pagina', rotulo: 'Anunciar com a identidade da Página' },
  ];
  const identidadeDaPagina =
    'Seus anúncios saem no Instagram com o nome e a foto da Página, sem o @ da marca. ';

  let instagram: Etapa;
  if (conectada && contaId && e.instagram && e.instagram.length > 0) {
    instagram = etapa({
      id: 'instagram',
      titulo: 'Instagram',
      estado: 'ok',
      descricao: `Instagram vinculado: @${e.instagram[0].usuario}. Seus anúncios saem com o perfil da marca.`,
      origem: 'conferido',
    });
  } else if (conectada && !contaId) {
    instagram = etapa({
      id: 'instagram',
      titulo: 'Instagram',
      estado: 'aguardando',
      descricao: 'Depois de escolher a conta de anúncio, conferimos se o Instagram está vinculado.',
    });
  } else if (conectada) {
    // Conferimos (lista vazia) ou não conseguimos conferir (null/undefined).
    const naoSabemos = e.instagram === null || e.instagram === undefined;
    if (naoSabemos && !informou('instagram_pagina')) {
      instagram = etapa({
        id: 'instagram',
        titulo: 'Instagram',
        estado: informou('instagram') ? 'ok' : 'desconhecido',
        descricao: informou('instagram')
          ? 'Você disse que já vinculou. Não conseguimos conferir agora.'
          : 'Não conseguimos conferir o Instagram agora. ' + comoVincular,
        acoes: guiaInstagram,
        confirmar: informou('instagram') ? [] : respostasInstagram,
        origem: informou('instagram') ? 'informado' : null,
      });
    } else {
      // Sem Instagram vinculado: anuncia com a identidade da Página (decisão do produto) e incentiva vincular.
      instagram = etapa({
        id: 'instagram',
        titulo: 'Instagram',
        estado: 'atencao',
        descricao: identidadeDaPagina + comoVincular,
        acoes: guiaInstagram,
      });
    }
  } else if (informou('instagram_pagina')) {
    instagram = etapa({
      id: 'instagram',
      titulo: 'Instagram',
      estado: 'atencao',
      descricao: identidadeDaPagina + 'Quando quiser mudar, vincule o Instagram à Página.',
      acoes: guiaInstagram,
    });
  } else if (informou('instagram')) {
    instagram = etapa({
      id: 'instagram',
      titulo: 'Instagram',
      estado: 'ok',
      descricao: 'Você disse que já vinculou. Conferimos quando você conectar.',
      origem: 'informado',
    });
  } else if (preparaAntes) {
    instagram = etapa({
      id: 'instagram',
      titulo: 'Instagram',
      estado: 'pendente',
      descricao: 'O Instagram é onde seus anúncios mais rendem. ' + comoVincular,
      acoes: guiaInstagram,
      confirmar: respostasInstagram,
    });
  } else {
    instagram = etapa({
      id: 'instagram',
      titulo: 'Instagram',
      estado: 'aguardando',
      descricao: 'Conferimos depois que você conectar sua conta da Meta.',
    });
  }

  // ---- situação da conta de anúncio ----
  let contaAtiva: Etapa;
  const d = e.detalhesConta;
  const linkGerenciador: Acao = { tipo: 'link', rotulo: 'Ver no Gerenciador de Anúncios', url: LINKS.gerenciadorDeAnuncios };
  if (!conectada || !contaId) {
    contaAtiva = etapa({
      id: 'conta_ativa',
      titulo: 'Conta de anúncio ativa',
      estado: 'aguardando',
      descricao: 'Conferimos se a Meta liberou a conta para anunciar depois que você conectar.',
    });
  } else if (!d) {
    contaAtiva = etapa({
      id: 'conta_ativa',
      titulo: 'Conta de anúncio ativa',
      estado: 'desconhecido',
      descricao: 'Não conseguimos conferir a situação da conta agora. Tente de novo em instantes.',
    });
  } else if (d.accountStatus === 1) {
    contaAtiva = etapa({
      id: 'conta_ativa',
      titulo: 'Conta de anúncio ativa',
      estado: 'ok',
      descricao: 'A Meta liberou a conta para anunciar.',
      origem: 'conferido',
    });
  } else if (d.accountStatus === 3 || d.accountStatus === 9) {
    contaAtiva = etapa({
      id: 'conta_ativa',
      titulo: 'Conta de anúncio ativa',
      estado: 'pendente',
      descricao: 'Há um pagamento em aberto na conta. Regularize para voltar a anunciar.',
      acoes: [{ tipo: 'link', rotulo: 'Regularizar pagamento', url: LINKS.pagamentos(contaId) }],
    });
  } else if (d.accountStatus === 7 || d.accountStatus === 8) {
    contaAtiva = etapa({
      id: 'conta_ativa',
      titulo: 'Conta de anúncio ativa',
      estado: 'em_analise',
      descricao: 'A Meta está analisando a conta. Costuma levar até 1 dia útil; não precisa fazer nada.',
    });
  } else if (d.accountStatus === 2 || d.accountStatus === 100 || d.accountStatus === 101) {
    const motivo = d.disableReason !== null ? MOTIVOS_BLOQUEIO[d.disableReason] : undefined;
    contaAtiva = etapa({
      id: 'conta_ativa',
      titulo: 'Conta de anúncio ativa',
      estado: 'bloqueado',
      descricao: `A conta não pode anunciar${motivo ? ` (${motivo})` : ''}. Veja os detalhes e como recorrer no Gerenciador de Anúncios.`,
      acoes: [linkGerenciador],
    });
  } else {
    contaAtiva = etapa({
      id: 'conta_ativa',
      titulo: 'Conta de anúncio ativa',
      estado: 'desconhecido',
      descricao: 'A conta está numa situação que não reconhecemos. Veja no Gerenciador de Anúncios.',
      acoes: [linkGerenciador],
    });
  }

  // ---- validade da conexão (60 dias) ----
  let reconexao: Etapa | null = null;
  if (conectada && e.conexao?.expiraEm) {
    const restam = diasAte(e.agora, e.conexao.expiraEm);
    if (restam < 0) {
      reconexao = etapa({
        id: 'reconexao',
        titulo: 'Renovar a conexão',
        estado: 'pendente',
        descricao: 'A conexão com a Meta venceu. Reconecte para a Nuvra voltar a trabalhar na sua conta.',
        acoes: [reconectar],
      });
    } else if (restam <= 7) {
      reconexao = etapa({
        id: 'reconexao',
        titulo: 'Renovar a conexão',
        estado: 'atencao',
        descricao: `A conexão vence em ${restam} ${restam === 1 ? 'dia' : 'dias'}. Reconecte antes para não interromper seus anúncios.`,
        acoes: [reconectar],
        obrigatoria: false,
      });
    }
  }

  // ---- Telegram ----
  const telegram = etapa({
    id: 'telegram',
    titulo: 'Conectar o Telegram',
    estado: e.telegramConectado ? 'ok' : 'pendente',
    descricao: e.telegramConectado
      ? 'Telegram conectado: é por lá que você aprova as campanhas.'
      : 'É pelo Telegram que a Nuvra te mostra cada campanha para você aprovar antes de publicar.',
    acoes: e.telegramConectado ? [] : [{ tipo: 'telegram', rotulo: 'Conectar Telegram' }],
    origem: e.telegramConectado ? 'conferido' : null,
  });

  const ordenadas: Etapa[] = preparaAntes
    ? [email, pagina, contaAnuncio, pagamento, instagram, meta, contaAtiva, telegram]
    : [email, meta, contaAnuncio, pagina, instagram, pagamento, contaAtiva, telegram];
  if (reconexao) ordenadas.splice(ordenadas.indexOf(contaAtiva) + 1, 0, reconexao);

  // A próxima é a primeira que exige ação; "não consegui conferir" só vem depois de tudo que é certeza.
  const exigeAcao: EstadoEtapa[] = ['pendente', 'bloqueado', 'em_analise'];
  const proxima =
    ordenadas.find((x) => exigeAcao.includes(x.estado)) ?? ordenadas.find((x) => x.estado === 'desconhecido') ?? null;

  return {
    temContaAnuncio: e.temContaAnuncio,
    conectada,
    etapas: ordenadas,
    proxima: proxima?.id ?? null,
    prontoParaAnunciar: ordenadas.filter((x) => x.obrigatoria).every((x) => x.estado === 'ok' || x.estado === 'atencao'),
  };
}
