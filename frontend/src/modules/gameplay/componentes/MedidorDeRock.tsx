import { useId } from "react";
import { Ghost } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { nivelDoLiquido, pinosPulsando, progressoDosPinos as progressoPelaEstrela, type Vidro } from "../pinos";
import moldura from "./medidor-de-rock.webp";
import pinosCheios from "./pinos-cheios.webp";

/** Medidas na grade da imagem (760 × 547). */
const LARGURA = 760;
const ALTURA = 547;
/** A janela curva da barra, do vermelho (esquerda) ao verde (direita). */
const JANELA = "M 200 262 Q 370 200 566 258 L 560 336 Q 380 266 205 320 Z";
const INICIO = 200;
const FIM = 562;
/**
 * O vidro dos quatro conectores de cima, da esquerda para a direita, com folga até a tampa e o anel de metal.
 * Cada pino tem a própria posição, tamanho e inclinação, medidos sobre a imagem; o líquido sobe entre esses lados.
 */
const VIDROS: Vidro[] = [
  [{ x: 114, y: 144 }, { x: 181, y: 136 }, { x: 192, y: 206 }, { x: 124, y: 206 }],
  [{ x: 204, y: 122 }, { x: 270, y: 117 }, { x: 280, y: 176 }, { x: 215, y: 176 }],
  [{ x: 269, y: 100 }, { x: 345, y: 98 }, { x: 356, y: 156 }, { x: 284, y: 156 }],
  [{ x: 369, y: 100 }, { x: 440, y: 98 }, { x: 446, y: 155 }, { x: 377, y: 155 }],
];
/** Onde fica a camada com o vidro azul dos quatro pinos cheios. */
const CAMADA_CHEIA = { x: 124, y: 104, width: 309, height: 99 };

interface Props {
  vida: number;
  /** De 0 a 1. */
  estrela?: number;
  estrelaAtiva?: boolean;
  /** De 0 a 1 por pino, para encher cada um por conta própria; sem ele, os pinos seguem a `estrela`. */
  progressoDosPinos?: readonly number[];
  /** Multijogador: a vida já zerou nesta música. */
  fantasma?: boolean;
  className?: string;
}

/**
 * O medidor de rock: a barra do RIFF acende do vermelho (vaia) ao verde (a galera pirando) conforme a vida,
 * e o vidro dos quatro pinos de cima enche de azul, de baixo para cima, um a cada quarto do star power.
 */
export function MedidorDeRock({ vida, estrela = 0, estrelaAtiva = false, progressoDosPinos, fantasma = false, className }: Props) {
  const recorte = useId();
  const progressos = progressoDosPinos ?? progressoPelaEstrela(estrela);
  const pulsando = pinosPulsando(progressos);
  const ponta = Math.round(INICIO + vida * (FIM - INICIO));
  return (
    <div role="meter" aria-label="Vida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(vida * 100)} className={cn("relative", className)}>
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="block h-auto w-full select-none">
        <image href={moldura} width={LARGURA} height={ALTURA} />
        <clipPath id={recorte}>
          <path d={JANELA} />
        </clipPath>
        <g clipPath={`url(#${recorte})`} aria-hidden>
          {/* O que passa da vida atual fica apagado; a ponta acesa marca onde ela está. */}
          <rect data-testid="barra-apagada" x={ponta} y={0} width={LARGURA - ponta} height={ALTURA} className="fill-fundo" opacity={0.82} />
          <rect x={ponta - 3} y={0} width={6} height={ALTURA} className="fill-texto" />
        </g>
        <g role="progressbar" aria-label="Star power" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(estrela * 100)} className={cn(estrelaAtiva && "animate-pulse")}>
          {VIDROS.map((vidro, i) => {
            const progresso = progressos[i] ?? 0;
            const id = `${recorte}-pino-${i}`;
            return (
              <g key={i} data-testid="pino" data-progresso={progresso}>
                <clipPath id={id}>
                  <polygon points={nivelDoLiquido(vidro, progresso)} />
                </clipPath>
                {/* O vidro azul aparece de baixo para cima, só até o nível do líquido, mais aceso que o da arte. */}
                <image data-testid="liquido" href={pinosCheios} {...CAMADA_CHEIA} clipPath={`url(#${id})`} className={cn(pulsando && "pulso-suave")} style={{ filter: "brightness(1.5) saturate(1.3)" }} />
              </g>
            );
          })}
        </g>
      </svg>
      {fantasma && <Ghost aria-label="Virou fantasma" className="absolute top-2 right-3 size-5 text-texto opacity-70" />}
    </div>
  );
}
