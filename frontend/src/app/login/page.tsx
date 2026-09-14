"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, salvarToken, ApiError } from "@/lib/api";

export default function PaginaLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function aoEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const { accessToken } = await apiFetch<{ accessToken: string }>("/auth/login", {
        method: "POST",
        autenticado: false,
        body: { email, senha },
      });
      salvarToken(accessToken);
      router.push("/campanhas/nova");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível entrar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center bg-nuvra-navy px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-white mb-1">Nuvra.AI</h1>
        <p className="text-white/60 mb-8 text-sm">Entre na sua conta para gerenciar suas campanhas.</p>

        <form onSubmit={aoEnviar} className="space-y-4">
          <div>
            <label className="block text-sm text-white/80 mb-1" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white outline-none focus:border-nuvra-blue"
            />
          </div>

          <div>
            <label className="block text-sm text-white/80 mb-1" htmlFor="senha">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white outline-none focus:border-nuvra-blue"
            />
          </div>

          {erro && <p className="text-sm text-red-400">{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-nuvra-blue py-2.5 font-medium text-white transition hover:bg-nuvra-blue-medium disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-sm text-white/60">
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="text-nuvra-blue hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </main>
  );
}
