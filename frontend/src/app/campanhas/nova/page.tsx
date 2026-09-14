"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api";
import { OBJETIVOS, DESTINOS_CONVERSA, type ObjetivoCampanha } from "@/lib/objetivos";

interface Criativo {
  id: string;
  urlArquivo: string;
  tipo: "IMAGEM" | "VIDEO";
}

type DestinoConversa = (typeof DESTINOS_CONVERSA)[number]["valor"];

export default function PaginaNovaCampanha() {
  const router = useRouter();

  const [criativo, setCriativo] = useState<Criativo | null>(null);
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);

  const [valorInvestido, setValorInvestido] = useState("");
  const [objetivo, setObjetivo] = useState<ObjetivoCampanha | null>(null);
  const [destinoConversa, setDestinoConversa] = useState<DestinoConversa | "">("");

  const [publicoSugeridoPelaIa, setPublicoSugeridoPelaIa] = useState(true);
  const [idadeMin, setIdadeMin] = useState("18");
  const [idadeMax, setIdadeMax] = useState("65");
  const [localizacao, setLocalizacao] = useState("");

  const [enviandoCampanha, setEnviandoCampanha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function aoSelecionarArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;

    setErro(null);
    setEnviandoArquivo(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      const criado = await apiFetch<Criativo>("/criativos/upload", {
        method: "POST",
        body: formData,
      });
      setCriativo(criado);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Falha ao enviar o criativo.");
    } finally {
      setEnviandoArquivo(false);
    }
  }

  async function aoEnviarCampanha(evento: React.FormEvent) {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!criativo) {
      setErro("Envie um criativo antes de continuar.");
      return;
    }
    if (!objetivo) {
      setErro("Escolha o objetivo da campanha.");
      return;
    }

    const valorCentavos = Math.round(Number(valorInvestido.replace(",", ".")) * 100);
    if (!valorCentavos || valorCentavos <= 0) {
      setErro("Informe um valor de investimento válido.");
      return;
    }

    const publicoAlvo = publicoSugeridoPelaIa
      ? { sugeridoPelaIa: true }
      : {
          sugeridoPelaIa: false,
          idadeMin: Number(idadeMin),
          idadeMax: Number(idadeMax),
          localizacao,
        };

    setEnviandoCampanha(true);
    try {
      await apiFetch("/campanhas", {
        method: "POST",
        body: {
          criativoId: criativo.id,
          objetivo,
          valorInvestidoCentavos: valorCentavos,
          publicoAlvo,
          destinoConversa: objetivo === "ENGAJAMENTO" && destinoConversa ? destinoConversa : undefined,
        },
      });
      setSucesso("Campanha enviada! A IA vai analisar o criativo e publicar automaticamente.");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Falha ao criar a campanha.");
    } finally {
      setEnviandoCampanha(false);
    }
  }

  return (
    <main className="flex-1 bg-nuvra-paper min-h-screen py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-nuvra-navy">Nova campanha</h1>
        <p className="text-nuvra-navy/60 text-sm mt-1 mb-8">
          Preencha as informações abaixo. A Nuvra.AI analisa o criativo e publica a campanha
          automaticamente na sua conta de anúncio.
        </p>

        <form onSubmit={aoEnviarCampanha} className="space-y-8">
          <section>
            <h2 className="font-medium text-nuvra-navy mb-2">1. Criativo</h2>
            <label
              htmlFor="arquivo"
              className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-nuvra-blue/40 bg-white p-8 text-center cursor-pointer hover:border-nuvra-blue"
            >
              {criativo ? (
                criativo.tipo === "IMAGEM" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={criativo.urlArquivo}
                    alt="Criativo enviado"
                    className="max-h-48 rounded-lg object-contain"
                  />
                ) : (
                  <video src={criativo.urlArquivo} className="max-h-48 rounded-lg" controls />
                )
              ) : (
                <span className="text-nuvra-navy/60 text-sm">
                  {enviandoArquivo ? "Enviando..." : "Clique para enviar uma imagem ou vídeo"}
                </span>
              )}
              <input
                id="arquivo"
                type="file"
                accept="image/*,video/*"
                onChange={aoSelecionarArquivo}
                className="hidden"
                disabled={enviandoArquivo}
              />
            </label>
          </section>

          <section>
            <h2 className="font-medium text-nuvra-navy mb-2">2. Valor a investir</h2>
            <div className="flex items-center rounded-lg border border-nuvra-navy/15 bg-white px-3">
              <span className="text-nuvra-navy/50 mr-1">R$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={valorInvestido}
                onChange={(e) => setValorInvestido(e.target.value)}
                className="w-full py-2.5 outline-none text-nuvra-navy"
              />
            </div>
          </section>

          <section>
            <h2 className="font-medium text-nuvra-navy mb-2">3. Público-alvo</h2>
            <label className="flex items-center gap-2 mb-3 text-sm text-nuvra-navy">
              <input
                type="checkbox"
                checked={publicoSugeridoPelaIa}
                onChange={(e) => setPublicoSugeridoPelaIa(e.target.checked)}
                className="accent-[#1747E9]"
              />
              Deixar a IA sugerir o público ideal com base no criativo e histórico
            </label>

            {!publicoSugeridoPelaIa && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-nuvra-navy/15 bg-white p-4">
                <div>
                  <label className="block text-xs text-nuvra-navy/60 mb-1">Idade mínima</label>
                  <input
                    type="number"
                    min={13}
                    max={65}
                    value={idadeMin}
                    onChange={(e) => setIdadeMin(e.target.value)}
                    className="w-full rounded border border-nuvra-navy/15 px-2 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-nuvra-navy/60 mb-1">Idade máxima</label>
                  <input
                    type="number"
                    min={13}
                    max={65}
                    value={idadeMax}
                    onChange={(e) => setIdadeMax(e.target.value)}
                    className="w-full rounded border border-nuvra-navy/15 px-2 py-1.5"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-nuvra-navy/60 mb-1">
                    Localização (cidade, estado ou país)
                  </label>
                  <input
                    type="text"
                    value={localizacao}
                    onChange={(e) => setLocalizacao(e.target.value)}
                    className="w-full rounded border border-nuvra-navy/15 px-2 py-1.5"
                  />
                </div>
              </div>
            )}
          </section>

          <section>
            <h2 className="font-medium text-nuvra-navy mb-2">4. Objetivo da campanha</h2>
            <div className="space-y-2">
              {OBJETIVOS.map((o) => (
                <label
                  key={o.valor}
                  className={`block rounded-lg border px-4 py-3 cursor-pointer transition bg-white ${
                    objetivo === o.valor ? "border-nuvra-blue ring-1 ring-nuvra-blue" : "border-nuvra-navy/15"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-nuvra-navy text-sm">{o.titulo}</span>
                    <input
                      type="radio"
                      name="objetivo"
                      checked={objetivo === o.valor}
                      onChange={() => setObjetivo(o.valor)}
                      className="accent-[#1747E9]"
                    />
                  </div>
                  <p className="text-xs text-nuvra-navy/60 mt-1">{o.descricao}</p>

                  {o.valor === "VENDAS" && (
                    <p className="text-xs text-nuvra-blue-medium bg-nuvra-blue/10 rounded px-2 py-1.5 mt-2">
                      Recomendado para quem já possui um rastreamento avançado configurado (Pixel +
                      API de Conversões). Sem isso, o resultado tende a ser menos preciso. Não tem
                      essa configuração? Fale com a Nuvra, podemos configurar isso para você.
                    </p>
                  )}

                  {o.valor === "ENGAJAMENTO" && objetivo === "ENGAJAMENTO" && (
                    <div className="mt-3 pt-3 border-t border-nuvra-navy/10">
                      <span className="block text-xs text-nuvra-navy/60 mb-1">
                        Para onde as conversas devem ir?
                      </span>
                      <div className="flex gap-2">
                        {DESTINOS_CONVERSA.map((d) => (
                          <button
                            type="button"
                            key={d.valor}
                            onClick={() => setDestinoConversa(d.valor)}
                            className={`text-xs rounded-full px-3 py-1 border ${
                              destinoConversa === d.valor
                                ? "bg-nuvra-blue text-white border-nuvra-blue"
                                : "border-nuvra-navy/20 text-nuvra-navy/70"
                            }`}
                          >
                            {d.titulo}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </label>
              ))}
            </div>
          </section>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {sucesso && <p className="text-sm text-green-700">{sucesso}</p>}

          <button
            type="submit"
            disabled={enviandoCampanha || enviandoArquivo}
            className="w-full rounded-lg bg-nuvra-blue py-3 font-medium text-white transition hover:bg-nuvra-blue-medium disabled:opacity-60"
          >
            {enviandoCampanha ? "Enviando..." : "Publicar campanha"}
          </button>
        </form>
      </div>
    </main>
  );
}
