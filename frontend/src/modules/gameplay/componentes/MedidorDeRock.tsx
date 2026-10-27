import { useId } from "react";
import { Ghost } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { comDestaque, pinosAcesos } from "../pinos";
import moldura from "./medidor-de-rock.webp";

/** Medidas na grade da imagem (760 × 547). */
const LARGURA = 760;
const ALTURA = 547;
/** A janela curva da barra, do vermelho (esquerda) ao verde (direita). */
const JANELA = "M 200 262 Q 370 200 566 258 L 560 336 Q 380 266 205 320 Z";
const INICIO = 200;
const FIM = 562;
/** As luzes verdes dos quatro conectores de cima, da esquerda para a direita: viram o star power. */
const PINOS = [
  { x: 155, y: 172 },
  { x: 241, y: 142 },
  { x: 318, y: 124 },
  { x: 412, y: 122 },
];

interface Props {
  vida: number;
  /** De 0 a 1. */
  estrela?: number;
  estrelaAtiva?: boolean;
  /** Multijogador: a vida já zerou nesta música. */
  fantasma?: boolean;
  className?: string;
}

/**
 * O medidor de rock: a barra do RIFF acende do vermelho (vaia) ao verde (a galera pirando) conforme a vida,
 * e os quatro pinos de cima acendem, um a cada quarto do star power; a partir do segundo, eles brilham.
 */
export function MedidorDeRock({ vida, estrela = 0, estrelaAtiva = false, fantasma = false, className }: Props) {
  const recorte = useId();
  const desfoque = useId();
  const acesos = pinosAcesos(estrela);
  const destaque = comDestaque(estrela);
  const ponta = Math.round(INICIO + vida * (FIM - INICIO));
  return (
    <div role="meter" aria-label="Vida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(vida * 100)} className={cn("relative", className)}>
      <img src={moldura} alt="" draggable={false} className="block w-full select-none" />
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="absolute inset-0 size-full">
        <clipPath id={recorte}>
          <path d={JANELA} />
        </clipPath>
        <g clipPath={`url(#${recorte})`} aria-hidden>
          {/* O que passa da vida atual fica apagado; a ponta acesa marca onde ela está. */}
          <rect data-testid="barra-apagada" x={ponta} y={0} width={LARGURA - ponta} height={ALTURA} className="fill-fundo" opacity={0.82} />
          <rect x={ponta - 3} y={0} width={6} height={ALTURA} className="fill-texto" />
        </g>
        <defs>
          <filter id={desfoque} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation={5} />
          </filter>
        </defs>
        <g role="progressbar" aria-label="Star power" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(estrela * 100)} className={cn(estrelaAtiva && "animate-pulse")}>
          {PINOS.map(({ x, y }, i) => {
            const aceso = i < acesos;
            return (
              <g key={i} data-testid="pino" data-aceso={aceso}>
                {aceso && destaque && (
                  <g data-testid="destaque-do-pino" className="animate-pulse">
                    {/* O contorno do conector: um halo desfocado e uma linha clara por cima. */}
                    <rect x={x - 24} y={y - 36} width={48} height={72} rx={12} className="fill-none stroke-estrela" strokeWidth={12} filter={`url(#${desfoque})`} />
                    <rect x={x - 24} y={y - 36} width={48} height={72} rx={12} className="fill-none stroke-texto" strokeWidth={2.5} opacity={0.9} />
                  </g>
                )}
                {/* O pino aceso clareia o conector inteiro com o azul do star power. */}
                {aceso && <rect x={x - 22} y={y - 34} width={44} height={68} rx={10} className="fill-estrela" opacity={0.45} style={{ mixBlendMode: "screen" }} />}
                {/* A luz verde da imagem vira azul quando o pino acende, e escurece quando está vazio. */}
                <rect x={x - 8} y={y - 20} width={16} height={40} rx={8} className={aceso ? "fill-estrela" : "fill-fundo"} opacity={aceso ? 1 : 0.8} />
                {aceso && <rect x={x - 2.5} y={y - 15} width={5} height={30} rx={2.5} className="fill-texto" opacity={0.75} />}
              </g>
            );
          })}
        </g>
      </svg>
      {fantasma && <Ghost aria-label="Virou fantasma" className="absolute top-2 right-3 size-5 text-texto opacity-70" />}
    </div>
  );
}
