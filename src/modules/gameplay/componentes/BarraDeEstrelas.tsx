import { Star } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { MAXIMO_DE_ESTRELAS } from "../estrelas";

const posicao = (estrelas: number) => `${(Math.min(estrelas, MAXIMO_DE_ESTRELAS) / MAXIMO_DE_ESTRELAS) * 100}%`;

/** A barra que enche com a pontuação: cada estrela acende ao ser alcançada, e uma marca mostra o recorde. */
export function BarraDeEstrelas({ progresso, recorde, className }: { progresso: number; recorde?: number; className?: string }) {
  const conquistadas = Math.floor(progresso);
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
        {Array.from({ length: MAXIMO_DE_ESTRELAS }, (_, i) => {
          const acesa = conquistadas >= i + 1;
          return (
            <Star
              key={i}
              data-testid="estrela"
              data-acesa={acesa}
              aria-hidden
              className={cn("absolute left-0 size-6 translate-y-1/2 transition-colors", acesa ? "fill-ouro text-ouro" : "text-borda")}
              style={{ bottom: posicao(i + 1) }}
            />
          );
        })}
      </div>
      <div className="relative w-3 overflow-hidden rounded-full bg-superficie-elevada">
        <div data-testid="preenchimento" className="absolute bottom-0 w-full rounded-full bg-destaque transition-[height]" style={{ height: posicao(progresso) }} />
      </div>
      {recorde !== undefined && recorde > 0 && (
        <div
          aria-label={`Recorde: ${Math.floor(recorde)} estrelas`}
          className="absolute right-0 left-6 h-0.5 bg-texto"
          style={{ bottom: posicao(recorde) }}
        />
      )}
    </div>
  );
}
