"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { API_BASE_URL, apiFetch, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";

type EstadoEtapa = "ok" | "atencao" | "pendente" | "bloqueado" | "em_analise" | "aguardando" | "desconhecido";

type Acao =
  | { tipo: "link"; rotulo: string; url: string }
  | { tipo: "conectar"; rotulo: string }
  | { tipo: "escolher"; rotulo: string }
  | { tipo: "reenviar_email"; rotulo: string }
  | { tipo: "telegram"; rotulo: string };

interface Etapa {
  id: string;
  titulo: string;
  estado: EstadoEtapa;
  descricao: string;
  obrigatoria: boolean;
  acoes: Acao[];
  confirmar: { id: string; rotulo: string }[];
  origem: "conferido" | "informado" | null;
}

interface Prontidao {
  temContaAnuncio: "SIM" | "NAO" | "NAO_SEI" | null;
  conectada: boolean;
  etapas: Etapa[];
  proxima: string | null;
  prontoParaAnunciar: boolean;
}

const ICONES: Record<EstadoEtapa, { texto: string; classe: string; rotulo: string }> = {
  ok: { texto: "✓", classe: "bg-success-soft text-success", rotulo: "pronto" },
  atencao: { texto: "!", classe: "bg-warning-soft text-warning", rotulo: "atenção" },
  pendente: { texto: "•", classe: "bg-primary-soft text-accent", rotulo: "falta fazer" },
  bloqueado: { texto: "✕", classe: "bg-danger-soft text-danger", rotulo: "bloqueado" },
  em_analise: { texto: "…", classe: "bg-surface-muted text-fg-muted", rotulo: "em análise" },
  aguardando: { texto: "–", classe: "bg-surface-muted text-fg-subtle", rotulo: "aguardando" },
  desconhecido: { texto: "?", classe: "bg-warning-soft text-warning", rotulo: "não conseguimos conferir" },
};

function LinkBotao({ url, primario, children }: { url: string; primario: boolean; children: ReactNode }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-4 py-2 text-center text-sm font-medium leading-snug transition-colors duration-150",
        primario
          ? "bg-primary text-primary-fg hover:bg-primary-hover"
          : "border border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-muted",
      )}
    >
      {children}
    </a>
  );
}

