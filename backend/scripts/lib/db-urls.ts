export interface ConexaoDb {
  usuario: string;
  senha: string;
  host: string;
  porta: number;
  banco: string;
}

export function lerUrlDb(url: string): ConexaoDb {
  const u = new URL(url);
  return {
    usuario: decodeURIComponent(u.username),
    senha: decodeURIComponent(u.password),
    host: u.hostname,
    porta: Number(u.port || 5432),
    banco: u.pathname.replace(/^\//, ''),
  };
}
