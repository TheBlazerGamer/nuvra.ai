"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { apiFetch, lerTokenDoFragmento, ApiError } from "@/lib/api";

export default function PaginaRedefinirSenha() {
  const router = useRouter();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  // Só existe no navegador (ver comentário em /verificar-email): começa "não sei ainda" para bater com
  // o HTML do servidor, e o efeito confirma logo após montar, sem esperar o envio do formulário.
  const [semLink, setSemLink] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      if (!lerTokenDoFragmento()) setSemLink(true);
    });
  }, []);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    const token = lerTokenDoFragmento();
    if (!token) {
      setErro("Link inválido: nenhum código de redefinição encontrado.");
      return;
    }
    if (novaSenha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);
    try {
      await apiFetch("/auth/redefinir-senha", { method: "POST", body: { token, novaSenha } });
      setSucesso(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível redefinir sua senha.");
    } finally {
      setCarregando(false);
    }
  }

  if (sucesso) {
    return (
      <AuthShell titulo="Senha redefinida">
        <Alert tone="success">
          Sua senha foi alterada e todos os dispositivos conectados foram desconectados. Levando você para o
          login...
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Redefinir senha"
      rodape={
        <Link href="/login" className="text-accent hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {semLink && <Alert tone="danger">Link inválido: nenhum código de redefinição encontrado.</Alert>}

      <form onSubmit={aoEnviar} className="flex flex-col gap-4">
        <TextField
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          hint="Pelo menos 12 caracteres."
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
        />
        <TextField
          label="Confirme a nova senha"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
        />

        {erro && <Alert tone="danger">{erro}</Alert>}

        <Button type="submit" loading={carregando} fullWidth>
          Redefinir senha
        </Button>
      </form>
    </AuthShell>
  );
}
