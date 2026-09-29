"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiFetch, ApiError } from "@/lib/api";

export default function PaginaCadastro() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await apiFetch("/auth/cadastro", { method: "POST", body: { nome, email, senha } });
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível criar sua conta.");
    } finally {
      setCarregando(false);
    }
  }

  if (enviado) {
    return (
      <AuthShell titulo="Confira seu e-mail">
        <Alert tone="success">
          Se {email} ainda não tinha conta, enviamos um link de confirmação para lá. Abra o e-mail e confirme
          para poder entrar (confira também a caixa de spam).
        </Alert>
        <p className="text-sm text-fg-muted">
          Já confirmou?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Entrar
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Criar conta"
      descricao="Comece a automatizar suas campanhas de anúncios."
      rodape={
        <>
          Já tem conta?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={aoEnviar} className="flex flex-col gap-4">
        <TextField
          label="Nome"
          autoComplete="name"
          required
          minLength={2}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
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
          autoComplete="new-password"
          required
          minLength={12}
          hint="Pelo menos 12 caracteres."
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        {erro && <Alert tone="danger">{erro}</Alert>}

        <Button type="submit" loading={carregando} fullWidth>
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}
