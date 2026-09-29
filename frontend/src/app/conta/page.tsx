"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";
import { apiFetch, ApiError } from "@/lib/api";

interface Perfil {
  cliente: { id: string; nome: string; email: string; criadoEm: string };
  emailVerificado: boolean;
  telegramConectado: boolean;
}

interface Sessao {
  id: string;
  criadoEm: string;
  ultimoUsoEm: string;
  userAgent: string | null;
  atual: boolean;
}

export default function PaginaConta() {
  const router = useRouter();
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);

  useEffect(() => {
    let cancelado = false;

    apiFetch<Perfil>("/auth/eu")
      .then((p) => {
        if (!cancelado) setPerfil(p);
      })
      .catch(() => {
        if (!cancelado) router.replace("/login");
      })
      .finally(() => {
        if (!cancelado) setCarregandoPerfil(false);
      });

    return () => {
      cancelado = true;
    };
  }, [router]);

  async function sair() {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  if (carregandoPerfil) {
    return (
      <main className="flex-1 flex items-center justify-center bg-page">
        <Spinner className="size-6 text-fg-muted" />
      </main>
    );
  }
  if (!perfil) return null;

  return (
    <main className="flex-1 bg-page">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Logo variant="lockup" tone="blue" height={24} />
          <Button variant="ghost" size="sm" onClick={sair}>
            Sair
          </Button>
        </div>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <Card className="flex flex-col gap-1">
          <h1 className="text-h2">{perfil.cliente.nome}</h1>
          <p className="text-fg-muted">{perfil.cliente.email}</p>
        </Card>

        {!perfil.emailVerificado && <VerificacaoPendente />}

        <Card className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-h3">Telegram</h2>
            <Badge tone={perfil.telegramConectado ? "success" : "neutral"}>
              {perfil.telegramConectado ? "Conectado" : "Não conectado"}
            </Badge>
          </div>
          <p className="text-sm text-fg-muted">
            {perfil.telegramConectado
              ? "É por lá que você envia criativos e acompanha suas campanhas."
              : "Em breve você poderá conectar sua conta do Telegram por aqui."}
          </p>
        </Card>

        <TrocarSenha />
        <Sessoes />
      </div>
    </main>
  );
}

function VerificacaoPendente() {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function reenviar() {
    setEnviando(true);
    try {
      await apiFetch("/auth/reenviar-verificacao", { method: "POST" });
      setEnviado(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Alert tone="warning" title="Confirme seu e-mail">
      <div className="flex flex-col items-start gap-2">
        <p>Alguns recursos só ficam disponíveis depois da confirmação.</p>
        {enviado ? (
          <p className="text-sm">Enviamos um novo link, confira sua caixa de entrada.</p>
        ) : (
          <Button size="sm" variant="secondary" loading={enviando} onClick={reenviar}>
            Reenviar e-mail de confirmação
          </Button>
        )}
      </div>
    </Alert>
  );
}

function TrocarSenha() {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSucesso(false);
    setCarregando(true);
    try {
      await apiFetch("/auth/alterar-senha", { method: "POST", body: { senhaAtual, novaSenha } });
      setSucesso(true);
      setSenhaAtual("");
      setNovaSenha("");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível alterar sua senha.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-h3">Alterar senha</h2>
      <form onSubmit={aoEnviar} className="flex flex-col gap-3">
        <TextField
          label="Senha atual"
          type="password"
          autoComplete="current-password"
          required
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
        />
        <TextField
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          hint="Pelo menos 12 caracteres. Os outros dispositivos serão desconectados."
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
        />
        {erro && <Alert tone="danger">{erro}</Alert>}
        {sucesso && <Alert tone="success">Senha alterada.</Alert>}
        <Button type="submit" variant="secondary" loading={carregando}>
          Alterar senha
        </Button>
      </form>
    </Card>
  );
}

function Sessoes() {
  const [sessoes, setSessoes] = useState<Sessao[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  function carregar() {
    apiFetch<Sessao[]>("/auth/sessoes").then(setSessoes);
  }

  useEffect(() => {
    let cancelado = false;
    apiFetch<Sessao[]>("/auth/sessoes").then((lista) => {
      if (!cancelado) setSessoes(lista);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  async function encerrar(id: string) {
    setOcupado(id);
    try {
      await apiFetch(`/auth/sessoes/${id}`, { method: "DELETE" });
      carregar();
    } finally {
      setOcupado(null);
    }
  }

  async function encerrarOutras() {
    setOcupado("outras");
    try {
      await apiFetch("/auth/sessoes/encerrar-outras", { method: "POST" });
      carregar();
    } finally {
      setOcupado(null);
    }
  }

  if (!sessoes) {
    return (
      <Card>
        <Spinner className="text-fg-muted" />
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-h3">Dispositivos conectados</h2>
        {sessoes.length > 1 && (
          <Button size="sm" variant="ghost" loading={ocupado === "outras"} onClick={encerrarOutras}>
            Encerrar os outros
          </Button>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-line">
        {sessoes.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div>
              <p className="text-fg">
                {s.userAgent ?? "Dispositivo desconhecido"} {s.atual && <Badge tone="primary">este dispositivo</Badge>}
              </p>
              <p className="text-fg-subtle">Último uso: {new Date(s.ultimoUsoEm).toLocaleString("pt-BR")}</p>
            </div>
            {!s.atual && (
              <Button size="sm" variant="ghost" loading={ocupado === s.id} onClick={() => encerrar(s.id)}>
                Encerrar
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
