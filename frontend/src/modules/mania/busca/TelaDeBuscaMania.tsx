import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { AcaoDaBusca, Chip, GrupoDeChips, ItemDaBusca, TelaDeBusca, type EstadoDaBusca } from "@/modules/busca";
import { faixaDasEstrelas } from "../beatmaps/dificuldades";
import { baixarOsz, buscarMapas, type FiltrosDaBusca, type MapaDaBusca, type PaginaDaBusca, type StatusDaBusca } from "./api";

const STATUS: { id: StatusDaBusca; rotulo: string }[] = [
  { id: "ranked", rotulo: "Ranked" },
  { id: "loved", rotulo: "Loved" },
  { id: "qualified", rotulo: "Qualified" },
  { id: "todos", rotulo: "Todos" },
];
const TECLAS = [4, 5, 6, 7, 8, 9, 10];
/** Espera o jogador parar de digitar antes de pedir aos espelhos. */
const ESPERA_DA_DIGITACAO_MS = 300;

interface Props {
  aoVoltar?: () => void;
  /** Os conjuntos que já estão na biblioteca, pelo beatmapset_id. */
  baixados: Set<number>;
  aoBaixar: (osz: Blob, mapa: MapaDaBusca) => Promise<void>;
  /** Abre o conjunto já baixado na seleção, pronto para jogar; sem ele, só aparece "Baixado". */
  aoJogar?: (beatmapsetId: number) => void;
  /** Para os testes. */
  buscar?: (filtros: FiltrosDaBusca) => Promise<PaginaDaBusca>;
  baixar?: typeof baixarOsz;
}

export function TelaDeBuscaMania({ aoVoltar, baixados, aoBaixar, aoJogar, buscar = buscarMapas, baixar = baixarOsz }: Props) {
  const [texto, setTexto] = useState("");
  const [status, setStatus] = useState<StatusDaBusca>("ranked");
  const [teclas, setTeclas] = useState<number[]>([]);
  const [mapas, setMapas] = useState<MapaDaBusca[] | null>(null);
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<Record<number, number>>({});
  const pedido = useRef(0);

  useEffect(() => {
    const numero = ++pedido.current;
    const espera = setTimeout(() => {
      setErro(null);
      setPagina(0);
      buscar({ texto, status, teclas })
        .then((resultado) => {
          if (numero !== pedido.current) return;
          setMapas(resultado.mapas);
          setTemMais(resultado.temMais);
        })
        .catch((e: unknown) => numero === pedido.current && setErro(e instanceof Error ? e.message : String(e)));
    }, ESPERA_DA_DIGITACAO_MS);
    return () => clearTimeout(espera);
  }, [texto, status, teclas, buscar]);

  const carregarMais = async () => {
    const numero = pedido.current;
    const proxima = pagina + 1;
    setCarregandoMais(true);
    try {
      const resultado = await buscar({ texto, status, teclas, pagina: proxima });
      if (numero !== pedido.current) return;
      // Um conjunto novo no osu! empurra a lista: o mesmo mapa pode reaparecer na página seguinte.
      setMapas((atuais) => {
        const vistos = new Set(atuais?.map((m) => m.beatmapsetId));
        return [...(atuais ?? []), ...resultado.mapas.filter((m) => !vistos.has(m.beatmapsetId))];
      });
      setPagina(proxima);
      setTemMais(resultado.temMais);
    } catch (e) {
      if (numero === pedido.current) setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregandoMais(false);
    }
  };

  const alternarTecla = (k: number) => setTeclas((atuais) => (atuais.includes(k) ? atuais.filter((t) => t !== k) : [...atuais, k]));

  const aoClicarBaixar = async (mapa: MapaDaBusca) => {
    setBaixando((b) => ({ ...b, [mapa.beatmapsetId]: 0 }));
    try {
      const osz = await baixar(mapa.beatmapsetId, { aoProgredir: (p) => setBaixando((b) => ({ ...b, [mapa.beatmapsetId]: p })) });
      await aoBaixar(osz, mapa);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setBaixando(({ [mapa.beatmapsetId]: _, ...resto }) => resto);
    }
  };

  const estado: EstadoDaBusca = erro ? { tipo: "erro", mensagem: erro } : mapas === null ? { tipo: "carregando" } : { tipo: "pronto", vazio: mapas.length === 0 };

  return (
    <TelaDeBusca
      titulo="Buscar mapas"
      rotuloDoCampo="Buscar mapas"
      placeholder="Música, artista ou mapper"
      texto={texto}
      aoMudarTexto={setTexto}
      aoVoltar={aoVoltar}
      filtros={
        <>
          <GrupoDeChips rotulo="Status" opcoes={STATUS} valor={status} aoMudar={setStatus} />
          <div role="group" aria-label="Teclas" className="flex flex-wrap gap-2">
            {TECLAS.map((k) => (
              <Chip key={k} rotulo={`${k}K`} ligado={teclas.includes(k)} aoMudar={() => alternarTecla(k)} />
            ))}
          </div>
        </>
      }
      aviso="Só os mapas ranked e loved baixados daqui valem XP e ranking."
      estado={estado}
      mensagemDeVazio="Nenhum mapa encontrado."
      fonte="Mapas da comunidade do osu!, servidos por catboy.best e osu.direct."
    >
      {mapas?.map((mapa) => {
        const progresso = baixando[mapa.beatmapsetId];
        return (
          <ItemDaBusca
            key={mapa.beatmapsetId}
            titulo={mapa.tituloUnicode}
            capa={mapa.capa}
            linhas={[
              `${mapa.artistaUnicode} · mapa de ${mapa.mapper} · ${mapa.status}`,
              mapa.dificuldades.map((d) => `${d.teclas}K ${d.estrelas.toFixed(1).replace(".", ",")}★ ${faixaDasEstrelas(d.estrelas)}`).join(" · "),
            ]}
            progresso={progresso}
            acao={
              <AcaoDaBusca
                nome={mapa.titulo}
                estado={
                  baixados.has(mapa.beatmapsetId)
                    ? { tipo: "baixado", aoJogar: aoJogar && (() => aoJogar(mapa.beatmapsetId)) }
                    : progresso !== undefined
                      ? { tipo: "baixando" }
                      : { tipo: "baixavel", aoBaixar: () => void aoClicarBaixar(mapa) }
                }
              />
            }
          />
        );
      })}
      {mapas && temMais && (
        <li className="flex justify-center py-2">
          <Button variant="secondary" disabled={carregandoMais} onClick={carregarMais}>
            {carregandoMais ? "Carregando…" : "Carregar mais"}
          </Button>
        </li>
      )}
    </TelaDeBusca>
  );
}
