import { Placar } from "@/modules/multiplayer";
import { comoPorcentagem } from "../gameplay/estatisticas";
import type { EstadoDaSalaDoMania, JogadaDoMania } from "./protocolo";

interface Props {
  sala: Pick<EstadoDaSalaDoMania, "jogadores" | "adversarios" | "meuId">;
  /** O meu placar, que não volta pela rede. */
  eu: JogadaDoMania;
  aoVivo?: boolean;
}

/** O placar neutro com a pontuação e a precisão de cada jogador do Mania. */
export function PlacarDaSalaMania({ sala, eu, aoVivo }: Props) {
  const linhas = sala.jogadores.map((jogador) => {
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
  return <Placar linhas={linhas} rotuloDaDerrota="Falhou" aoVivo={aoVivo} />;
}
