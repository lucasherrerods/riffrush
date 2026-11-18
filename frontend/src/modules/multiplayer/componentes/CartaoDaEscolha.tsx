import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface EstatisticaDaEscolha {
  rotulo: string;
  valor: ReactNode;
}

interface Props {
  capa: ReactNode;
  titulo: string;
  subtitulo?: string;
  /** A linha em destaque embaixo do título: a dificuldade e o que mais pesa nela. */
  destaque?: ReactNode;
  estatisticas: EstatisticaDaEscolha[];
  /** O pronto do convidado, que fecha a coluna das informações. */
  acao?: ReactNode;
}

/** O que o convidado vê da escolha do host: a capa em destaque e os números ao lado. */
export function CartaoDaEscolha({ capa, titulo, subtitulo, destaque, estatisticas, acao }: Props) {
  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-lg">
      <div className="relative grid min-h-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-stretch gap-8 p-4 max-md:grid-cols-1 max-md:gap-3 max-md:p-2">
        <div className="aspect-square h-full max-h-96 min-h-48 overflow-hidden rounded-lg max-md:h-28 max-md:min-h-0">{capa}</div>
        <div className="flex min-w-0 flex-col gap-4 py-2 max-md:gap-2 max-md:py-0">
          <div className="min-w-0">
            <p className="text-5xl leading-tight font-black max-lg:text-3xl max-md:text-xl">{titulo}</p>
            {subtitulo && <p className="truncate text-xl text-texto-suave max-md:text-base">{subtitulo}</p>}
          </div>
          {destaque && <p className="font-titulo text-2xl tracking-wide text-destaque max-md:text-lg">{destaque}</p>}
          {estatisticas.length > 0 && (
            <dl className="flex flex-wrap gap-x-8 gap-y-3 max-md:gap-x-4">
              {estatisticas.map((e) => (
                // O número vem antes na tela, mas o rótulo continua antes no HTML, como pede o <dl>.
                <div key={e.rotulo} className="flex min-w-0 flex-col-reverse">
                  <dt className="text-sm text-texto-suave">{e.rotulo}</dt>
                  <dd className="font-titulo text-2xl max-md:text-lg">{e.valor}</dd>
                </div>
              ))}
            </dl>
          )}
          {acao && <div className="mt-auto max-w-md">{acao}</div>}
        </div>
      </div>
    </div>
  );
}

/** Antes do host escolher: um aviso no meio do espaço, em vez de uma linha solta no topo. */
export function EsperandoAEscolha({ icone: Icone, texto }: { icone: LucideIcon; texto: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center text-texto-suave">
      <Icone className="size-12 opacity-50" aria-hidden />
      <p className="text-lg">{texto}</p>
    </div>
  );
}
