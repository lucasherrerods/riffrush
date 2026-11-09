import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Download, Play } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { BarraDeProgresso } from "@/shared/ui/BarraDeProgresso";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
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

  const chip = (ligado: boolean) =>
    cn("rounded-full border-2 px-4 py-1 font-titulo text-base tracking-wide uppercase transition-colors", ligado ? "border-texto bg-primaria text-texto ring-2 ring-primaria" : "border-borda bg-superficie-elevada text-texto-suave hover:text-texto");

  return (
    <section aria-label="Busca de mapas" className="respiro-de-tela flex h-full flex-col">
      <div className="flex items-center gap-2">
        {aoVoltar && (
          <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
            <ArrowLeft aria-hidden />
          </Button>
        )}
        <Input type="search" placeholder="Música, artista ou mapper" aria-label="Buscar mapas" value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-6">
        <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-2">
          {STATUS.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={status === s.id} onClick={() => setStatus(s.id)} className={chip(status === s.id)}>
              {s.rotulo}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Teclas" className="flex flex-wrap gap-2">
          {TECLAS.map((k) => (
            <button key={k} type="button" aria-pressed={teclas.includes(k)} onClick={() => alternarTecla(k)} className={chip(teclas.includes(k))}>
              {k}K
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-texto-suave">Só os mapas ranked e loved baixados daqui valem XP e ranking.</p>

      {erro && (
        <p role="alert" className="text-perigo">
          {erro}
        </p>
      )}
      {mapas === null && !erro && <p className="text-texto-suave">Buscando…</p>}
      {mapas?.length === 0 && <p className="text-texto-suave">Nenhum mapa encontrado.</p>}

      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {mapas?.map((mapa) => {
          const progresso = baixando[mapa.beatmapsetId];
          const jaBaixado = baixados.has(mapa.beatmapsetId);
          return (
            <li key={mapa.beatmapsetId} className="chapa flex items-center gap-4 bg-superficie-elevada/95 p-3">
              {mapa.capa && <img src={mapa.capa} alt="" loading="lazy" className="h-14 w-24 shrink-0 rounded-md border border-borda object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-titulo text-xl tracking-wide uppercase">{mapa.tituloUnicode}</p>
                <p className="truncate text-texto-suave">
                  {mapa.artistaUnicode} · mapa de {mapa.mapper} · {mapa.status}
                </p>
                <p className="truncate text-sm text-texto-suave">
                  {mapa.dificuldades.map((d) => `${d.teclas}K ${d.estrelas.toFixed(1).replace(".", ",")}★ ${faixaDasEstrelas(d.estrelas)}`).join(" · ")}
                </p>
                {progresso !== undefined && <BarraDeProgresso fracao={progresso} rotulo={`Baixando ${mapa.titulo}`} />}
              </div>
              {jaBaixado && aoJogar ? (
                <Button className="font-titulo text-base tracking-wide text-texto uppercase" onClick={() => aoJogar(mapa.beatmapsetId)} aria-label={`Jogar ${mapa.titulo}`}>
                  <Play aria-hidden />
                  Jogar
                </Button>
              ) : jaBaixado ? (
                <span className="flex items-center gap-1 text-sucesso">
                  <Check aria-hidden className="size-4" />
                  Baixado
                </span>
              ) : (
                <Button className="font-titulo text-base tracking-wide text-texto uppercase" disabled={progresso !== undefined} onClick={() => aoClicarBaixar(mapa)} aria-label={`Baixar ${mapa.titulo}`}>
                  <Download aria-hidden />
                  Baixar
                </Button>
              )}
            </li>
          );
        })}
        {mapas && temMais && (
          <li className="flex justify-center py-2">
            <Button variant="secondary" disabled={carregandoMais} onClick={carregarMais}>
              {carregandoMais ? "Carregando…" : "Carregar mais"}
            </Button>
          </li>
        )}
      </ul>
      <p className="text-xs text-texto-suave">Mapas da comunidade do osu!, servidos por catboy.best e osu.direct.</p>
    </section>
  );
}
