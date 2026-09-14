const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const CHAVE_TOKEN = "nuvra_token";

export function obterToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(CHAVE_TOKEN);
}

export function salvarToken(token: string) {
  window.localStorage.setItem(CHAVE_TOKEN, token);
}

export function removerToken() {
  window.localStorage.removeItem(CHAVE_TOKEN);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface OpcoesApi extends Omit<RequestInit, "body"> {
  body?: unknown;
  autenticado?: boolean;
}

export async function apiFetch<T>(caminho: string, opcoes: OpcoesApi = {}): Promise<T> {
  const { body, autenticado = true, headers, ...resto } = opcoes;

  const headersFinais = new Headers(headers);
  if (!(body instanceof FormData)) {
    headersFinais.set("Content-Type", "application/json");
  }

  if (autenticado) {
    const token = obterToken();
    if (token) {
      headersFinais.set("Authorization", `Bearer ${token}`);
    }
  }

  const resposta = await fetch(`${API_BASE_URL}${caminho}`, {
    ...resto,
    headers: headersFinais,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => ({ message: resposta.statusText }));
    throw new ApiError(dados.message ?? "Erro inesperado.", resposta.status);
  }

  if (resposta.status === 204) {
    return undefined as T;
  }

  return resposta.json() as Promise<T>;
}
