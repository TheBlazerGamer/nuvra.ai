"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, lerTokenDoFragmento, ApiError } from "@/lib/api";

type Estado = "verificando" | "sucesso" | "erro";

// O fragmento da URL (#token=...) só existe no navegador: ler no primeiro render faria o HTML gerado
// no servidor divergir do renderizado no cliente ("hydration mismatch"). Por isso o estado inicial nunca
// depende dele — só o efeito, que roda exclusivamente no navegador, lê o token e decide o resultado.
export default function PaginaVerificarEmail() {
  const [estado, setEstado] = useState<Estado>("verificando");
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    const token = lerTokenDoFragmento();

    const chamada = token
      ? apiFetch("/auth/verificar-email", { method: "POST", body: { token } })
      : Promise.reject(new Error("SEM_TOKEN"));

    chamada
      .then(() => {
        if (!cancelado) setEstado("sucesso");
      })
      .catch((e) => {
        if (cancelado) return;
        setEstado("erro");
        setErro(
          !token
            ? "Link inválido: nenhum código de confirmação encontrado."
            : e instanceof ApiError
              ? e.message
              : "Não foi possível confirmar seu e-mail.",
        );
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <AuthShell titulo="Confirmação de e-mail">
      {estado === "verificando" && (
        <p className="flex items-center gap-2 text-fg-muted">
          <Spinner /> Confirmando seu e-mail...
        </p>
      )}

      {estado === "sucesso" && (
        <>
          <Alert tone="success">Seu e-mail foi confirmado.</Alert>
          <Link href="/login" className="text-accent hover:underline">
            Entrar na minha conta
          </Link>
        </>
      )}

      {estado === "erro" && (
        <>
          <Alert tone="danger">{erro}</Alert>
          <p className="text-sm text-fg-muted">
            Peça um novo link em <Link href="/conta" className="text-accent hover:underline">Minha conta</Link>, depois
            de entrar.
          </p>
        </>
      )}
    </AuthShell>
  );
}
