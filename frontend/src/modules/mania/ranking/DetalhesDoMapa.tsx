import { useState } from "react";
import { AcaoDaBusca, ItemDaBusca } from "@/modules/busca";
import { useCarregamento } from "@/shared/hooks/useCarregamento";
import { formatarDuracao } from "@/shared/lib/formatar";
import { ComCarregamento } from "@/shared/ui/ComCarregamento";
import { baixarOsz, buscarConjunto as buscarConjuntoPadrao, type DificuldadeDaBusca, type MapaDaBusca } from "../busca/api";

export interface PropsDoDownload {
  /** Os conjuntos que já estão na biblioteca, pelo beatmapset_id. */
  baixados?: Set<number>;
  aoBaixar?: (osz: Blob, mapa: MapaDaBusca) => Promise<void>;
  aoJogar?: (beatmapsetId: number) => void;
  /** Para os testes. */
  buscarConjunto?: (beatmapsetId: number, sinal: AbortSignal) => Promise<MapaDaBusca | null>;
  baixar?: typeof baixarOsz;
}

const numero = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** Os números da dificuldade, só os que o espelho mandou. */
export function especificacoes(d: DificuldadeDaBusca): string[] {
  return [
    `${d.teclas}K`,
    `${d.estrelas.toFixed(2).replace(".", ",")}★`,
    formatarDuracao(d.duracaoS * 1000),
    d.bpm !== undefined && `${numero(Math.round(d.bpm))} BPM`,
    d.od !== undefined && `OD ${numero(d.od)}`,
    d.hp !== undefined && `HP ${numero(d.hp)}`,
    d.notas !== undefined && `${numero(d.notas)} notas`,
  ].filter((s): s is string => Boolean(s));
}

/** O conjunto do mapa aberto no leaderboard: capa, números da dificuldade e o botão de baixar ou jogar. */
export function DetalhesDoMapa({
  beatmapsetId,
  beatmapId,
  baixados = new Set(),
  aoBaixar,
  aoJogar,
  buscarConjunto = (id, sinal) => buscarConjuntoPadrao(id, undefined, sinal),
  baixar = baixarOsz,
}: PropsDoDownload & { beatmapsetId: number; beatmapId: number }) {
  const { estado, tentarDeNovo } = useCarregamento((sinal) => buscarConjunto(beatmapsetId, sinal), beatmapsetId);
  const [progresso, setProgresso] = useState<number>();
  const [erro, setErro] = useState<string>();

  const baixarConjunto = async (mapa: MapaDaBusca) => {
    setErro(undefined);
    setProgresso(0);
    try {
      const osz = await baixar(mapa.beatmapsetId, { aoProgredir: setProgresso });
      await aoBaixar?.(osz, mapa);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setProgresso(undefined);
    }
  };

  return (
    <ComCarregamento estado={estado} tentarDeNovo={tentarDeNovo} oQue="o mapa">
      {(mapa) => {
        if (!mapa) return null;
        const dificuldade = mapa.dificuldades.find((d) => d.beatmapId === beatmapId);
        return (
          <div className="flex flex-col gap-2">
            <ul>
              <ItemDaBusca
                titulo={mapa.tituloUnicode}
                capa={mapa.capa}
                linhas={[`${mapa.artistaUnicode} · mapa de ${mapa.mapper} · ${mapa.status}`]}
                progresso={progresso}
                acao={
                  <AcaoDaBusca
                    nome={mapa.titulo}
                    estado={
                      baixados.has(mapa.beatmapsetId)
                        ? { tipo: "baixado", aoJogar: aoJogar && (() => aoJogar(mapa.beatmapsetId)) }
                        : progresso !== undefined
                          ? { tipo: "baixando" }
                          : { tipo: "baixavel", aoBaixar: () => void baixarConjunto(mapa), ocupado: !aoBaixar }
                    }
                  />
                }
              />
            </ul>
            {dificuldade && (
              <ul aria-label="Sobre o mapa" className="flex flex-wrap gap-2 text-sm text-texto-suave">
                {especificacoes(dificuldade).map((s) => (
                  <li key={s} className="rounded-md border border-borda px-2 py-1">
                    {s}
                  </li>
                ))}
              </ul>
            )}
            {erro && <p className="text-sm text-perigo">{erro}</p>}
          </div>
        );
      }}
    </ComCarregamento>
  );
}
