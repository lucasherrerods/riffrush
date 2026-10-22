import { motion } from "framer-motion";
import { cn } from "@/shared/lib/utils";

/** O medidor de rock: vermelho embaixo (perdendo), verde em cima (mandando bem). */
export function MedidorDeVida({ vida, horizontal = false, rotulo = "Vida", className }: { vida: number; horizontal?: boolean; rotulo?: string; className?: string }) {
  return (
    <div
      role="meter"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(vida * 100)}
      className={cn("relative overflow-hidden rounded-full from-perigo via-ouro to-sucesso", horizontal ? "bg-gradient-to-r" : "bg-gradient-to-t", className)}
    >
      <motion.div
        className={cn("absolute bg-texto", horizontal ? "top-0 h-full w-1.5 -translate-x-1/2" : "left-0 h-1.5 w-full translate-y-1/2")}
        animate={horizontal ? { left: `${vida * 100}%` } : { bottom: `${vida * 100}%` }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
      />
    </div>
  );
}
