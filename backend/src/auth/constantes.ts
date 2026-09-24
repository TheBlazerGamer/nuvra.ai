// Em produção o prefixo __Host- obriga o navegador a exigir HTTPS, Path=/ e ausência de Domain.
export const COOKIE_SESSAO =
  process.env.NODE_ENV === 'production' ? '__Host-nuvra_sessao' : 'nuvra_sessao';

const DIA_MS = 24 * 60 * 60 * 1000;
export const SESSAO_INATIVIDADE_MS = 7 * DIA_MS;
export const SESSAO_DURACAO_MAXIMA_MS = 30 * DIA_MS;

export const MAX_TENTATIVAS_LOGIN = 5;
export const BLOQUEIO_LOGIN_MS = 15 * 60 * 1000;

export const LIMITE_AUTH_POR_MINUTO = Number(process.env.AUTH_RATE_LIMIT_PER_MIN ?? 10);
