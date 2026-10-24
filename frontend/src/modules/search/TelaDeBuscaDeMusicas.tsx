import { useEffect, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Disc3, Download, LoaderCircle, Play, Search } from "lucide-react";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { useValorAtrasado } from "@/shared/hooks/useValorAtrasado";
import { Button } from "@/shared/ui/button";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { avisar } from "@/shared/ui/avisos";
import { ConfirmacaoDeTamanho } from "./componentes/ConfirmacaoDeTamanho";
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
  /** Baixa e importa o chart. Resolve false quando o jogador desistiu. Sem ela, a tela só lista. */
  aoBaixar?: (resultado: ResultadoDaBusca, opcoes: OpcoesDeBaixar) => Promise<boolean>;
  /** md5 dos charts que já estão na biblioteca. */
  baixadas?: ReadonlySet<string>;
  aoJogar?: (md5: string) => void;
}

export interface OpcoesDeBaixar {
  comVideo: boolean;
  aoProgredir: (fracao: number) => void;
  /** Mostra o modal de arquivo grande e responde se o jogador quer baixar. */
  confirmarTamanho: (bytes: number) => Promise<boolean>;
}

interface Pergunta {
  titulo: string;
  bytes: number;
  responder: (baixar: boolean) => void;
}

interface Download {
  md5: string;
  fracao: number;
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

export function TelaDeBuscaDeMusicas({ aoVoltar, buscar = buscarNoEncore, atrasoMs = 500, aoBaixar, baixadas = new Set(), aoJogar }: Props) {
  const [comVideo, setComVideo] = useState(false);
  // Um download por vez: poupa o Encore e a memória do celular.
  const [baixando, setBaixando] = useState<Download | null>(null);
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
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

  const baixar = async (resultado: ResultadoDaBusca) => {
    if (!aoBaixar) return;
    setBaixando({ md5: resultado.md5, fracao: 0 });
    try {
      await aoBaixar(resultado, {
        comVideo,
        aoProgredir: (fracao) => setBaixando({ md5: resultado.md5, fracao }),
        confirmarTamanho: (bytes) => new Promise((responder) => setPergunta({ titulo: resultado.titulo, bytes, responder })),
      });
    } catch (erro) {
      avisar.error(erro instanceof Error ? erro.message : String(erro));
    } finally {
      setBaixando(null);
    }
  };

  const responder = (baixar: boolean) => {
    pergunta?.responder(baixar);
    setPergunta(null);
  };

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
        <h1 className="text-4xl leading-[1.1] text-destaque max-md:text-2xl">Buscar músicas</h1>
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
          {aoBaixar && (
            <label className="flex items-center gap-2 self-end py-2 text-base text-texto-suave">
              <Switch aria-label="Baixar com vídeo de fundo" checked={comVideo} onCheckedChange={setComVideo} />
              Baixar com vídeo de fundo
            </label>
          )}
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

        <footer className="flex items-center justify-between gap-4 text-base text-texto-suave">
          <span>Resultados do Chorus Encore (enchor.us).</span>
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
      {pergunta && <ConfirmacaoDeTamanho titulo={pergunta.titulo} bytes={pergunta.bytes} aoResponder={responder} />}
    </div>
  );
}

function ItemDoResultado({ resultado, children }: { resultado: ResultadoDaBusca; children?: React.ReactNode }) {
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

function AcaoDoResultado({ resultado, baixada, baixando, ocupado, aoBaixar, aoJogar }: PropsDaAcao) {
  if (baixando !== undefined) {
    return (
      <Button variant="outline" disabled className="w-36">
        <LoaderCircle className="animate-spin opacity-70" aria-hidden />
        Baixando {Math.round(baixando * 100)}%
      </Button>
    );
  }
  if (baixada) {
    return (
      <Button aria-label={`Jogar ${resultado.titulo}`} onClick={aoJogar} className="w-36">
        <Play className="opacity-70" aria-hidden />
        Jogar
      </Button>
    );
  }
  return (
    <Button variant="outline" aria-label={`Baixar ${resultado.titulo}`} disabled={ocupado} onClick={aoBaixar} className="w-36">
      <Download className="opacity-70" aria-hidden />
      Baixar
    </Button>
  );
}
