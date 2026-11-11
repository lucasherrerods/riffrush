const decimal = (n: number) => n.toFixed(1).replace(".", ",");

/** O UR como aparece no resultado e durante a partida. */
export const textoDoUr = (ur: number) => `UR ${decimal(ur)}`;

/** A precisão acumulada ao longo da música, de 0 a 1. O eixo vai do pior ponto até 100%, para as quedas aparecerem. */
export function GraficoDaPrecisao({ curva }: { curva: number[] }) {
  if (curva.length === 0) return null;
  const minimo = Math.min(...curva, 0.9);
  const faixa = 1 - minimo || 1;
  const largura = 100;
  const altura = 30;
  const passo = curva.length > 1 ? largura / (curva.length - 1) : 0;
  const pontos = curva.map((p, i) => `${(i * passo).toFixed(2)},${(((1 - p) / faixa) * altura).toFixed(2)}`).join(" ");
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="flex justify-between text-sm text-texto-suave">
        <span>Precisão na música</span>
        <span className="tabular-nums">mín. {decimal(minimo * 100)}%</span>
      </figcaption>
      <svg role="img" aria-label="Precisão ao longo da música" viewBox={`0 0 ${largura} ${altura}`} preserveAspectRatio="none" className="h-20 w-full rounded-md bg-superficie-elevada">
        <polyline points={pontos} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="text-primaria" />
      </svg>
    </figure>
  );
}

interface PropsDaBarra {
  /** Contagem dos toques por faixa, do mais cedo ao mais tarde. */
  histograma: number[];
  mediaMs: number;
  ur: number;
}

/** Onde os toques caíram em relação ao tempo da nota: a linha do meio é o tempo certo. */
export function BarraDeDesvio({ histograma, mediaMs, ur }: PropsDaBarra) {
  const maior = Math.max(...histograma, 0);
  if (maior === 0) return null;
  const lado = mediaMs < 0 ? "cedo" : "tarde";
  const altura = 30;
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="flex justify-between text-sm text-texto-suave">
        <span>{`${decimal(Math.abs(mediaMs))} ms ${lado}`}</span>
        <span className="tabular-nums">{textoDoUr(ur)}</span>
      </figcaption>
      <svg role="img" aria-label="Desvio dos toques" viewBox={`0 0 ${histograma.length} ${altura}`} preserveAspectRatio="none" className="h-16 w-full rounded-md bg-superficie-elevada">
        {histograma.map((n, i) => {
          const h = (n / maior) * altura;
          return <rect key={i} x={i + 0.1} y={altura - h} width={0.8} height={h} className="fill-primaria" />;
        })}
        <line x1={histograma.length / 2} x2={histograma.length / 2} y1={0} y2={altura} stroke="currentColor" strokeWidth={1} vectorEffect="non-scaling-stroke" className="text-texto-suave" />
      </svg>
      <div className="flex justify-between text-xs text-texto-suave">
        <span>Cedo</span>
        <span>Tarde</span>
      </div>
    </figure>
  );
}
