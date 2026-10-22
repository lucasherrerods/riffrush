import { motion } from "framer-motion";
import { Chibi } from "@/modules/character";
import { MedidorDeVida } from "@/modules/gameplay";
import { cn } from "@/shared/lib/utils";
import type { EstadoDaSala } from "../protocolo";

const VIDA_INICIAL = 0.5;
const VIDA_BAIXA = 0.25;

/** Os outros jogadores durante a partida: chibi, pontos e vida ao vivo (sem a pista deles). */
export function Adversarios({ sala }: { sala: EstadoDaSala }) {
  const outros = sala.jogadores.filter((j) => j.id !== sala.meuId);
  if (!outros.length) return null;
  return (
    <ul className="absolute top-1/2 left-6 flex -translate-y-1/2 flex-col gap-2" aria-label="Adversários">
      {outros.map((jogador) => {
        const estado = sala.adversarios[jogador.id];
        const vida = estado?.vida ?? VIDA_INICIAL;
        return (
          <motion.li
            key={jogador.id}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn("flex w-56 items-center gap-2 rounded-2xl border border-borda bg-superficie p-2", estado?.derrota && "opacity-60")}
          >
            <Chibi personagem={jogador.personagem} tocando={!!estado && !estado.terminou} pulso={estado?.pulso ?? 0} triste={vida < VIDA_BAIXA} className="h-16 w-auto" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-bold">{jogador.personagem.nome}</p>
              <p className="font-mono text-base font-black tabular-nums">{(estado?.pontos ?? 0).toLocaleString("pt-BR")}</p>
              <MedidorDeVida vida={vida} horizontal rotulo={`Vida de ${jogador.personagem.nome}`} className="mt-1 h-2 w-full" />
              {estado?.derrota && <p className="text-base font-bold text-perigo">Vaiado</p>}
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
