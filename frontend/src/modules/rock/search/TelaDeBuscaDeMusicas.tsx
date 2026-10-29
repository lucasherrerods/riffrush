import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, LoaderCircle, Search } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { useValorAtrasado } from "@/shared/hooks/useValorAtrasado";
import { Button } from "@/shared/ui/button";
import { CampoDeSelecao } from "@/shared/ui/CampoDeSelecao";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { ConfirmacaoDeTamanho } from "./componentes/ConfirmacaoDeTamanho";
import { AcaoDoResultado, ItemDoResultado } from "./componentes/ResultadoDoEncore";
import { useBaixarDoEncore, type AoBaixar } from "./useBaixarDoEncore";
import {
  FILTROS_PADRAO,
  usaBuscaAvancada,
  TAMANHO_DA_PAGINA,
  buscarNoEncore,
  type DificuldadeDaBusca,
  type Genero,
  type Ordem,
  type FiltrosDaBusca,
  type Instrumento,
  type RespostaDaBusca,
} from "./encore";

interface Props {
  aoVoltar: () => void;
  buscar?: (filtros: FiltrosDaBusca, pagina: number, opcoes: { sinal: AbortSignal }) => Promise<RespostaDaBusca>;
  /** Espera o jogador parar de digitar antes de buscar o texto, para não estourar o limite da API. */
  atrasoMs?: number;
  /** Baixa e importa o chart. Resolve false quando o jogador desistiu. Sem ela, a tela só lista. */
  aoBaixar?: AoBaixar;
  /** md5 dos charts que já estão na biblioteca. */
  baixadas?: ReadonlySet<string>;
  aoJogar?: (md5: string) => void;
}

const OPCOES_DE_INSTRUMENTO: { id: Instrumento | "todos"; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "guitarra", rotulo: "Guitarra" },
  { id: "guitarra-coop", rotulo: "Guitarra coop" },
  { id: "ritmo", rotulo: "Ritmo" },
  { id: "baixo", rotulo: "Baixo" },
  { id: "teclado", rotulo: "Teclado" },
];

const OPCOES_DE_DIFICULDADE: { id: DificuldadeDaBusca | "todas"; rotulo: string }[] = [
  { id: "todas", rotulo: "Todas" },
  { id: "facil", rotulo: "Fácil" },
  { id: "medio", rotulo: "Médio" },
  { id: "dificil", rotulo: "Difícil" },
  { id: "expert", rotulo: "Expert" },
];

const OPCOES_DE_GENERO: { id: Genero | "todos"; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "rock", rotulo: "Rock" },
  { id: "metal", rotulo: "Metal" },
  { id: "punk", rotulo: "Punk" },
  { id: "pop", rotulo: "Pop" },
  { id: "alternativo", rotulo: "Alternativo" },
  { id: "indie", rotulo: "Indie" },
  { id: "progressivo", rotulo: "Progressivo" },
  { id: "eletronica", rotulo: "Eletrônica" },
  { id: "hip-hop", rotulo: "Hip hop" },
  { id: "funk", rotulo: "Funk" },
  { id: "blues", rotulo: "Blues" },
  { id: "jazz", rotulo: "Jazz" },
  { id: "country", rotulo: "Country" },
  { id: "reggae", rotulo: "Reggae" },
];

const OPCOES_DE_ORDEM: { id: Ordem; rotulo: string }[] = [
  { id: "recentes", rotulo: "Mais recentes" },
  { id: "artista", rotulo: "Artista (A-Z)" },
  { id: "nome", rotulo: "Música (A-Z)" },
  { id: "ano-mais-novo", rotulo: "Ano: mais novas" },
  { id: "ano-mais-antigo", rotulo: "Ano: mais antigas" },
  { id: "mais-curtas", rotulo: "Mais curtas" },
  { id: "mais-longas", rotulo: "Mais longas" },
];

type Estado = { tipo: "carregando" } | { tipo: "pronto"; resposta: RespostaDaBusca } | { tipo: "erro"; mensagem: string };

