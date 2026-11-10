import { Check, Disc3, Download, Play } from "lucide-react";
import { BarraDeProgresso } from "@/shared/ui/BarraDeProgresso";
import { Button } from "@/shared/ui/button";

interface Props {
  titulo: string;
  capa?: string;
  /** Linhas de detalhe abaixo do título; a primeira é a principal e as outras somem no celular. */
  linhas: string[];
  /** Selos ao lado do título (ex.: vídeo). */
  selos?: React.ReactNode;
  /** Fica entre os detalhes e a ação (ex.: a duração). */
  lateral?: React.ReactNode;
  /** Fração baixada, quando este item está baixando. */
  progresso?: number;
  acao?: React.ReactNode;
}

export function ItemDaBusca({ titulo, capa, linhas, selos, lateral, progresso, acao }: Props) {
  const [principal, ...resto] = linhas;
  return (
    <li className="chapa flex items-center gap-4 bg-superficie-elevada/95 p-3 max-md:gap-2 max-md:p-2">
      <div className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-borda bg-superficie max-md:size-12">
        {capa ? <img src={capa} alt="" loading="lazy" className="size-full object-cover" /> : <Disc3 className="size-6 opacity-70" aria-hidden />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate font-titulo text-xl tracking-wide uppercase max-md:text-base">{titulo}</h2>
          {selos}
        </div>
        {principal && <p className="truncate text-texto-suave max-md:text-sm">{principal}</p>}
        {resto.map((linha) => (
          <p key={linha} className="truncate text-sm text-texto-suave max-md:hidden">
            {linha}
          </p>
        ))}
        {progresso !== undefined && <BarraDeProgresso fracao={progresso} rotulo={`Baixando ${titulo}`} />}
      </div>
      {lateral}
      {acao}
    </li>
  );
}

export type EstadoDaAcao = { tipo: "baixavel"; aoBaixar: () => void; ocupado?: boolean } | { tipo: "baixando" } | { tipo: "baixado"; aoJogar?: () => void };

const classeDoBotao = "font-titulo text-base tracking-wide text-texto uppercase";

/** Baixar, baixando, Jogar ou só "Baixado", igual nos dois modos. */
export function AcaoDaBusca({ nome, estado }: { nome: string; estado: EstadoDaAcao }) {
  if (estado.tipo === "baixado") {
    return estado.aoJogar ? (
      <Button className={classeDoBotao} onClick={estado.aoJogar} aria-label={`Jogar ${nome}`}>
        <Play aria-hidden />
        <span className="max-md:sr-only">Jogar</span>
      </Button>
    ) : (
      <span className="flex items-center gap-1 text-sucesso">
        <Check aria-hidden className="size-4" />
        Baixado
      </span>
    );
  }
  return (
    <Button
      className={classeDoBotao}
      disabled={estado.tipo === "baixando" || (estado.tipo === "baixavel" && estado.ocupado)}
      onClick={estado.tipo === "baixavel" ? estado.aoBaixar : undefined}
      aria-label={`Baixar ${nome}`}
    >
      <Download aria-hidden />
      <span className="max-md:sr-only">Baixar</span>
    </Button>
  );
}

/** O fim da lista, quando há mais resultados para pedir. */
export function CarregarMais({ carregando, aoCarregar }: { carregando: boolean; aoCarregar: () => void }) {
  return (
    <li className="col-span-full flex justify-center py-2">
      <Button variant="secondary" disabled={carregando} onClick={aoCarregar}>
        {carregando ? "Carregando…" : "Carregar mais"}
      </Button>
    </li>
  );
}
