import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Disc3, LoaderCircle, Search } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { useValorAtrasado } from "@/shared/hooks/useValorAtrasado";
import { Button } from "@/shared/ui/button";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { Input } from "@/shared/ui/input";
import {
  FILTROS_PADRAO,
  TAMANHO_DA_PAGINA,
  buscarNoEncore,
  formatarDuracao,
  type DificuldadeDaBusca,
  type FiltrosDaBusca,
  type Instrumento,
  type RespostaDaBusca,
  type ResultadoDaBusca,
} from "./encore";

interface Props {
  aoVoltar: () => void;
  buscar?: (filtros: FiltrosDaBusca, pagina: number, opcoes: { sinal: AbortSignal }) => Promise<RespostaDaBusca>;
  /** Espera o jogador parar de digitar antes de buscar o texto, para não estourar o limite da API. */
  atrasoMs?: number;
}

const OPCOES_DE_INSTRUMENTO: { id: Instrumento | "todos"; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "guitarra", rotulo: "Guitarra" },
  { id: "guitarra-coop", rotulo: "Guitarra coop" },
  { id: "ritmo", rotulo: "Ritmo" },
  { id: "baixo", rotulo: "Baixo" },
  { id: "bateria", rotulo: "Bateria" },
  { id: "teclado", rotulo: "Teclado" },
];

const OPCOES_DE_DIFICULDADE: { id: DificuldadeDaBusca | "todas"; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "facil", rotulo: "Fácil" },
  { id: "medio", rotulo: "Médio" },
  { id: "dificil", rotulo: "Difícil" },
  { id: "expert", rotulo: "Expert" },
];

type Estado = { tipo: "carregando" } | { tipo: "pronto"; resposta: RespostaDaBusca } | { tipo: "erro"; mensagem: string };

export function TelaDeBuscaDeMusicas({ aoVoltar, buscar = buscarNoEncore, atrasoMs = 500 }: Props) {
  const [texto, setTexto] = useState(FILTROS_PADRAO.texto);
  const [filtros, setFiltros] = useState<Omit<FiltrosDaBusca, "texto">>(FILTROS_PADRAO);
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const textoAtrasado = useValorAtrasado(texto, atrasoMs);

  const mudarFiltros = (parcial: Partial<FiltrosDaBusca>) => {
    setFiltros((atuais) => ({ ...atuais, ...parcial }));
    setPagina(1);
  };

  useEffect(() => setPagina(1), [textoAtrasado]);

  useEffect(() => {
    const controle = new AbortController();
    setEstado({ tipo: "carregando" });
    buscar({ ...filtros, texto: textoAtrasado }, pagina, { sinal: controle.signal })
      .then((resposta) => setEstado({ tipo: "pronto", resposta }))
      .catch((erro: Error) => {
        if (!controle.signal.aborted) setEstado({ tipo: "erro", mensagem: erro.message });
      });
    return () => controle.abort();
  }, [buscar, filtros, textoAtrasado, pagina]);

  useTeclado((evento) => {
    if (evento.code === "Escape") aoVoltar();
  });

  const totalDePaginas = estado.tipo === "pronto" ? Math.max(1, Math.ceil(estado.resposta.total / TAMANHO_DA_PAGINA)) : 1;

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex items-center gap-4 bg-superficie px-8 py-4 max-md:px-4 max-md:py-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-4xl leading-[1.1] text-destaque max-md:text-2xl">Busca músicas</h1>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-8 max-md:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 opacity-70" aria-hidden />
          <Input
            type="search"
            aria-label="Buscar músicas"
            placeholder="Nome da música, artista, álbum ou charter"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            className="h-12 pl-12 text-base md:text-base"
            autoFocus
          />
        </div>
        <div className="flex flex-wrap gap-8 max-md:gap-4">
          <GrupoDeOpcoes titulo="Instrumento" opcoes={OPCOES_DE_INSTRUMENTO} valor={filtros.instrumento} aoEscolher={(instrumento) => mudarFiltros({ instrumento })} />
          <GrupoDeOpcoes titulo="Dificuldade" opcoes={OPCOES_DE_DIFICULDADE} valor={filtros.dificuldade} aoEscolher={(dificuldade) => mudarFiltros({ dificuldade })} />
        </div>

        <section aria-label="Resultados" aria-busy={estado.tipo === "carregando"} className="min-h-0 flex-1 overflow-y-auto">
          {estado.tipo === "carregando" && (
            <p className="flex items-center gap-2 py-8 text-base text-texto-suave">
              <LoaderCircle className="size-4 animate-spin opacity-70" aria-hidden />
              Buscando...
            </p>
          )}
          {estado.tipo === "erro" && (
            <p role="alert" className="py-8 text-base text-texto-suave">
              {estado.mensagem}
            </p>
          )}
          {estado.tipo === "pronto" && estado.resposta.resultados.length === 0 && (
            <p className="py-8 text-base text-texto-suave">Nenhuma música encontrada. Tente outro nome ou tire algum filtro.</p>
          )}
          {estado.tipo === "pronto" && (
            <ul className="flex flex-col gap-2">
              {estado.resposta.resultados.map((r) => (
                <ItemDoResultado key={r.md5} resultado={r} />
              ))}
            </ul>
          )}
        </section>

        <footer className="flex items-center justify-between gap-4 text-base text-texto-suave">
          <span>Resultados do Chorus Encore (enchor.us). Download em breve.</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Página anterior" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
              <ChevronLeft />
            </Button>
            <span>
              Página {pagina} de {totalDePaginas}
            </span>
            <Button variant="ghost" size="icon" aria-label="Próxima página" disabled={pagina >= totalDePaginas} onClick={() => setPagina((p) => p + 1)}>
              <ChevronRight />
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function ItemDoResultado({ resultado }: { resultado: ResultadoDaBusca }) {
  const detalhes = [resultado.album, resultado.ano, resultado.genero].filter(Boolean).join(" · ");
  return (
    <li className="chapa flex items-center gap-4 border-borda bg-superficie p-2 pr-4">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-superficie-elevada">
        {resultado.capa ? (
          <img src={resultado.capa} alt={`Capa de ${resultado.titulo}`} loading="lazy" className="size-full object-cover" />
        ) : (
          <Disc3 className="size-8 opacity-70" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold">{resultado.titulo}</h2>
        <p className="truncate text-base text-texto-suave">
          {resultado.artista}
          {detalhes && ` · ${detalhes}`}
        </p>
        {resultado.charter && <p className="truncate text-base text-texto-suave">Chart por {resultado.charter}</p>}
      </div>
      <span className="font-titulo text-xl text-texto-suave">{formatarDuracao(resultado.duracaoMs)}</span>
    </li>
  );
}
