import { PlacarAoVivo } from "@/modules/multiplayer";
import { Avatar, reacaoDoFimDaPartida } from "@/modules/rock/character";
import { MedidorDeVida } from "@/modules/rock/gameplay";
import type { EstadoDaSala } from "../protocolo";

const VIDA_INICIAL = 0.5;
const VIDA_BAIXA = 0.25;

/** Acertos seguidos do jogador; some quando ele erra e a sequência zera. */
function Sequencia({ nome, sequencia = 0 }: { nome: string; sequencia?: number }) {
  if (sequencia <= 0) return null;
  return (
    <span aria-label={`Sequência de ${nome}`} className="font-mono font-bold text-primaria tabular-nums">
      {sequencia}x
    </span>
  );
}

/**
 * O placar ao vivo do Rock: todos da sala, eu incluído, na ordem dos pontos, com o chibi e a vida de cada um.
 * No celular (`compacto`) cada linha fica curta, para não cobrir a pista.
 */
export function Adversarios({ sala, compacto = false }: { sala: EstadoDaSala; compacto?: boolean }) {
  const linhas = sala.jogadores.map((jogador) => {
    const meu = jogador.id === sala.meuId;
    const estado = meu ? sala.minhaJogada : sala.adversarios[jogador.id];
    const vida = estado?.vida ?? VIDA_INICIAL;
    const nome = jogador.personagem.nome;
    return {
      id: jogador.id,
      nome,
      meu,
      pontos: estado?.pontos ?? 0,
      derrota: !!estado?.derrota,
      extra: (
        <div className="flex items-center gap-2">
          {!compacto && (
            <Avatar personagem={jogador.personagem} tocando={!!estado && !estado.terminou} pulso={estado?.pulso ?? 0} triste={vida < VIDA_BAIXA} reacao={estado ? reacaoDoFimDaPartida(estado) : null} className="h-10 w-auto" />
          )}
          <div className="min-w-0 flex-1">
            <Sequencia nome={nome} sequencia={estado?.sequencia} />
            <MedidorDeVida vida={vida} fantasma={estado?.fantasma} horizontal rotulo={`Vida de ${nome}`} className={compacto ? "h-1 w-full" : "mt-1 h-2 w-full"} />
          </div>
        </div>
      ),
    };
  });
  return <PlacarAoVivo linhas={linhas} compacto={compacto} rotuloDaDerrota="Vaiado" />;
}
