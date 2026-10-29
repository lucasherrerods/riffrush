import { Loader2 } from "lucide-react";
import { IconeDoJeito, NOMES_DOS_JEITOS } from "@/modules/rock/gameplay";
import type { Dificuldade, Instrumento } from "@/modules/rock/songs";
import type { PosicaoNoRanking } from "./api";
import { haQuantoTempo, porcentagem } from "@/shared/lib/formatar";
import { LinhaComPosicao } from "./LinhaComPosicao";
import { SeloDaNota } from "@/shared/ui/SeloDaNota";
import { useRanking, type OpcoesDoRanking } from "./useRanking";

interface Props extends OpcoesDoRanking {
  /** O id da música no ranking (`idDoRanking` do módulo songs). */
  musicaId: string;
  dificuldade: Dificuldade;
  /** Sem ele, o ranking da guitarra. */
  instrumento?: Instrumento;
  /** Clicar numa linha abre a partida dela. */
  aoAbrirPartida?: (partidaId: string) => void;
}

const formatar = (n: number) => n.toLocaleString("pt-BR");

/** O ranking da música selecionada, como no osu!: o top rolável e o recorde pessoal fixo embaixo. */
export function PainelDeRanking({ musicaId, dificuldade, instrumento = "guitarra", aoAbrirPartida, ...opcoes }: Props) {
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
        <ol aria-label="Ranking" className="flex min-h-0 flex-1 flex-col gap-1 pr-1 rolagem-de-toque">
          {top.map((linha) => (
            <LinhaDoRanking key={linha.posicao} linha={linha} minha={!!meu && meu.posicao === linha.posicao} aoAbrir={aoAbrirPartida} />
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
            <LinhaDoRanking linha={meu} minha aoAbrir={aoAbrirPartida} />
          </ol>
        </section>
      )}
    </div>
  );
}

function LinhaDoRanking({ linha, minha, aoAbrir }: { linha: PosicaoNoRanking; minha: boolean; aoAbrir?: (partidaId: string) => void }) {
  return (
    <LinhaComPosicao
      posicao={linha.posicao}
      nome={linha.nome}
      avatar={linha.avatar}
      minha={minha}
      selo={<SeloDaNota precisao={linha.precisao} />}
      detalhe={
        <span className="inline-flex items-center gap-2">
          {linha.jeito_de_jogar && (
            <IconeDoJeito jeito={linha.jeito_de_jogar} rotulo={`Jogou no ${NOMES_DOS_JEITOS[linha.jeito_de_jogar]}`} className="size-4 shrink-0 opacity-70" />
          )}
          {`${porcentagem(linha.precisao)} · ${haQuantoTempo(linha.jogada_em)}`}
        </span>
      }
      valor={formatar(linha.pontos)}
      aoClicar={aoAbrir && (() => aoAbrir(linha.partida_id))}
    />
  );
}
