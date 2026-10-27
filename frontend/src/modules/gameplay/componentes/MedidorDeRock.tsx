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
/** Os raios do brilho, em graus. */
const RAIOS = [-150, -120, -90, -60, -30, 0, 180];

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
            <feGaussianBlur stdDeviation={9} />
          </filter>
        </defs>
        <g role="progressbar" aria-label="Star power" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(estrela * 100)} className={cn(estrelaAtiva && "animate-pulse")}>
          {PINOS.map(({ x, y }, i) => {
            const aceso = i < acesos;
            return (
              <g key={i} data-testid="pino" data-aceso={aceso}>
                {aceso && destaque && (
                  <g data-testid="destaque-do-pino" className="animate-pulse">
                    <ellipse cx={x} cy={y} rx={34} ry={42} className="fill-estrela" opacity={0.55} filter={`url(#${desfoque})`} />
                    {RAIOS.map((angulo) => {
                      const r = (angulo * Math.PI) / 180;
                      return <line key={angulo} x1={x + Math.cos(r) * 30} y1={y + Math.sin(r) * 34} x2={x + Math.cos(r) * 56} y2={y + Math.sin(r) * 62} className="stroke-estrela" strokeWidth={3} strokeLinecap="round" opacity={0.8} />;
                    })}
                  </g>
                )}
                {/* A luz verde da imagem vira azul quando o pino acende, e escurece quando está vazio. */}
                <rect x={x - 7} y={y - 19} width={14} height={38} rx={7} className={aceso ? "fill-estrela" : "fill-fundo"} opacity={aceso ? 1 : 0.8} />
              </g>
            );
          })}
        </g>
      </svg>
      {fantasma && <Ghost aria-label="Virou fantasma" className="absolute top-2 right-3 size-5 text-texto opacity-70" />}
    </div>
  );
}
