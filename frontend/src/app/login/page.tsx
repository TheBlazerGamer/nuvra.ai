"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiFetch, ApiError } from "@/lib/api";

export default function PaginaLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await apiFetch("/auth/login", { method: "POST", body: { email, senha } });
      router.push("/conta");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível entrar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <AuthShell
      titulo="Entrar"
      descricao="Acesse sua conta para acompanhar suas campanhas."
      rodape={
        <>
          Ainda não tem conta?{" "}
          <Link href="/cadastro" className="text-accent hover:underline">
            Cadastre-se
          </Link>
        </>
      }
    >
      <form onSubmit={aoEnviar} className="flex flex-col gap-4">
        <TextField
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Senha"
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <p className="-mt-2 text-right text-sm">
          <Link href="/esqueci-senha" className="text-accent hover:underline">
            Esqueci minha senha
          </Link>
        </p>

        {erro && <Alert tone="danger">{erro}</Alert>}

        <Button type="submit" loading={carregando} fullWidth>
          Entrar
        </Button>
      </form>
    </AuthShell>
  );
}
