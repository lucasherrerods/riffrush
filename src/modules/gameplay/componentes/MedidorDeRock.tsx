import { cn } from "@/shared/lib/utils";

/** Até onde o ponteiro vai para cada lado, em graus a partir do meio. */
const ABERTURA = 80;
const CENTRO = { x: 60, y: 62 };
const RAIO = 46;

/** Um pedaço do arco do mostrador, entre dois ângulos (0 = topo). */
function arco(de: number, ate: number) {
  const ponto = (graus: number) => {
    const rad = ((graus - 90) * Math.PI) / 180;
    return `${CENTRO.x + RAIO * Math.cos(rad)} ${CENTRO.y + RAIO * Math.sin(rad)}`;
  };
  return `M ${ponto(de)} A ${RAIO} ${RAIO} 0 0 1 ${ponto(ate)}`;
}

const FAIXAS = [
  { de: -ABERTURA, ate: -ABERTURA / 3, cor: "stroke-perigo" },
  { de: -ABERTURA / 3, ate: ABERTURA / 3, cor: "stroke-ouro" },
  { de: ABERTURA / 3, ate: ABERTURA, cor: "stroke-sucesso" },
];

/** O medidor de rock do Guitar Hero: um mostrador com ponteiro, do vermelho (vaia) ao verde (a galera pirando). */
export function MedidorDeRock({ vida, className }: { vida: number; className?: string }) {
  const angulo = Math.round(-ABERTURA + vida * ABERTURA * 2);
  return (
    <div role="meter" aria-label="Vida" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(vida * 100)} className={cn("placa px-3 pt-2 pb-1", className)}>
      <svg viewBox="0 0 120 76" className="w-full" aria-hidden>
        {FAIXAS.map((faixa) => (
          <path key={faixa.cor} d={arco(faixa.de, faixa.ate)} fill="none" strokeWidth="12" className={faixa.cor} />
        ))}
        <text x={CENTRO.x} y={CENTRO.y - 8} textAnchor="middle" className="fill-texto font-titulo text-[22px] tracking-wide">
          ROCK
        </text>
        <g data-testid="ponteiro" transform={`rotate(${angulo} ${CENTRO.x} ${CENTRO.y})`}>
          <line x1={CENTRO.x} y1={CENTRO.y} x2={CENTRO.x} y2={CENTRO.y - RAIO + 4} strokeWidth="4" strokeLinecap="round" className="stroke-texto" />
        </g>
        <circle cx={CENTRO.x} cy={CENTRO.y} r="6" className="fill-superficie-elevada stroke-texto" strokeWidth="2" />
      </svg>
    </div>
  );
}
