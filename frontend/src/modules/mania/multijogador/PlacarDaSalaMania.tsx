import { Placar, PlacarAoVivo } from "@/modules/multiplayer";
import { comoPorcentagem } from "../gameplay/estatisticas";
import type { EstadoDaSalaDoMania, JogadaDoMania } from "./protocolo";

interface Props {
  sala: Pick<EstadoDaSalaDoMania, "jogadores" | "adversarios" | "meuId">;
  /** O meu placar, que não volta pela rede. */
  eu: JogadaDoMania;
  aoVivo?: boolean;
}

/** As linhas de cada jogador: a minha jogada vem de `eu`, a dos outros da rede. */
function linhasDoMania(sala: Props["sala"], eu: JogadaDoMania | undefined) {
  return sala.jogadores.map((jogador) => {
    const meu = jogador.id === sala.meuId;
    const jogada = meu ? eu : sala.adversarios[jogador.id];
    return {
      id: jogador.id,
      nome: jogador.personagem.nome,
      meu,
      pontos: Number(jogada?.pontos) || 0,
      detalhe: jogada ? comoPorcentagem(Math.min(1, Math.max(0, Number(jogada.precisao) || 0))) : undefined,
      derrota: !!jogada?.derrota,
      fantasma: false,
      terminou: !!jogada?.terminou,
    };
  });
}

/** O placar neutro com a pontuação e a precisão de cada jogador do Mania. */
export function PlacarDaSalaMania({ sala, eu, aoVivo }: Props) {
  const linhas = linhasDoMania(sala, eu);
  return <Placar linhas={linhas} rotuloDaDerrota="Falhou" aoVivo={aoVivo} />;
}

/** Durante a partida: a posição de todos, eu incluído, com a precisão de cada um. */
export function PlacarAoVivoDoMania({ sala }: { sala: Pick<EstadoDaSalaDoMania, "jogadores" | "adversarios" | "meuId" | "minhaJogada"> }) {
  const linhas = linhasDoMania(sala, sala.minhaJogada).map((l) => ({ ...l, extra: l.detalhe && <p className="font-mono text-sm text-texto-suave tabular-nums">{l.detalhe}</p> }));
  return <PlacarAoVivo linhas={linhas} />;
}
