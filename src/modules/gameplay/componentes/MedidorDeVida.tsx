import { motion } from "framer-motion";
import { Ghost } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface Props {
  vida: number;
  horizontal?: boolean;
  rotulo?: string;
  /** Multijogador: a vida já zerou nesta música. */
  fantasma?: boolean;
  className?: string;
}

/** O medidor de rock: vermelho embaixo (perdendo), verde em cima (mandando bem). */
export function MedidorDeVida({ vida, horizontal = false, rotulo = "Vida", fantasma = false, className }: Props) {
  return (
    <div className={cn("relative", className)}>
      <div
        role="meter"
        aria-label={rotulo}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(vida * 100)}
        className={cn("relative size-full overflow-hidden rounded-full from-perigo via-ouro to-sucesso", horizontal ? "bg-gradient-to-r" : "bg-gradient-to-t")}
      >
        <motion.div
          className={cn("absolute bg-texto", horizontal ? "top-0 h-full w-1.5 -translate-x-1/2" : "left-0 h-1.5 w-full translate-y-1/2")}
          animate={horizontal ? { left: `${vida * 100}%` } : { bottom: `${vida * 100}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        />
      </div>
      {fantasma && (
        <Ghost
          aria-label="Virou fantasma"
          className={cn("absolute size-4 text-texto opacity-70", horizontal ? "top-1/2 -right-5 -translate-y-1/2" : "-top-6 left-1/2 -translate-x-1/2")}
        />
      )}
    </div>
  );
}
