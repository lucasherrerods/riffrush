import { useEffect, useState } from "react";
import { CarregarMais, Chip, GrupoDeChips, TelaDeBusca } from "@/modules/busca";
import { useValorAtrasado } from "@/shared/hooks/useValorAtrasado";
import { CampoDeSelecao } from "@/shared/ui/CampoDeSelecao";
import { ConfirmacaoDeTamanho } from "./componentes/ConfirmacaoDeTamanho";
import { ResultadoDoEncore } from "./componentes/ResultadoDoEncore";
import { buscarMd5sMaisJogados } from "@/modules/ranking";
import { useBaixarDoEncore, type AoBaixar } from "./useBaixarDoEncore";
import {
  FILTROS_PADRAO,
  usaBuscaAvancada,
  TAMANHO_DA_PAGINA,
  buscarEntreOsCharts,
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
  { id: "mais-jogadas", rotulo: "Mais jogadas no Riff Rush" },
  { id: "artista", rotulo: "Artista (A-Z)" },
  { id: "nome", rotulo: "Música (A-Z)" },
  { id: "ano-mais-novo", rotulo: "Ano: mais novas" },
  { id: "ano-mais-antigo", rotulo: "Ano: mais antigas" },
  { id: "mais-curtas", rotulo: "Mais curtas" },
  { id: "mais-longas", rotulo: "Mais longas" },
];

/** "Mais jogadas" não é ordem do Encore: a lista vem do nosso ranking e o Encore só completa os dados. */
const buscarPadrao: NonNullable<Props["buscar"]> = async (filtros, pagina, { sinal }) =>
  filtros.ordem === "mais-jogadas" ? buscarEntreOsCharts(await buscarMd5sMaisJogados({ sinal }), filtros, pagina, { sinal }) : buscarNoEncore(filtros, pagina, { sinal });

type Estado = { tipo: "carregando" } | { tipo: "pronto"; resposta: RespostaDaBusca } | { tipo: "erro"; mensagem: string };

export function TelaDeBuscaDeMusicas({ aoVoltar, buscar = buscarPadrao, atrasoMs = 500, aoBaixar, baixadas = new Set(), aoJogar }: Props) {
  const [comVideo, setComVideo] = useState(false);
  const { baixando, pergunta, baixar, responder } = useBaixarDoEncore(aoBaixar, comVideo);
  const [texto, setTexto] = useState(FILTROS_PADRAO.texto);
  const [filtros, setFiltros] = useState<Omit<FiltrosDaBusca, "texto">>(FILTROS_PADRAO);
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [carregandoMais, setCarregandoMais] = useState(false);
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
    // A primeira página troca a lista; as seguintes vão para o fim dela.
    if (pagina === 1) setEstado({ tipo: "carregando" });
    else setCarregandoMais(true);
    buscar({ ...filtros, texto: textoAtrasado }, pagina, { sinal: controle.signal })
      .then((resposta) =>
        setEstado((atual) => {
          if (pagina === 1 || atual.tipo !== "pronto") return { tipo: "pronto", resposta };
          const vistos = new Set(atual.resposta.resultados.map((r) => r.md5));
          return { tipo: "pronto", resposta: { total: resposta.total, resultados: [...atual.resposta.resultados, ...resposta.resultados.filter((r) => !vistos.has(r.md5))] } };
        }),
      )
      .catch((erro: Error) => {
        if (!controle.signal.aborted) setEstado({ tipo: "erro", mensagem: erro.message });
      })
      .finally(() => !controle.signal.aborted && setCarregandoMais(false));
    return () => controle.abort();
  }, [buscar, filtros, textoAtrasado, pagina]);

  const temMais = estado.tipo === "pronto" && pagina * TAMANHO_DA_PAGINA < estado.resposta.total;

  return (
    <>
      <TelaDeBusca
        titulo="Buscar músicas"
        rotuloDoCampo="Buscar músicas"
        placeholder={!usaBuscaAvancada({ texto, ...filtros }) ? "Nome da música, artista, álbum ou charter" : "Nome da música"}
        texto={texto}
        aoMudarTexto={setTexto}
        aoVoltar={aoVoltar}
        escBloqueado={!!pergunta}
        filtros={
          <>
            <GrupoDeChips rotulo="Instrumento" opcoes={OPCOES_DE_INSTRUMENTO} valor={filtros.instrumento} aoMudar={(instrumento) => mudarFiltros({ instrumento })} />
            <GrupoDeChips rotulo="Dificuldade" opcoes={OPCOES_DE_DIFICULDADE} valor={filtros.dificuldade} aoMudar={(dificuldade) => mudarFiltros({ dificuldade })} />
            <div className="flex flex-wrap items-end gap-6 max-md:grid max-md:w-full max-md:grid-cols-2 max-md:gap-2">
              <CampoDeSelecao titulo="Gênero" opcoes={OPCOES_DE_GENERO} valor={filtros.genero} aoEscolher={(genero) => mudarFiltros({ genero })} />
              <CampoDeSelecao titulo="Ordem" opcoes={OPCOES_DE_ORDEM} valor={filtros.ordem} aoEscolher={(ordem) => mudarFiltros({ ordem })} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip rotulo="Só com vídeo" ligado={filtros.soComVideo} aoMudar={(soComVideo) => mudarFiltros({ soComVideo })} />
              <Chip rotulo="Oficiais" ligado={filtros.soOficiais} aoMudar={(soOficiais) => mudarFiltros({ soOficiais })} />
              {aoBaixar && <Chip rotulo="Baixar com vídeo de fundo" ligado={comVideo} aoMudar={setComVideo} />}
            </div>
          </>
        }
        estado={estado.tipo === "pronto" ? { tipo: "pronto", vazio: estado.resposta.resultados.length === 0 } : estado}
        mensagemDeVazio="Nenhuma música encontrada. Tente outro nome ou tire algum filtro."
        fonte="Charts da comunidade, servidos pelo Chorus Encore (enchor.us)."
      >
        {estado.tipo === "pronto" &&
          estado.resposta.resultados.map((r) => (
            <ResultadoDoEncore
              key={r.md5}
              resultado={r}
              baixada={baixadas.has(r.md5)}
              baixando={baixando?.md5 === r.md5 ? baixando.fracao : undefined}
              ocupado={!!baixando}
              aoBaixar={aoBaixar && (() => void baixar(r))}
              aoJogar={() => aoJogar?.(r.md5)}
            />
          ))}
        {temMais && <CarregarMais carregando={carregandoMais} aoCarregar={() => setPagina((p) => p + 1)} />}
      </TelaDeBusca>
      {pergunta && <ConfirmacaoDeTamanho titulo={pergunta.titulo} bytes={pergunta.bytes} aoResponder={responder} />}
    </>
  );
}
