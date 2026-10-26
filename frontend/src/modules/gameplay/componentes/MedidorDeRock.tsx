import { useId } from "react";
import { Ghost } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import moldura from "./medidor-de-rock.webp";

/** Medidas na grade da imagem (212 × 141). */
const LARGURA = 212;
const ALTURA = 141;
/** A janela curva da barra, do vermelho (esquerda) ao verde (direita). */
const JANELA = "M 45 54 Q 107 34 159 51 L 158 82 Q 108 68 46 81 Z";
const INICIO = 45;
const FIM = 159;

/** O medidor de rock: a barra do RIFF acende do vermelho (vaia) ao verde (a galera pirando) conforme a vida. */
export function MedidorDeRock({ vida, fantasma = false, className }: { vida: number; /** Multijogador: a vida já zerou nesta música. */ fantasma?: boolean; className?: string }) {
  const recorte = useId();
  const ponta = Math.round(INICIO + vida * (FIM - INICIO));
  return (
    <div role="meter" aria-label="Vida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(vida * 100)} className={cn("relative", className)}>
      <img src={moldura} alt="" draggable={false} className="block w-full select-none" />
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="absolute inset-0 size-full" aria-hidden>
        <clipPath id={recorte}>
          <path d={JANELA} />
        </clipPath>
        <g clipPath={`url(#${recorte})`}>
          {/* O que passa da vida atual fica apagado; a ponta acesa marca onde ela está. */}
          <rect data-testid="barra-apagada" x={ponta} y={0} width={LARGURA - ponta} height={ALTURA} className="fill-fundo" opacity={0.82} />
          <rect x={ponta - 1.5} y={0} width={3} height={ALTURA} className="fill-texto" />
        </g>
      </svg>
      {fantasma && <Ghost aria-label="Virou fantasma" className="absolute top-2 right-3 size-5 text-texto opacity-70" />}
    </div>
  );
}
