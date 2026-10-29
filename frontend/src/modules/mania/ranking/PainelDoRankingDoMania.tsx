import { useEffect, useState } from "react";
import { siglasDosMods } from "../gameplay/mods";
import { apiDoRanking, type PosicaoNoRankingDoMania } from "./api";

interface Props {
  beatmapId: number;
  /** Para os testes. */
  buscar?: (beatmapId: number, sinal?: AbortSignal) => Promise<PosicaoNoRankingDoMania[]>;
}

/** O top 10 da dificuldade escolhida na seleção. */
export function PainelDoRankingDoMania({ beatmapId, buscar = apiDoRanking.ranking }: Props) {
  const [linhas, setLinhas] = useState<PosicaoNoRankingDoMania[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    const controle = new AbortController();
    setLinhas(null);
    setErro(false);
    buscar(beatmapId, controle.signal)
      .then(setLinhas)
      .catch(() => !controle.signal.aborted && setErro(true));
    return () => controle.abort();
  }, [beatmapId, buscar]);

  return (
    <section aria-label="Ranking da dificuldade" className="flex flex-col gap-2 rounded-md border border-borda bg-superficie p-4">
      <h2 className="font-titulo text-xl tracking-wide">Ranking</h2>
      {erro && <p className="text-texto-suave">Não foi possível carregar o ranking.</p>}
      {!erro && linhas === null && <p className="text-texto-suave">Carregando…</p>}
      {linhas?.length === 0 && <p className="text-texto-suave">Ninguém jogou ainda. Seja o primeiro!</p>}
      {!!linhas?.length && (
        <ol className="flex flex-col gap-1">
          {linhas.map((l) => (
            <li key={l.partida_id} className="grid grid-cols-[2rem_1fr_auto_auto] items-baseline gap-3">
              <span className="font-titulo text-lg text-texto-suave">{l.posicao}</span>
              <span className="truncate">
                {l.nome}
                {l.mods > 0 && <span className="ml-2 text-sm text-texto-suave">{siglasDosMods(l.mods).join(" ")}</span>}
              </span>
              <span className="text-texto-suave">{(l.precisao * 100).toFixed(2).replace(".", ",")}%</span>
              <span className="font-titulo text-lg">{l.pontuacao.toLocaleString("pt-BR")}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
