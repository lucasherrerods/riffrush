import { Ghost } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import moldura from "./medidor-de-rock.webp";

/** Até onde o ponteiro vai para cada lado, em graus a partir do meio: as bordas do vermelho e do verde na imagem. */
const ABERTURA = 50;
/** Medidas na grade da imagem (568 × 427): o eixo fica na placa de metal embaixo do ROCK. */
const LARGURA = 568;
const ALTURA = 427;
const EIXO = { x: 290, y: 345 };
const COMPRIMENTO = 186;

/** O medidor de rock do Guitar Hero: o mostrador com válvulas, e o ponteiro do vermelho (vaia) ao verde (a galera pirando). */
export function MedidorDeRock({ vida, fantasma = false, className }: { vida: number; /** Multijogador: a vida já zerou nesta música. */ fantasma?: boolean; className?: string }) {
  const angulo = Math.round(-ABERTURA + vida * ABERTURA * 2);
  return (
    <div role="meter" aria-label="Vida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(vida * 100)} className={cn("relative", className)}>
      <img src={moldura} alt="" draggable={false} className="block w-full select-none" />
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="absolute inset-0 size-full" aria-hidden>
        <g data-testid="ponteiro" transform={`rotate(${angulo} ${EIXO.x} ${EIXO.y})`}>
          {/* Ponteiro de metal escuro, afinando até a ponta. */}
          <path d={`M ${EIXO.x - 9} ${EIXO.y} L ${EIXO.x - 2} ${EIXO.y - COMPRIMENTO} L ${EIXO.x + 2} ${EIXO.y - COMPRIMENTO} L ${EIXO.x + 9} ${EIXO.y} Z`} className="fill-fundo stroke-texto-suave" strokeWidth="2.5" strokeLinejoin="round" />
        </g>
        <circle cx={EIXO.x} cy={EIXO.y} r="17" className="fill-superficie-elevada stroke-fundo" strokeWidth="4" />
        <circle cx={EIXO.x} cy={EIXO.y} r="5" className="fill-texto-suave" />
      </svg>
      {fantasma && <Ghost aria-label="Virou fantasma" className="absolute top-2 right-3 size-5 text-texto opacity-70" />}
    </div>
  );
}
