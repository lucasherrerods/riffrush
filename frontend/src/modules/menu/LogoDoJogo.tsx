import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { cn } from "@/shared/lib/utils";

/** "Riff ⚡ Rush" com o nome do modo embaixo. As cores vêm do tema, então a logo muda junto com o modo. */
export function LogoDoJogo({ modo, pequena = false }: { modo: string; pequena?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <h1
        aria-label={`Riff Rush ${modo}`}
        className={cn("titulo-do-jogo flex items-center gap-2 leading-none tracking-[0.01em]", pequena ? "text-3xl" : "text-6xl max-md:text-[14vw]")}
      >
        Riff
        <motion.span animate={{ rotate: [-6, 6, -6] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}>
          <Zap className={cn("fill-primaria text-primaria", pequena ? "size-6" : "size-10 max-md:size-[10vw]")} />
        </motion.span>
        Rush
      </h1>
      <p
        aria-hidden
        className={cn("bg-primaria px-3 py-0.5 text-center font-bold text-texto uppercase -skew-x-12", pequena ? "text-[10px] tracking-[0.3em]" : "text-xs tracking-[0.4em] max-md:tracking-[0.15em]")}
      >
        {modo}
      </p>
    </div>
  );
}
