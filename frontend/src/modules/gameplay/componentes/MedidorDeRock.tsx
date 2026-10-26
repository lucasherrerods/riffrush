import { useId } from "react";
import { Ghost } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { brilhoDosPinos } from "../pinos";
import moldura from "./medidor-de-rock.webp";

/** Medidas na grade da imagem (212 × 141). */
const LARGURA = 212;
const ALTURA = 141;
/** A janela curva da barra, do vermelho (esquerda) ao verde (direita). */
const JANELA = "M 45 54 Q 107 34 159 51 L 158 82 Q 108 68 46 81 Z";
const INICIO = 45;
const FIM = 159;
/** As luzes dos conectores em cima, da esquerda para a direita: viram o star power. */
const PINOS = [
  { x: 35, y: 41 },
  { x: 51, y: 31 },
  { x: 67, y: 25 },
  { x: 87, y: 26 },
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
 * e os quatro pinos de cima enchem com o star power.
 */
export function MedidorDeRock({ vida, estrela = 0, estrelaAtiva = false, fantasma = false, className }: Props) {
  const recorte = useId();
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
        <g role="progressbar" aria-label="Star power" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(estrela * 100)} className={cn(estrelaAtiva && "animate-pulse")}>
          {brilhoDosPinos(estrela).map((brilho, i) => (
            <g key={i}>
              {/* A tampa escura apaga a luz verde da imagem; a do star power acende por cima. */}
              <ellipse cx={PINOS[i].x} cy={PINOS[i].y} rx={3.4} ry={4.2} className="fill-fundo" opacity={0.75} />
              <ellipse data-testid="pino" cx={PINOS[i].x} cy={PINOS[i].y} rx={3} ry={3.8} className="fill-estrela" opacity={brilho} />
            </g>
          ))}
        </g>
      </svg>
      {fantasma && <Ghost aria-label="Virou fantasma" className="absolute top-2 right-3 size-5 text-texto opacity-70" />}
    </div>
  );
}
