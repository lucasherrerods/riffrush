import { useEffect, useState } from "react";
import { PlayCircle } from "lucide-react";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/lib/utils";
import { siglasDosMods } from "../gameplay/mods";
import { apiDoRanking, type PosicaoNoRankingDoMania } from "./api";

interface Props {
  beatmapId: number;
  /** Para os testes. */
  buscar?: (beatmapId: number, todas?: boolean, sinal?: AbortSignal) => Promise<PosicaoNoRankingDoMania[]>;
  /** Assistir ao replay de uma linha; sem ele (mapa fora da biblioteca), o botão não aparece. */
  aoAssistir?: (linha: PosicaoNoRankingDoMania) => void;
}

/** Só o top 10 de cada mapa guarda replay: a linha de quem pede, fora dele, e as partidas fora do ranking não têm o que assistir. */
const TOP_COM_REPLAY = 10;

/** O top 10 da dificuldade escolhida na seleção. */
export function PainelDoRankingDoMania({ beatmapId, buscar = apiDoRanking.ranking, aoAssistir }: Props) {
  const [linhas, setLinhas] = useState<PosicaoNoRankingDoMania[] | null>(null);
  const [erro, setErro] = useState(false);
  // Por padrão aparecem todas as partidas; o filtro deixa só as que valem ranking.
  const [soRanqueadas, setSoRanqueadas] = useState(false);

  useEffect(() => {
    const controle = new AbortController();
    setLinhas(null);
    setErro(false);
    buscar(beatmapId, !soRanqueadas, controle.signal)
      .then(setLinhas)
      .catch(() => !controle.signal.aborted && setErro(true));
    return () => controle.abort();
  }, [beatmapId, buscar, soRanqueadas]);

  return (
    <section aria-label="Ranking da dificuldade" className="flex flex-col gap-2 rounded-md border border-borda bg-superficie p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-titulo text-xl tracking-wide">Ranking</h2>
        <label className="flex items-center gap-2 text-sm text-texto-suave">
          Só as que valem ranking
          <Switch aria-label="Só as que valem ranking" checked={soRanqueadas} onCheckedChange={setSoRanqueadas} />
        </label>
      </div>
      {erro && <p className="text-texto-suave">Não foi possível carregar o ranking.</p>}
      {!erro && linhas === null && <p className="text-texto-suave">Carregando…</p>}
      {linhas?.length === 0 && <p className="text-texto-suave">Ninguém jogou ainda. Seja o primeiro!</p>}
      {!!linhas?.length && (
        <ol className="flex flex-col gap-1">
          {linhas.map((l) => (
            <li key={l.partida_id} className={cn("grid items-baseline gap-3", aoAssistir ? "grid-cols-[2rem_1fr_auto_auto_2rem]" : "grid-cols-[2rem_1fr_auto_auto]")}>
              <span className="font-titulo text-lg text-texto-suave">{l.posicao}</span>
              <span className="truncate">
                {l.nome}
                {l.mods > 0 && <span className="ml-2 text-sm text-texto-suave">{siglasDosMods(l.mods).join(" ")}</span>}
                {!l.vale_ranking && <span className="ml-2 text-sm text-texto-suave">fora do ranking</span>}
              </span>
              <span className="text-texto-suave">{(l.precisao * 100).toFixed(2).replace(".", ",")}%</span>
              <span className="font-titulo text-lg">{l.pontuacao.toLocaleString("pt-BR")}</span>
              {aoAssistir &&
                (l.vale_ranking && l.posicao <= TOP_COM_REPLAY ? (
                  <button type="button" onClick={() => aoAssistir(l)} aria-label={`Assistir ao replay de ${l.nome}`} className="self-center text-primaria hover:text-texto">
                    <PlayCircle className="size-5" aria-hidden />
                  </button>
                ) : (
                  <span />
                ))}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
