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
  /** Uma linha curta embaixo do título, como "Instalado". */
  etiqueta?: ReactNode;
  estatisticas: EstatisticaDaEscolha[];
}

/** O que o convidado vê da escolha do host: a capa grande e os números da música. */
export function CartaoDaEscolha({ capa, titulo, subtitulo, etiqueta, estatisticas }: Props) {
  return (
    <div className="flex min-h-0 flex-1 items-center gap-8 max-md:flex-col max-md:items-start max-md:gap-3">
      <div className="aspect-square w-72 shrink-0 max-lg:w-56 overflow-hidden rounded-lg bg-superficie-elevada max-md:w-28">{capa}</div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 max-md:gap-2">
        <div className="min-w-0">
          <p className="text-4xl font-black max-md:text-lg">{titulo}</p>
          {subtitulo && <p className="truncate text-xl text-texto-suave max-md:text-base">{subtitulo}</p>}
          {etiqueta}
        </div>
        {estatisticas.length > 0 && (
          <dl className="grid grid-cols-4 gap-x-6 gap-y-4 max-lg:grid-cols-2 max-md:gap-y-2">
            {estatisticas.map((e) => (
              <div key={e.rotulo} className="min-w-0">
                <dt className="text-sm text-texto-suave">{e.rotulo}</dt>
                <dd className="truncate font-titulo text-lg">{e.valor}</dd>
              </div>
            ))}
          </dl>
        )}
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
