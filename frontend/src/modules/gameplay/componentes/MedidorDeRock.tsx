import { useId } from "react";
import { Ghost } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { pinosAcesos } from "../pinos";
import moldura from "./medidor-de-rock.webp";

/** Medidas na grade da imagem (212 × 141). */
const LARGURA = 212;
const ALTURA = 141;
/** A janela curva da barra, do vermelho (esquerda) ao verde (direita). */
const JANELA = "M 45 54 Q 107 34 159 51 L 158 82 Q 108 68 46 81 Z";
const INICIO = 45;
const FIM = 159;
/** A luz do conector da ponta esquerda, que fica apagada para sobrar só os três pinos. */
const CONECTOR_SOLTO = { x: 35, y: 41 };
/** Os três pinos de cima, desenhados maiores por cima dos conectores da imagem: viram o star power. */
const PINOS = [
  { x: 51, y: 29 },
  { x: 68, y: 22 },
  { x: 88, y: 22 },
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
 * e os três pinos de cima acendem, um a cada terço do star power.
 */
export function MedidorDeRock({ vida, estrela = 0, estrelaAtiva = false, fantasma = false, className }: Props) {
  const recorte = useId();
  const acesos = pinosAcesos(estrela);
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
          <rect x={ponta - 1.5} y={0} width={3} height={ALTURA} className="fill-texto" />
        </g>
        <ellipse cx={CONECTOR_SOLTO.x} cy={CONECTOR_SOLTO.y} rx={3.4} ry={4.2} className="fill-fundo" opacity={0.85} aria-hidden />
        <g role="progressbar" aria-label="Star power" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(estrela * 100)} className={cn(estrelaAtiva && "animate-pulse")}>
          {PINOS.map(({ x, y }, i) => {
            const aceso = i < acesos;
            return (
              <g key={i} data-testid="pino" data-aceso={aceso}>
                {/* Corpo do pino: um espeto escuro com a luz no meio. */}
                <path d={`M ${x - 6} ${y + 9} L ${x - 4.5} ${y - 6} Q ${x} ${y - 13} ${x + 4.5} ${y - 6} L ${x + 6} ${y + 9} Z`} className="fill-fundo stroke-texto-suave" strokeWidth={0.8} />
                <rect x={x - 2.2} y={y - 6} width={4.4} height={12} rx={2.2} className={aceso ? "fill-estrela" : "fill-superficie-elevada"} />
              </g>
            );
          })}
        </g>
      </svg>
      {fantasma && <Ghost aria-label="Virou fantasma" className="absolute top-2 right-3 size-5 text-texto opacity-70" />}
    </div>
  );
}