export function TelaDeBuscaDeMusicas({ aoVoltar, buscar = buscarNoEncore, atrasoMs = 500, aoBaixar, baixadas = new Set(), aoJogar }: Props) {
  const [comVideo, setComVideo] = useState(false);
  const { baixando, pergunta, baixar, responder } = useBaixarDoEncore(aoBaixar, comVideo);
  const [texto, setTexto] = useState(FILTROS_PADRAO.texto);
  const [filtros, setFiltros] = useState<Omit<FiltrosDaBusca, "texto">>(FILTROS_PADRAO);
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const textoAtrasado = useValorAtrasado(texto, atrasoMs);

  const mudarFiltros = (parcial: Partial<FiltrosDaBusca>) => {
    setFiltros((atuais) => ({ ...atuais, ...parcial }));
    setPagina(1);
  };

  useEffect(() => {
    setPagina(1);
  }, [textoAtrasado]);

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
    // Com o modal aberto, o Esc é dele: cancela o download sem sair da tela.
    if (evento.code === "Escape" && !pergunta) aoVoltar();
  });

  const totalDePaginas = estado.tipo === "pronto" ? Math.max(1, Math.ceil(estado.resposta.total / TAMANHO_DA_PAGINA)) : 1;

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex items-center gap-4 bg-superficie px-8 py-4 max-md:px-4 max-md:py-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="titulo-de-tela text-destaque">Buscar músicas</h1>
      </header>

      <div className="respiro-de-tela flex min-h-0 flex-1 flex-col">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 opacity-70" aria-hidden />
          <Input
            type="search"
            aria-label="Buscar músicas"
            placeholder={!usaBuscaAvancada({ texto, ...filtros }) ? "Nome da música, artista, álbum ou charter" : "Nome da música"}
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            className="h-12 pl-12 text-base md:text-base max-md:h-10"
            autoFocus
          />
        </div>
        <div className="flex flex-wrap gap-8 max-md:grid max-md:grid-cols-2 max-md:gap-2">
          <CampoDeSelecao titulo="Instrumento" opcoes={OPCOES_DE_INSTRUMENTO} valor={filtros.instrumento} aoEscolher={(instrumento) => mudarFiltros({ instrumento })} />
          <CampoDeSelecao titulo="Dificuldade" opcoes={OPCOES_DE_DIFICULDADE} valor={filtros.dificuldade} aoEscolher={(dificuldade) => mudarFiltros({ dificuldade })} />
          <CampoDeSelecao titulo="Gênero" opcoes={OPCOES_DE_GENERO} valor={filtros.genero} aoEscolher={(genero) => mudarFiltros({ genero })} />
          <CampoDeSelecao titulo="Ordem" opcoes={OPCOES_DE_ORDEM} valor={filtros.ordem} aoEscolher={(ordem) => mudarFiltros({ ordem })} />
          <label className="flex items-center gap-2 self-end py-2 text-base text-texto-suave max-md:col-span-2 max-md:py-0 max-md:text-sm">
            <Switch aria-label="Só com vídeo" checked={filtros.soComVideo} onCheckedChange={(soComVideo) => mudarFiltros({ soComVideo })} />
            Só com vídeo
          </label>
          {aoBaixar && (
            <label className="flex items-center gap-2 self-end py-2 text-base text-texto-suave max-md:col-span-2 max-md:py-0 max-md:text-sm">
              <Switch aria-label="Baixar com vídeo de fundo" checked={comVideo} onCheckedChange={setComVideo} />
              Baixar com vídeo de fundo
            </label>
          )}
        </div>

        <nav aria-label="Paginação" className="chapa flex items-center justify-between gap-2 bg-superficie px-3 py-1 text-base text-texto-suave max-md:text-sm">
          <span className="truncate"><span className="md:hidden">Resultados</span><span className="max-md:hidden">Resultados do Chorus Encore (enchor.us).</span></span>
          <div className="flex shrink-0 items-center gap-1">
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
        </nav>

        <section aria-label="Resultados" aria-busy={estado.tipo === "carregando"} className="rolagem-de-toque min-h-0 flex-1">
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
                <ItemDoResultado key={r.md5} resultado={r}>
                  {aoBaixar && (
                    <AcaoDoResultado
                      resultado={r}
                      baixada={baixadas.has(r.md5)}
                      baixando={baixando?.md5 === r.md5 ? baixando.fracao : undefined}
                      ocupado={!!baixando}
                      aoBaixar={() => void baixar(r)}
                      aoJogar={() => aoJogar?.(r.md5)}
                    />
                  )}
                </ItemDoResultado>
              ))}
            </ul>
          )}
        </section>

      </div>
      {pergunta && <ConfirmacaoDeTamanho titulo={pergunta.titulo} bytes={pergunta.bytes} aoResponder={responder} />}
    </div>
  );
}
