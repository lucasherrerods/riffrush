import { motion } from "framer-motion";
import { Crown, Loader2 } from "lucide-react";
import { Avatar } from "@/modules/character";
import { cn } from "@/shared/lib/utils";
import type { EstadoDaSala } from "../protocolo";

interface Props {
  sala: EstadoDaSala;
  meusPontos: number;
  minhaDerrota: boolean;
}

/** O placar da sala no fim da partida, atualizado ao vivo enquanto os outros terminam. */
export function Placar({ sala, meusPontos, minhaDerrota }: Props) {
  const linhas = sala.jogadores
    .map((jogador) => {
      const meu = jogador.id === sala.meuId;
      const estado = sala.adversarios[jogador.id];
      return {
        id: jogador.id,
        personagem: jogador.personagem,
        meu,
        pontos: meu ? meusPontos : (estado?.pontos ?? 0),
        derrota: meu ? minhaDerrota : !!estado?.derrota,
        terminou: meu || !!estado?.terminou,
      };
    })
    .sort((a, b) => b.pontos - a.pontos);
  const esperando = linhas.some((l) => !l.terminou);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {linhas.map((linha, i) => (
          <motion.li
            key={linha.id}
            layout
            className={cn("chapa flex items-center gap-4 p-2 pr-4", linha.meu ? "border-primaria bg-superficie-elevada" : "border-borda bg-superficie")}
          >
            <span className="w-8 text-center text-2xl font-black text-texto-suave">{i + 1}º</span>
            <Avatar personagem={linha.personagem} tocando={!linha.terminou} triste={linha.derrota} className="h-14 w-auto" />
            <span className="flex flex-1 items-center gap-2 truncate text-base font-bold">
              <span>{linha.personagem.nome}</span>
              {i === 0 && !esperando && <Crown aria-label="Vencedor" className="size-4 text-ouro" />}
            </span>
            {linha.derrota && <span className="text-base font-bold text-perigo">Vaiado</span>}
            {!linha.terminou && <Loader2 className="size-4 animate-spin text-texto-suave" aria-label="Ainda tocando" />}
            <span className="font-mono text-xl font-black tabular-nums">{linha.pontos.toLocaleString("pt-BR")}</span>
          </motion.li>
        ))}
      </ol>
      {esperando && <p className="text-center text-base text-texto-suave">Esperando os outros terminarem...</p>}
    </div>
  );
}
