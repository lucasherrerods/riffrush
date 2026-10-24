import { Loader2 } from "lucide-react";
import type { Dificuldade, Instrumento } from "@/modules/songs";
import type { PosicaoNoRanking } from "./api";
import { haQuantoTempo, precisaoDaPartida } from "@/shared/lib/formatar";
import { LinhaComPosicao } from "./LinhaComPosicao";
import { useRanking, type OpcoesDoRanking } from "./useRanking";

interface Props extends OpcoesDoRanking {
  /** O id da música no ranking (`idDoRanking` do módulo songs). */
  musicaId: string;
  dificuldade: Dificuldade;
  /** Sem ele, o ranking da guitarra. */
  instrumento?: Instrumento;
}

const formatar = (n: number) => n.toLocaleString("pt-BR");

/** O ranking da música selecionada, como no osu!: o top rolável e o recorde pessoal fixo embaixo. */
export function PainelDeRanking({ musicaId, dificuldade, instrumento = "guitarra", ...opcoes }: Props) {
  const estado = useRanking(musicaId, dificuldade, instrumento, opcoes);

  if (estado.tipo === "carregando") {
    return (
      <p className="flex items-center gap-2 p-4 text-base text-texto-suave">
        <Loader2 className="size-4 animate-spin opacity-70" aria-hidden /> Carregando o ranking...
      </p>
    );
  }
  if (estado.tipo === "erro") {
    return (
      <p role="alert" className="p-4 text-base text-texto-suave">
        Não deu para carregar o ranking.
      </p>
    );
  }

  const { top, meu, jogadores } = estado.ranking;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {top.length ? (
        <ol aria-label="Ranking" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pr-1">
          {top.map((linha) => (
            <LinhaDoRanking key={linha.posicao} linha={linha} minha={!!meu && meu.posicao === linha.posicao} />
          ))}
        </ol>
      ) : (
        <p className="flex-1 p-4 text-base text-texto-suave">Ninguém terminou esta música nesta dificuldade ainda. Seja o primeiro!</p>
      )}
      {meu && (
        <section aria-label="Recorde pessoal" className="flex flex-col gap-1">
          <p className="px-2 text-base text-texto-suave">
            Recorde pessoal (#{formatar(meu.posicao)} de {formatar(jogadores)})
          </p>
          <ol>
            <LinhaDoRanking linha={meu} minha />
          </ol>
        </section>
      )}
    </div>
  );
}

function LinhaDoRanking({ linha, minha }: { linha: PosicaoNoRanking; minha: boolean }) {
  return (
    <LinhaComPosicao
      posicao={linha.posicao}
      nome={linha.nome}
      avatar={linha.avatar}
      minha={minha}
      detalhe={`${precisaoDaPartida(linha.acertos, linha.total)} · ${haQuantoTempo(linha.jogada_em)}`}
      valor={formatar(linha.pontos)}
    />
  );
}