function rolarPara(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function AssistenteDePreparacao({ versao }: { versao: number }) {
  const [dados, setDados] = useState<Prontidao | null | undefined>(undefined);
  const [recarga, setRecarga] = useState(0);
  const [mostrarTudo, setMostrarTudo] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ultimaBusca = useRef(0);

  // Busca ao abrir, quando algo muda na página e quando a pessoa volta da Meta para esta aba.
  useEffect(() => {
    let cancelado = false;
    const buscar = (forcar: boolean) => {
      if (!forcar && Date.now() - ultimaBusca.current < 3_000) return;
      ultimaBusca.current = Date.now();
      apiFetch<Prontidao>("/meta/prontidao")
        .then((d) => {
          if (!cancelado) setDados(d);
        })
        .catch(() => {
          if (!cancelado) setDados((atual) => atual ?? null);
        });
    };
    buscar(true);
    const aoVoltar = () => {
      if (document.visibilityState === "visible") buscar(false);
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [versao, recarga]);

  async function enviar(chave: string, caminho: string, corpo: object) {
    setErro(null);
    setOcupado(chave);
    try {
      await apiFetch(caminho, { method: "POST", body: corpo });
      setRecarga((n) => n + 1);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setOcupado(null);
    }
  }

  function executar(acao: Acao) {
    if (acao.tipo === "conectar") {
      // Navegação completa (não é rota do Next): o backend leva o navegador à tela de login da Meta.
      window.location.assign(new URL("/meta/conectar", API_BASE_URL).toString());
    } else if (acao.tipo === "escolher") {
      rolarPara("conta-de-anuncio");
    } else if (acao.tipo === "telegram") {
      rolarPara("telegram");
    } else if (acao.tipo === "reenviar_email") {
      setOcupado("email");
      apiFetch("/auth/reenviar-verificacao", { method: "POST" })
        .then(() => setAviso("Enviamos um novo link. Confira sua caixa de entrada e o spam."))
        .catch((e) => setErro(e instanceof ApiError ? e.message : "Não foi possível reenviar agora."))
        .finally(() => setOcupado(null));
    }
  }

  if (dados === undefined) {
    return (
      <Card>
        <Spinner className="text-fg-muted" />
      </Card>
    );
  }
  // Se não deu para carregar o assistente, a página segue funcionando sem ele.
  if (dados === null) return null;

  const obrigatorias = dados.etapas.filter((e) => e.obrigatoria);
  const prontas = obrigatorias.filter((e) => e.estado === "ok" || e.estado === "atencao").length;
  const perguntar = dados.temContaAnuncio === null && !dados.conectada;
  const recolhido = dados.prontoParaAnunciar && !mostrarTudo;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-h3">Preparação para anunciar</h2>
        <Badge tone={dados.prontoParaAnunciar ? "success" : "primary"}>
          {prontas} de {obrigatorias.length} prontas
        </Badge>
      </div>

      {aviso && <Alert tone="success">{aviso}</Alert>}
      {erro && <Alert tone="danger">{erro}</Alert>}

      {perguntar && (
        <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-muted p-4">
          <p className="font-medium text-fg">Você já tem conta de anúncio no Facebook ou Instagram?</p>
          <p className="text-sm text-fg-muted">
            Com a resposta, mostramos os passos na ordem certa para você. É a conta onde os anúncios são criados e cobrados.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["SIM", "Sim, já tenho"],
                ["NAO", "Ainda não tenho"],
                ["NAO_SEI", "Não sei"],
              ] as const
            ).map(([resposta, rotulo]) => (
              <Button
                key={resposta}
                size="sm"
                variant="secondary"
                loading={ocupado === resposta}
                disabled={ocupado !== null}
                onClick={() => enviar(resposta, "/meta/prontidao/pergunta", { resposta })}
              >
                {rotulo}
              </Button>
            ))}
          </div>
        </div>
      )}

      {recolhido ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-fg-muted">Tudo pronto: sua conta está preparada para anunciar.</p>
          <Button size="sm" variant="ghost" onClick={() => setMostrarTudo(true)}>
            Ver etapas
          </Button>
        </div>
      ) : (
        <ol className="flex flex-col divide-y divide-line">
          {dados.etapas.map((etapa) => {
            const icone = ICONES[etapa.estado];
            const ehProxima = etapa.id === dados.proxima;
            const mostrarDetalhe =
              ehProxima || ["atencao", "bloqueado", "em_analise", "desconhecido"].includes(etapa.estado);
            const desfazivel = etapa.origem === "informado" ? etapa.id : null;

            return (
              <li key={etapa.id} className={cn("flex gap-3 py-3", ehProxima && "bg-primary-soft/40 -mx-2 rounded-md px-2")}>
                <span
                  className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold", icone.classe)}
                  role="img"
                  aria-label={icone.rotulo}
                >
                  {icone.texto}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className={cn("font-medium", etapa.estado === "aguardando" ? "text-fg-muted" : "text-fg")}>
                      {etapa.titulo}
                    </span>
                    {etapa.origem === "informado" && <span className="text-xs text-fg-subtle">informado por você</span>}
                    {desfazivel && (
                      <button
                        type="button"
                        className="text-xs text-accent hover:underline"
                        disabled={ocupado !== null}
                        onClick={() =>
                          enviar(`desfazer-${desfazivel}`, "/meta/prontidao/confirmar", { etapa: desfazivel, feito: false })
                        }
                      >
                        desfazer
                      </button>
                    )}
                  </div>

                  {mostrarDetalhe && <p className="text-sm text-fg-muted">{etapa.descricao}</p>}

                  {mostrarDetalhe && (etapa.acoes.length > 0 || etapa.confirmar.length > 0) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {etapa.acoes.map((acao, i) =>
                        acao.tipo === "link" ? (
                          <LinkBotao key={acao.rotulo} url={acao.url} primario={ehProxima && i === 0}>
                            {acao.rotulo}
                          </LinkBotao>
                        ) : (
                          <Button
                            key={acao.rotulo}
                            size="sm"
                            variant={ehProxima && i === 0 ? "primary" : "secondary"}
                            loading={acao.tipo === "reenviar_email" && ocupado === "email"}
                            onClick={() => executar(acao)}
                          >
                            {acao.rotulo}
                          </Button>
                        ),
                      )}
                      {etapa.confirmar.map((c) => (
                        <Button
                          key={c.id}
                          size="sm"
                          variant="ghost"
                          loading={ocupado === `confirmar-${c.id}`}
                          disabled={ocupado !== null}
                          onClick={() => enviar(`confirmar-${c.id}`, "/meta/prontidao/confirmar", { etapa: c.id })}
                        >
                          {c.rotulo}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {!recolhido && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-fg-subtle">
            Fez algo na Meta? Ao voltar para esta página, conferimos de novo sozinhos.
          </p>
          <Button size="sm" variant="ghost" onClick={() => setRecarga((n) => n + 1)}>
            Conferir de novo
          </Button>
        </div>
      )}
    </Card>
  );
}
