import { AnimatePresence, motion } from "framer-motion";
import { Star } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { MAXIMO_DE_ESTRELAS } from "../estrelas";

const posicao = (estrelas: number) => `${(Math.min(estrelas, MAXIMO_DE_ESTRELAS) / MAXIMO_DE_ESTRELAS) * 100}%`;

/**
 * A barra que carrega com a pontuação. Ela começa vazia e cresce de estrela em estrela:
 * cada uma aparece ao ser alcançada, e o trilho só vai até a próxima. O recorde é um tracinho sutil.
 */
export function BarraDeEstrelas({ progresso, recorde, className }: { progresso: number; recorde?: number; className?: string }) {
  const conquistadas = Math.min(MAXIMO_DE_ESTRELAS, Math.floor(progresso));
  return (
    <div
      role="meter"
      aria-label="Estrelas"
      aria-valuemin={0}
      aria-valuemax={MAXIMO_DE_ESTRELAS}
      aria-valuenow={conquistadas}
      className={cn("relative flex h-40 items-stretch gap-1", className)}
    >
      <div className="relative w-6">
        <AnimatePresence>
          {Array.from({ length: conquistadas }, (_, i) => (
            <motion.div
              key={i}
              data-testid="estrela"
              initial={{ scale: 2.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="absolute left-0 translate-y-1/2"
              style={{ bottom: posicao(i + 1) }}
            >
              <Star aria-hidden className="size-6 fill-ouro text-ouro" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="relative w-3">
        <div
          data-testid="trilho"
          className="absolute bottom-0 w-full overflow-hidden rounded-full bg-superficie-elevada transition-[height] duration-500"
          style={{ height: posicao(conquistadas + 1) }}
        />
        <div data-testid="preenchimento" className="absolute bottom-0 w-full rounded-full bg-destaque transition-[height]" style={{ height: posicao(progresso) }} />
      </div>
      {recorde !== undefined && recorde > 0 && (
        <div aria-label={`Recorde: ${Math.floor(recorde)} estrelas`} className="absolute right-0 left-6 h-px bg-texto/50" style={{ bottom: posicao(recorde) }} />
      )}
    </div>
  );
}
