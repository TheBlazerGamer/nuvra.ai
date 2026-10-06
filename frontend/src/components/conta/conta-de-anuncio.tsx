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
  const [contas, setContas] = useState<Ativo[] | null>(null);
  // Páginas de cada conta de anúncio, buscadas sob demanda (undefined = ainda carregando).
  const [paginasPorConta, setPaginasPorConta] = useState<Record<string, Ativo[]>>({});
  const [contaEscolhida, setContaEscolhida] = useState("");
  const [paginaEscolhida, setPaginaEscolhida] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmandoDesconexao, setConfirmandoDesconexao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  const precisaEscolher = !!status && !status.contaAnuncioId;
  const mostrarEscolha = !!status && (escolhendo || precisaEscolher);

  const paginas = contaEscolhida ? paginasPorConta[contaEscolhida] : undefined;
  // Se a Página marcada não existe nesta conta, vale a única disponível (ou nenhuma).
  const paginaValida = paginas?.some((p) => p.id === paginaEscolhida)
    ? paginaEscolhida
    : paginas?.length === 1
      ? paginas[0].id
      : "";

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
    if (!mostrarEscolha || contas) return;
    let cancelado = false;
    apiFetch<{ contas: Ativo[] }>("/meta/ativos")
      .then((a) => {
        if (cancelado) return;
        setContas(a.contas);
        setContaEscolhida(status?.contaAnuncioId ?? (a.contas.length === 1 ? a.contas[0].id : ""));
        setPaginaEscolhida(status?.paginaId ?? "");
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof ApiError ? e.message : "Não foi possível carregar suas contas.");
      });
    return () => {
      cancelado = true;
    };
  }, [mostrarEscolha, contas, status, tentativa]);

  useEffect(() => {
    if (!mostrarEscolha || !contaEscolhida || paginasPorConta[contaEscolhida]) return;
    let cancelado = false;
    apiFetch<{ paginas: Ativo[] }>(`/meta/paginas?conta=${encodeURIComponent(contaEscolhida)}`)
      .then((r) => {
        if (!cancelado) setPaginasPorConta((atual) => ({ ...atual, [contaEscolhida]: r.paginas }));
      })
      .catch(() => {
        // Sem a lista, deixa escolher a conta sem Página (dá para escolher a Página depois).
        if (!cancelado) setPaginasPorConta((atual) => ({ ...atual, [contaEscolhida]: [] }));
      });
    return () => {
      cancelado = true;
    };
  }, [mostrarEscolha, contaEscolhida, paginasPorConta]);

  // Navegação completa (não é rota do Next): o backend redireciona o navegador para a tela de login da Meta.
  function conectar() {
    window.location.assign(new URL("/meta/conectar", API_BASE_URL).toString());
  }

  async function salvarEscolha() {
    if (!contaEscolhida) return;

    setErro(null);
    setOcupado(true);
    try {
      // Só os IDs: o servidor confere com a Meta e grava os nomes.
      await apiFetch("/meta/selecionar", {
        method: "POST",
        body: { contaAnuncioId: contaEscolhida, ...(paginaValida ? { paginaId: paginaValida } : {}) },
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
      setContas(null);
      setPaginasPorConta({});
      setContaEscolhida("");
      setPaginaEscolhida("");
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
    if (!status.paginaId) return <Badge tone="warning">Falta escolher a Página</Badge>;
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
          {!status.paginaId && (
            <p className="text-sm text-fg-muted">
              Escolha a Página do Facebook que vai aparecer nos seus anúncios: a Meta exige uma Página em todo anúncio.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {!status.paginaId && (
              <Button size="sm" onClick={() => setEscolhendo(true)}>
                Escolher Página
              </Button>
            )}
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
          {!contas && !erro && <Spinner className="text-fg-muted" />}

          {contas && contas.length === 0 && (
            <Alert tone="warning" title="Nenhuma conta de anúncio liberada">
              Você não liberou nenhuma conta de anúncio na tela do Facebook. Reconecte e marque a conta que a Nuvra deve usar.
            </Alert>
          )}

          {contas && contas.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-fg">Qual conta de anúncio a Nuvra deve usar?</legend>
              <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
                {contas.map((c) => (
                  <ChoiceCard
                    key={c.id}
                    name="conta-anuncio"
                    title={c.nome}
                    description={c.id}
                    checked={contaEscolhida === c.id}
                    onChange={() => setContaEscolhida(c.id)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          {contaEscolhida && paginas === undefined && <Spinner className="text-fg-muted" />}

          {contaEscolhida && paginas && paginas.length === 0 && (
            <Alert tone="info">
              Não encontramos Páginas do Facebook disponíveis para anunciar com esta conta. Você pode salvar assim e
              escolher a Página depois.
            </Alert>
          )}

          {contaEscolhida && paginas && paginas.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-fg">Qual Página do Facebook vai nos anúncios?</legend>
              <div className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
                {paginas.map((p) => (
                  <ChoiceCard
                    key={p.id}
                    name="pagina-facebook"
                    title={p.nome}
                    checked={paginaValida === p.id}
                    onChange={() => setPaginaEscolhida(p.id)}
                  />
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex flex-wrap gap-2">
            {contas && contas.length > 0 && (
              <Button size="sm" loading={ocupado} disabled={!contaEscolhida || paginas === undefined} onClick={salvarEscolha}>
                Salvar escolha
              </Button>
            )}
            {!contas && erro && (
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
            {((contas && contas.length === 0) || (!contas && erro)) && (
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
