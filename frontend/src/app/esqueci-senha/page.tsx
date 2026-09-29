"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiFetch } from "@/lib/api";

export default function PaginaEsqueciSenha() {
  const [email, setEmail] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    setCarregando(true);
    try {
      await apiFetch("/auth/esqueci-senha", { method: "POST", body: { email } });
    } finally {
      // Mesma resposta exista ou não a conta: nunca revela quem é cliente.
      setCarregando(false);
      setEnviado(true);
    }
  }

  if (enviado) {
    return (
      <AuthShell titulo="Confira seu e-mail">
        <Alert tone="success">
          Se existir uma conta com o e-mail {email}, enviamos as instruções para redefinir a senha (confira também
          a caixa de spam).
        </Alert>
        <Link href="/login" className="text-accent hover:underline">
          Voltar para o login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Esqueci minha senha"
      descricao="Informe seu e-mail e enviaremos um link para redefinir a senha."
      rodape={
        <Link href="/login" className="text-accent hover:underline">
          Voltar para o login
        </Link>
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
        <Button type="submit" loading={carregando} fullWidth>
          Enviar instruções
        </Button>
      </form>
    </AuthShell>
  );
}
