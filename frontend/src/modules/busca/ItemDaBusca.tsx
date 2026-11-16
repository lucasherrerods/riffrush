import { useEffect, useRef } from "react";
import { Check, Disc3, Download, LoaderCircle, Play, Square } from "lucide-react";
import { BarraDeProgresso } from "@/shared/ui/BarraDeProgresso";
import { Button } from "@/shared/ui/button";
import type { EstadoDaPrevia } from "./usePrevia";

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
  /** Com ela, a capa vira o botão que toca um trecho da música. */
  previa?: { estado: EstadoDaPrevia; aoAlternar: () => void };
}

const classeDaCapa = "relative flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-borda bg-superficie max-md:size-12";

export function ItemDaBusca({ titulo, capa, linhas, selos, lateral, progresso, acao, previa }: Props) {
  const [principal, ...resto] = linhas;
  const imagem = capa ? <img src={capa} alt="" loading="lazy" className="size-full object-cover" /> : <Disc3 className="size-6 opacity-70" aria-hidden />;
  return (
    <li className="chapa flex items-center gap-4 bg-superficie-elevada/95 p-3 max-md:gap-2 max-md:p-2">
      {previa ? <CapaComPrevia titulo={titulo} {...previa}>{imagem}</CapaComPrevia> : <div className={classeDaCapa}>{imagem}</div>}
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

function CapaComPrevia({ titulo, estado, aoAlternar, children }: { titulo: string; estado: EstadoDaPrevia; aoAlternar: () => void; children: React.ReactNode }) {
  const ativa = estado !== "parada";
  const Icone = estado === "carregando" ? LoaderCircle : estado === "tocando" ? Square : Play;
  return (
    <button
      type="button"
      onClick={aoAlternar}
      aria-label={`${ativa ? "Parar" : "Ouvir"} prévia de ${titulo}`}
      aria-pressed={estado === "tocando"}
      aria-busy={estado === "carregando"}
      className={`${classeDaCapa} group cursor-pointer focus-visible:outline-2 focus-visible:outline-primaria`}
    >
      {children}
      <span
        className={`absolute inset-0 flex items-center justify-center bg-fundo/60 transition-opacity ${ativa ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 max-md:opacity-100 max-md:bg-fundo/40"}`}
      >
        <Icone className={`size-6 text-texto ${estado === "carregando" ? "animate-spin" : ""} ${estado === "carregando" ? "" : "fill-current"}`} aria-hidden />
      </span>
    </button>
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

/** O fim da lista, quando há mais resultados para pedir: ao rolar até ele, a próxima página é pedida sozinha. */
export function CarregarMais({ carregando, aoCarregar }: { carregando: boolean; aoCarregar: () => void }) {
  const fim = useRef<HTMLLIElement>(null);
  const pedir = useRef(aoCarregar);
  pedir.current = aoCarregar;
  // Recriado quando a página chega: se o fim ainda estiver à vista (página curta), a próxima é pedida também.
  useEffect(() => {
    const alvo = fim.current;
    if (!alvo || carregando) return;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) pedir.current();
    }, { rootMargin: "200px" });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [carregando]);
  return (
    <li ref={fim} data-parte="fim-da-lista" className="col-span-full flex justify-center py-2 text-sm text-texto-suave">
      {carregando && "Carregando…"}
    </li>
  );
}
