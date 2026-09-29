const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
}

// A sessão vive num cookie httpOnly, nunca em localStorage/JS: `credentials: "include"` garante que o
// navegador o envie a cada chamada. O backend confere a origem da requisição (proteção contra CSRF).
export async function apiFetch<T>(caminho: string, opcoes: OpcoesApi = {}): Promise<T> {
  const { body, headers, ...resto } = opcoes;

  const headersFinais = new Headers(headers);
  if (!(body instanceof FormData)) {
    headersFinais.set("Content-Type", "application/json");
  }

  const resposta = await fetch(`${API_BASE_URL}${caminho}`, {
    ...resto,
    credentials: "include",
    headers: headersFinais,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  if (!resposta.ok) {
    const dados = await resposta.json().catch(() => ({ message: resposta.statusText }));
    const mensagem =
      dados.message ?? (resposta.status === 429 ? "Muitas tentativas. Aguarde alguns minutos." : "Erro inesperado.");
    throw new ApiError(Array.isArray(mensagem) ? mensagem[0] : mensagem, resposta.status);
  }

  if (resposta.status === 204 || resposta.status === 202) {
    return undefined as T;
  }

  return resposta.json() as Promise<T>;
}

// O link do e-mail leva o token no fragmento (#token=...), que o navegador nunca envia ao servidor —
// por isso ele só pode ser lido aqui, no cliente.
export function lerTokenDoFragmento(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return params.get("token");
}
