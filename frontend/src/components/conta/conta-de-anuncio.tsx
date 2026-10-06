"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceCard } from "@/components/ui/choice-card";
import { Spinner } from "@/components/ui/spinner";
import { API_BASE_URL, apiFetch, ApiError } from "@/lib/api";

interface StatusMeta {
  contaAnuncioId: string | null;
  contaAnuncioNome: string | null;
  paginaId: string | null;
  paginaNome: string | null;
  expiraEm: string | null;
  conectadoEm: string;
}

interface Ativo {
  id: string;
  nome: string;
}

interface Ativos {
  contas: Ativo[];
  paginas: Ativo[];
}

// Ao voltar da Meta, o backend nos redireciona para /conta?meta=conectado ou ?meta=erro.
function lerResultadoMeta(): "conectado" | "erro" | null {
  if (typeof window === "undefined") return null;
  const valor = new URLSearchParams(window.location.search).get("meta");
  return valor === "conectado" || valor === "erro" ? valor : null;
}

export function ContaDeAnuncio({ emailVerificado }: { emailVerificado: boolean }) {
  // undefined = ainda carregando; null = sem conexão.
  const [status, setStatus] = useState<StatusMeta | null | undefined>(undefined);
  const [resultado] = useState(lerResultadoMeta);
  const [escolhendo, setEscolhendo] = useState(false);
  const [ativos, setAtivos] = useState<Ativos | null>(null);
  const [contaEscolhida, setContaEscolhida] = useState("");
  const [paginaEscolhida, setPaginaEscolhida] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmandoDesconexao, setConfirmandoDesconexao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const precisaEscolher = !!status && !status.contaAnuncioId;
  const mostrarEscolha = !!status && (escolhendo || precisaEscolher);

  useEffect(() => {
    if (resultado) window.history.replaceState(null, "", window.location.pathname);
  }, [resultado]);

  useEffect(() => {
    let cancelado = false;
    apiFetch<StatusMeta | null>("/meta/status")
      .then((s) => {
        if (!cancelado) setStatus(s);
      })
      .catch(() => {
        if (!cancelado) setStatus(null);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!mostrarEscolha || ativos) return;
    let cancelado = false;
    apiFetch<Ativos>("/meta/ativos")
      .then((a) => {
        if (cancelado) return;
        setAtivos(a);
        setContaEscolhida(status?.contaAnuncioId ?? (a.contas.length === 1 ? a.contas[0].id : ""));
        setPaginaEscolhida(status?.paginaId ?? a.paginas[0]?.id ?? "");
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof ApiError ? e.message : "Não foi possível carregar suas contas.");
      });
    return () => {
      cancelado = true;
    };
  }, [mostrarEscolha, ativos, status, tentativa]);

  // Navegação completa (não é rota do Next): o backend redireciona o navegador para a tela de login da Meta.
  function conectar() {
    window.location.assign(new URL("/meta/conectar", API_BASE_URL).toString());
  }

  async function salvarEscolha() {
    const conta = ativos?.contas.find((c) => c.id === contaEscolhida);
    if (!conta) return;
    const pagina = ativos?.paginas.find((p) => p.id === paginaEscolhida);

    setErro(null);
    setOcupado(true);
    try {
      await apiFetch("/meta/selecionar", {
        method: "POST",
        body: {
          contaAnuncioId: conta.id,
          contaAnuncioNome: conta.nome,
          ...(pagina ? { paginaId: pagina.id, paginaNome: pagina.nome } : {}),
        },
      });
      setStatus(await apiFetch<StatusMeta | null>("/meta/status"));
      setEscolhendo(false);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar sua escolha.");
    } finally {
      setOcupado(false);
    }
  }

  async function desconectar() {
    setErro(null);
    setOcupado(true);
    try {
      await apiFetch("/meta/conexao", { method: "DELETE" });
      setStatus(null);
      setAtivos(null);
      setEscolhendo(false);
      setConfirmandoDesconexao(false);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível desconectar.");
    } finally {
      setOcupado(false);
    }
  }

  function badge() {
    if (status === undefined) return null;
    if (!status) return <Badge>Não conectada</Badge>;
    if (precisaEscolher) return <Badge tone="warning">Falta escolher a conta</Badge>;
    return <Badge tone="success">Conectada</Badge>;
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3">Conta de anúncio (Facebook)</h2>
        {badge()}
      </div>

      {resultado === "conectado" && <Alert tone="success">Conexão com o Facebook concluída.</Alert>}
      {resultado === "erro" && (
        <Alert tone="danger">
          Não foi possível concluir a conexão com o Facebook. Tente de novo; se você cancelou na tela da Meta, está tudo certo.
        </Alert>
      )}

      {status === undefined && <Spinner className="text-fg-muted" />}

      {status === null && (
        <>
          <p className="text-sm text-fg-muted">
            {emailVerificado
              ? "Conecte a sua conta de anúncio para a Nuvra criar e acompanhar suas campanhas. Na tela do Facebook você escolhe quais contas autoriza e pode desconectar quando quiser."
              : "Confirme seu e-mail para poder conectar a sua conta de anúncio."}
          </p>
          <Button size="sm" variant="secondary" disabled={!emailVerificado} onClick={conectar} className="self-start">
            Conectar conta de anúncio
          </Button>
        </>
      )}

      {status && !mostrarEscolha && (
        <>
          <dl className="grid gap-1 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-fg-muted">Conta de anúncio:</dt>
              <dd className="font-medium text-fg">{status.contaAnuncioNome}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-fg-muted">Página:</dt>
              <dd className="font-medium text-fg">{status.paginaNome ?? "Nenhuma"}</dd>
            </div>
            {status.expiraEm && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-fg-muted">Conexão válida até:</dt>
                <dd className="text-fg">{new Date(status.expiraEm).toLocaleDateString("pt-BR")}</dd>
              </div>
            )}
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEscolhendo(true)}>
              Trocar conta
            </Button>
            {confirmandoDesconexao ? (
              <>
                <span className="text-sm text-fg-muted">Desconectar a conta de anúncio?</span>
                <Button size="sm" variant="danger" loading={ocupado} onClick={desconectar}>
                  Sim, desconectar
                </Button>
                <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setConfirmandoDesconexao(false)}>
                  Cancelar
                </Button>
              </>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmandoDesconexao(true)}>
                Desconectar
              </Button>
            )}
          </div>
        </>
      )}

      {mostrarEscolha && (
        <div className="flex flex-col gap-4">
          {!ativos && !erro && <Spinner className="text-fg-muted" />}

          {ativos && ativos.contas.length === 0 && (
            <Alert tone="warning" title="Nenhuma conta de anúncio encontrada">
              Não achamos contas de anúncio nesse perfil do Facebook. Reconecte escolhendo outro perfil, ou desconecte.
            </Alert>
          )}

          {ativos && ativos.contas.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-fg">Qual conta de anúncio a Nuvra deve usar?</legend>
              {ativos.contas.map((c) => (
                <ChoiceCard
                  key={c.id}
                  name="conta-anuncio"
                  title={c.nome}
                  description={c.id}
                  checked={contaEscolhida === c.id}
                  onChange={() => setContaEscolhida(c.id)}
                />
              ))}
            </fieldset>
          )}

          {ativos && ativos.contas.length > 0 && ativos.paginas.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-fg">E qual Página do Facebook?</legend>
              {ativos.paginas.map((p) => (
                <ChoiceCard
                  key={p.id}
                  name="pagina-facebook"
                  title={p.nome}
                  checked={paginaEscolhida === p.id}
                  onChange={() => setPaginaEscolhida(p.id)}
                />
              ))}
            </fieldset>
          )}

          <div className="flex flex-wrap gap-2">
            {ativos && ativos.contas.length > 0 && (
              <Button size="sm" loading={ocupado} disabled={!contaEscolhida} onClick={salvarEscolha}>
                Salvar escolha
              </Button>
            )}
            {!ativos && erro && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setErro(null);
                  setTentativa((n) => n + 1);
                }}
              >
                Tentar de novo
              </Button>
            )}
            {((ativos && ativos.contas.length === 0) || (!ativos && erro)) && (
              <Button size="sm" variant="secondary" onClick={conectar}>
                Reconectar
              </Button>
            )}
            {escolhendo && !precisaEscolher && (
              <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => setEscolhendo(false)}>
                Cancelar
              </Button>
            )}
            {precisaEscolher && (
              <Button size="sm" variant="ghost" loading={ocupado} onClick={desconectar}>
                Desconectar
              </Button>
            )}
          </div>
        </div>
      )}

      {erro && <Alert tone="danger">{erro}</Alert>}
    </Card>
  );
}
