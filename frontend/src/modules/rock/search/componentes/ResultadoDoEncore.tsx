import { Disc3, Download, LoaderCircle, Play } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { formatarDuracao, type ResultadoDaBusca } from "../encore";

export function ItemDoResultado({ resultado, children }: { resultado: ResultadoDaBusca; children?: React.ReactNode }) {
  const detalhes = [resultado.album, resultado.ano, resultado.genero].filter(Boolean).join(" · ");
  return (
    <li className="chapa flex items-center gap-4 border-borda bg-superficie p-2 pr-4 max-md:gap-2 max-md:pr-2">
      <div className="flex size-16 shrink-0 max-md:size-12 items-center justify-center overflow-hidden rounded-sm bg-superficie-elevada">
        {resultado.capa ? (
          <img src={resultado.capa} alt={`Capa de ${resultado.titulo}`} loading="lazy" className="size-full object-cover" />
        ) : (
          <Disc3 className="size-8 opacity-70" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold max-md:text-base">{resultado.titulo}</h2>
        <p className="truncate text-base text-texto-suave max-md:text-sm">
          {resultado.artista}
          {detalhes && ` · ${detalhes}`}
        </p>
        {resultado.charter && <p className="truncate text-base text-texto-suave max-md:hidden">Chart por {resultado.charter}</p>}
      </div>
      <span className="font-titulo text-xl text-texto-suave max-md:text-base">{formatarDuracao(resultado.duracaoMs)}</span>
      {children}
    </li>
  );
}

interface PropsDaAcao {
  resultado: ResultadoDaBusca;
  baixada: boolean;
  /** Fração já baixada, quando este é o download em andamento. */
  baixando?: number;
  ocupado: boolean;
  aoBaixar: () => void;
  aoJogar: () => void;
}

export function AcaoDoResultado({ resultado, baixada, baixando, ocupado, aoBaixar, aoJogar }: PropsDaAcao) {
  if (baixando !== undefined) {
    return (
      <Button variant="outline" disabled className="w-36 max-md:w-auto">
        <LoaderCircle className="animate-spin opacity-70" aria-hidden />
        Baixando {Math.round(baixando * 100)}%
      </Button>
    );
  }
  if (baixada) {
    return (
      <Button aria-label={`Jogar ${resultado.titulo}`} onClick={aoJogar} className="w-36 max-md:w-auto">
        <Play className="opacity-70" aria-hidden />
        <span className="max-md:sr-only">Jogar</span>
      </Button>
    );
  }
  return (
    <Button variant="outline" aria-label={`Baixar ${resultado.titulo}`} disabled={ocupado} onClick={aoBaixar} className="w-36 max-md:w-auto">
      <Download className="opacity-70" aria-hidden />
      <span className="max-md:sr-only">Baixar</span>
    </Button>
  );
}
