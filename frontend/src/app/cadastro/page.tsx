"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, salvarToken, ApiError } from "@/lib/api";

const PLANOS = [
  { valor: "BASICO", titulo: "Básico", detalhe: "até 5 criativos e 5 campanhas/mês" },
  { valor: "ESSENCIAL", titulo: "Essencial", detalhe: "até 15 criativos e 15 campanhas/mês" },
  { valor: "PRO", titulo: "Pró", detalhe: "até 40 criativos e 40 campanhas/mês" },
] as const;

export default function PaginaCadastro() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [plano, setPlano] = useState<(typeof PLANOS)[number]["valor"]>("BASICO");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function aoEnviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const { accessToken } = await apiFetch<{ accessToken: string }>("/auth/register", {
        method: "POST",
        autenticado: false,
        body: { nome, email, senha, telefone: telefone || undefined, plano },
      });
      salvarToken(accessToken);
      router.push("/campanhas/nova");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível criar sua conta.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center bg-nuvra-navy px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-white mb-1">Criar conta</h1>
        <p className="text-white/60 mb-8 text-sm">Comece a automatizar suas campanhas de Meta Ads.</p>

        <form onSubmit={aoEnviar} className="space-y-4">
          <Campo label="Nome" id="nome" value={nome} onChange={setNome} />
          <Campo label="E-mail" id="email" type="email" value={email} onChange={setEmail} />
          <Campo label="Senha" id="senha" type="password" value={senha} onChange={setSenha} minLength={8} />
          <Campo label="Telefone (opcional)" id="telefone" value={telefone} onChange={setTelefone} required={false} />

          <div>
            <span className="block text-sm text-white/80 mb-2">Plano</span>
            <div className="space-y-2">
              {PLANOS.map((p) => (
                <label
                  key={p.valor}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2.5 cursor-pointer transition ${
                    plano === p.valor
                      ? "border-nuvra-blue bg-nuvra-blue/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <span>
                    <span className="block text-white text-sm font-medium">{p.titulo}</span>
                    <span className="block text-white/50 text-xs">{p.detalhe}</span>
                  </span>
                  <input
                    type="radio"
                    name="plano"
                    value={p.valor}
                    checked={plano === p.valor}
                    onChange={() => setPlano(p.valor)}
                    className="accent-[#1747E9]"
                  />
                </label>
              ))}
            </div>
          </div>

          {erro && <p className="text-sm text-red-400">{erro}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-nuvra-blue py-2.5 font-medium text-white transition hover:bg-nuvra-blue-medium disabled:opacity-60"
          >
            {carregando ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="mt-6 text-sm text-white/60">
          Já tem conta?{" "}
          <Link href="/login" className="text-nuvra-blue hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </main>
  );
}

function Campo({
  label,
  id,
  value,
  onChange,
  type = "text",
  required = true,
  minLength,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (valor: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div>
      <label className="block text-sm text-white/80 mb-1" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white outline-none focus:border-nuvra-blue"
      />
    </div>
  );
}
