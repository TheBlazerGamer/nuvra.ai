"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { AssistenteDePreparacao } from "@/components/conta/assistente-de-preparacao";
import { ContaDeAnuncio } from "@/components/conta/conta-de-anuncio";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { TextField } from "@/components/ui/text-field";
import { apiFetch, ApiError } from "@/lib/api";
import { descreverDispositivo } from "@/lib/dispositivo";

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
  // Sobe quando algo muda (Telegram, conta de anúncio) para o assistente conferir de novo.
  const [versaoPreparacao, setVersaoPreparacao] = useState(0);

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

  function recarregarPerfil() {
    apiFetch<Perfil>("/auth/eu").then(setPerfil);
    setVersaoPreparacao((v) => v + 1);
  }

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

        <AssistenteDePreparacao versao={versaoPreparacao} />

        <Telegram
          conectado={perfil.telegramConectado}
          emailVerificado={perfil.emailVerificado}
          aoMudar={recarregarPerfil}
        />

        <ContaDeAnuncio emailVerificado={perfil.emailVerificado} aoMudar={() => setVersaoPreparacao((v) => v + 1)} />

        <TrocarSenha />
        <Sessoes />
      </div>
    </main>
  );
}

// Depois de abrir o link, o vínculo é confirmado pelo webhook do lado do Telegram — não há um
// retorno direto pra cá. Enquanto isso, consultamos o perfil de tempos em tempos pra saber quando deu certo.
const INTERVALO_CONSULTA_MS = 3_000;
const TEMPO_LIMITE_MS = 2 * 60_000;

function Telegram({
  conectado,
  emailVerificado,
  aoMudar,
}: {
  conectado: boolean;
  emailVerificado: boolean;
  aoMudar: () => void;
}) {
  const [carregando, setCarregando] = useState(false);
  const [aguardando, setAguardando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cancelarConsulta = useRef<() => void>(() => {});

  useEffect(() => () => cancelarConsulta.current(), []);

  async function conectar() {
    setErro(null);
    setCarregando(true);
    try {
      const { link } = await apiFetch<{ link: string }>("/canais/telegram/vincular", { method: "POST" });
      window.open(link, "_blank", "noopener,noreferrer");
      aguardarConfirmacao();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível gerar o link de conexão.");
    } finally {
      setCarregando(false);
    }
  }

  function aguardarConfirmacao() {
    setAguardando(true);
    let cancelado = false;
    const inicio = Date.now();

    const consultar = () => {
      apiFetch<Perfil>("/auth/eu").then((p) => {
        if (cancelado) return;
        if (p.telegramConectado) {
          setAguardando(false);
          aoMudar();
          return;
        }
        if (Date.now() - inicio >= TEMPO_LIMITE_MS) {
          setAguardando(false);
          return;
        }
        setTimeout(consultar, INTERVALO_CONSULTA_MS);
      });
    };
    setTimeout(consultar, INTERVALO_CONSULTA_MS);

    cancelarConsulta.current = () => {
      cancelado = true;
    };
  }

  async function desconectar() {
    setErro(null);
    setCarregando(true);
    try {
      await apiFetch("/canais/telegram", { method: "DELETE" });
      aoMudar();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível desconectar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Card id="telegram" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-h3">Telegram</h2>
        <Badge tone={conectado ? "success" : "neutral"}>{conectado ? "Conectado" : "Não conectado"}</Badge>
      </div>

      {conectado ? (
        <>
          <p className="text-sm text-fg-muted">É por lá que você envia o conteúdo do anúncio e sobe suas campanhas.</p>
          <Button variant="ghost" size="sm" loading={carregando} onClick={desconectar} className="self-start">
            Desconectar
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-fg-muted">
            {emailVerificado
              ? "Conecte sua conta para enviar o conteúdo do anúncio e receber relatórios pelo Telegram."
              : "Confirme seu e-mail para poder conectar o Telegram."}
          </p>
          {aguardando && <p className="text-sm text-fg-subtle">Aguardando você confirmar no Telegram…</p>}
          {erro && <Alert tone="danger">{erro}</Alert>}
          <Button
            variant="secondary"
            size="sm"
            loading={carregando}
            disabled={!emailVerificado}
            onClick={conectar}
            className="self-start"
          >
            Conectar com Telegram
          </Button>
        </>
      )}
    </Card>
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
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-h3">Dispositivos conectados</h2>
        {sessoes.length > 1 && (
          <Button size="sm" variant="ghost" loading={ocupado === "outras"} onClick={encerrarOutras}>
            Encerrar os outros
          </Button>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-line">
        {sessoes.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-fg" title={s.userAgent ?? undefined}>
                {descreverDispositivo(s.userAgent)} {s.atual && <Badge tone="primary">este dispositivo</Badge>}
              </p>
              <p className="text-fg-subtle">Último uso: {new Date(s.ultimoUsoEm).toLocaleString("pt-BR")}</p>
            </div>
            {!s.atual && (
              <Button size="sm" variant="ghost" className="shrink-0" loading={ocupado === s.id} onClick={() => encerrar(s.id)}>
                Encerrar
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
