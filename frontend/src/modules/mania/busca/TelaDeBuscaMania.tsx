import { useEffect, useRef, useState } from "react";
import { Check, Download } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { BarraDeProgresso } from "@/shared/ui/BarraDeProgresso";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { faixaDasEstrelas } from "../beatmaps/dificuldades";
import { baixarOsz, buscarMapas, type FiltrosDaBusca, type MapaDaBusca, type StatusDaBusca } from "./api";

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
  /** Os conjuntos que já estão na biblioteca, pelo beatmapset_id. */
  baixados: Set<number>;
  aoBaixar: (osz: Blob, mapa: MapaDaBusca) => Promise<void>;
  /** Para os testes. */
  buscar?: (filtros: FiltrosDaBusca) => Promise<MapaDaBusca[]>;
  baixar?: typeof baixarOsz;
}

export function TelaDeBuscaMania({ baixados, aoBaixar, buscar = buscarMapas, baixar = baixarOsz }: Props) {
  const [texto, setTexto] = useState("");
  const [status, setStatus] = useState<StatusDaBusca>("ranked");
  const [teclas, setTeclas] = useState<number[]>([]);
  const [mapas, setMapas] = useState<MapaDaBusca[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [baixando, setBaixando] = useState<Record<number, number>>({});
  const pedido = useRef(0);

  useEffect(() => {
    const numero = ++pedido.current;
    const espera = setTimeout(() => {
      setErro(null);
      buscar({ texto, status, teclas })
        .then((lista) => numero === pedido.current && setMapas(lista))
        .catch((e: unknown) => numero === pedido.current && setErro(e instanceof Error ? e.message : String(e)));
    }, ESPERA_DA_DIGITACAO_MS);
    return () => clearTimeout(espera);
  }, [texto, status, teclas, buscar]);

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
    cn("rounded-md border px-3 py-1 text-sm transition-colors", ligado ? "border-primaria bg-primaria text-texto" : "border-borda bg-superficie-elevada text-texto-suave hover:text-texto");

  return (
    <section aria-label="Busca de mapas" className="respiro-de-tela flex h-full flex-col">
      <Input type="search" placeholder="Música, artista ou mapper" aria-label="Buscar mapas" value={texto} onChange={(e) => setTexto(e.target.value)} />
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
            <li key={mapa.beatmapsetId} className="flex items-center gap-4 rounded-md border border-borda bg-superficie p-3">
              {mapa.capa && <img src={mapa.capa} alt="" loading="lazy" className="h-14 w-20 rounded-sm object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{mapa.tituloUnicode}</p>
                <p className="truncate text-texto-suave">
                  {mapa.artistaUnicode} · mapa de {mapa.mapper} · {mapa.status}
                </p>
                <p className="truncate text-sm text-texto-suave">
                  {mapa.dificuldades.map((d) => `${d.teclas}K ${d.estrelas.toFixed(1).replace(".", ",")}★ ${faixaDasEstrelas(d.estrelas)}`).join(" · ")}
                </p>
                {progresso !== undefined && <BarraDeProgresso fracao={progresso} rotulo={`Baixando ${mapa.titulo}`} />}
              </div>
              {jaBaixado ? (
                <span className="flex items-center gap-1 text-sucesso">
                  <Check aria-hidden className="size-4" />
                  Baixado
                </span>
              ) : (
                <Button variant="secondary" disabled={progresso !== undefined} onClick={() => aoClicarBaixar(mapa)} aria-label={`Baixar ${mapa.titulo}`}>
                  <Download aria-hidden className="opacity-70" />
                  Baixar
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-texto-suave">Mapas da comunidade do osu!, servidos por catboy.best e osu.direct.</p>
    </section>
  );
}
