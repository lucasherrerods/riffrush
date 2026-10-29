import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/shared/lib/utils";

export type ModoDaAlavanca = "rock" | "mania";

interface Props {
  modo: ModoDaAlavanca;
  aoTrocar: (modo: ModoDaAlavanca) => void;
  className?: string;
}

const ROTULOS: Record<ModoDaAlavanca, string> = { rock: "Rock", mania: "Mania" };

/** A alavanca da tela inicial: para cima é o Rock, para baixo o Mania. Girar troca o jogo inteiro. */
export function AlavancaDeModo({ modo, aoTrocar, className }: Props) {
  const semMovimento = useReducedMotion();
  const mania = modo === "mania";
  const trocar = (para: ModoDaAlavanca) => para !== modo && aoTrocar(para);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className={cn("font-titulo text-lg tracking-wide transition-opacity", mania ? "opacity-50" : "opacity-100")}>Rock</span>
      <button
        type="button"
        role="switch"
        aria-checked={mania}
        aria-label={`Modo de jogo: ${ROTULOS[modo]}`}
        title={`Girar para o ${mania ? "Rock" : "Mania"}`}
        onClick={() => trocar(mania ? "rock" : "mania")}
        onKeyDown={(evento) => {
          if (evento.key === "ArrowRight" || evento.key === "ArrowDown") trocar("mania");
          else if (evento.key === "ArrowLeft" || evento.key === "ArrowUp") trocar("rock");
          else return;
          evento.preventDefault();
        }}
        className="relative h-10 w-20 rounded-full border border-borda bg-superficie-elevada outline-offset-4"
      >
        {/* A base da alavanca, presa no meio, e o cabo que gira de um lado para o outro. */}
        <span aria-hidden className="absolute top-1/2 left-1/2 size-4 -translate-1/2 rounded-full bg-borda" />
        <motion.span
          aria-hidden
          className="absolute top-1/2 left-1/2 h-1.5 w-8 origin-left -translate-y-1/2 rounded-full bg-texto-suave"
          initial={false}
          animate={{ rotate: mania ? 0 : 180 }}
          transition={semMovimento ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 18 }}
        >
          <span className="absolute top-1/2 right-0 size-5 translate-x-1/2 -translate-y-1/2 rounded-full bg-primaria" />
        </motion.span>
      </button>
      <span className={cn("font-titulo text-lg tracking-wide transition-opacity", mania ? "opacity-100" : "opacity-50")}>Mania</span>
    </div>
  );
}
