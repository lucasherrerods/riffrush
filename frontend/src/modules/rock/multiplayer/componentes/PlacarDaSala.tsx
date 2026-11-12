import { Placar } from "@/modules/multiplayer";
import { Avatar } from "@/modules/rock/character";
import type { EstadoDaSala } from "../protocolo";

interface Props {
  sala: EstadoDaSala;
  meusPontos: number;
  minhaDerrota: boolean;
  meuFantasma?: boolean;
}

/** O placar neutro com os jogadores e os personagens da sala do Rock. */
export function PlacarDaSala({ sala, meusPontos, minhaDerrota, meuFantasma = false }: Props) {
  const linhas = sala.jogadores.map((jogador) => {
    const meu = jogador.id === sala.meuId;
    const estado = sala.adversarios[jogador.id];
    const terminou = meu || !!estado?.terminou;
    const derrota = meu ? minhaDerrota : !!estado?.derrota;
    return {
      id: jogador.id,
      nome: jogador.personagem.nome,
      avatar: <Avatar personagem={jogador.personagem} tocando={!terminou} triste={derrota} className="h-14 w-auto" />,
      meu,
      pontos: meu ? meusPontos : (estado?.pontos ?? 0),
      derrota,
      fantasma: meu ? meuFantasma : !!estado?.fantasma,
      terminou,
    };
  });
  return <Placar linhas={linhas} />;
}
