import { useEffect, useRef, useState, type DragEvent } from "react";
import { Music, Upload } from "lucide-react";
import { Carrossel, passosSemDarAVolta, type DificuldadeDoCarrossel, type ItemDoCarrossel } from "@/modules/selecao";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";
import { faixaDasEstrelas, type FaixaDeDificuldade } from "../beatmaps/dificuldades";
import { TeclaDoMania } from "../menu/TeclaDoMania";
import type { PosicaoNoRankingDoMania } from "../ranking/api";
import { PainelDoRankingDoMania } from "../ranking/PainelDoRankingDoMania";
import { SeletorDeMods } from "./SeletorDeMods";

interface Props {
  conjuntos: ConjuntoSalvo[] | null;
  mods: number;
  aoMudarMods: (mods: number) => void;
  aoImportar: (arquivos: File[]) => void;
  aoJogar: (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva) => void;
  /** Abre o mapa no treino; sem ele o botão não aparece. */
  aoTreinar?: (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva) => void;
  /** Assistir ao replay de uma partida do ranking da dificuldade escolhida. */
  aoAssistir?: (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva, linha: PosicaoNoRankingDoMania) => void;
}

const ehOsz = (arquivo: File) => arquivo.name.toLowerCase().endsWith(".osz");

/** A faixa de estrelas do osu! dá a cor da faixa lateral, do verde ao rosa, como as dificuldades do Rock. */
const COR_DA_FAIXA: Record<FaixaDeDificuldade, string> = {
  Easy: "bg-sucesso",
  Normal: "bg-ouro",
  Hard: "bg-destaque",
  Insane: "bg-primaria",
  Expert: "bg-texto",
  "Expert+": "bg-texto",
};

function rotuloDaDificuldade(conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva) {
  const estrelas = conjunto.estrelas?.[dificuldade.hash];
  return (
    <span className="flex items-baseline gap-2">
      <span>{dificuldade.teclas}K</span>
      <span className="truncate normal-case">{dificuldade.dificuldade}</span>
      {estrelas !== undefined && <span className="font-mono text-base text-texto-suave">{estrelas.toFixed(2).replace(".", ",")}★</span>}
    </span>
  );
}

const capa = <TeclaDoMania icone={Music} className="size-full" />;

/** A seleção do Mania: os conjuntos na mesma roda da seleção do Rock, com as dificuldades abertas no selecionado. */
export function TelaDeSelecaoMania({ conjuntos, mods, aoMudarMods, aoImportar, aoJogar, aoTreinar, aoAssistir }: Props) {
  const [indice, setIndice] = useState(0);
  const [hash, setHash] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);

  const lista = conjuntos ?? [];
  const conjunto = lista[Math.min(indice, lista.length - 1)] as ConjuntoSalvo | undefined;
  const dificuldade = conjunto?.mapas.find((m) => m.hash === hash) ?? conjunto?.mapas[0];
  // Ao chegar um mapa novo (importado), a seleção não sai do lugar; se a lista encolher, volta para dentro dela.
  useEffect(() => {
    if (indice >= lista.length && lista.length) setIndice(lista.length - 1);
  }, [indice, lista.length]);

  const receber = (arquivos: FileList | null) => {
    const osz = [...(arquivos ?? [])].filter(ehOsz);
    if (osz.length) aoImportar(osz);
  };
  const aoSoltar = (evento: DragEvent) => {
    evento.preventDefault();
    setArrastando(false);
    receber(evento.dataTransfer.files);
  };

  const itens: ItemDoCarrossel[] = lista.map((c) => ({ id: c.id, titulo: c.tituloUnicode || c.titulo, artista: c.artistaUnicode || c.artista, capa }));
  const dificuldades: DificuldadeDoCarrossel[] = (conjunto?.mapas ?? []).map((m) => {
    const estrelas = conjunto?.estrelas?.[m.hash];
    return { id: m.hash, rotulo: rotuloDaDificuldade(conjunto!, m), cor: estrelas === undefined ? "bg-borda" : COR_DA_FAIXA[faixaDasEstrelas(estrelas)] };
  });
  const jogar = () => conjunto && dificuldade && aoJogar(conjunto, dificuldade);

  return (
    <section
      aria-label="Seleção de mapas"
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={aoSoltar}
      className={cn("grid h-full grid-cols-12 gap-6 p-6 max-md:grid-cols-1 max-md:p-4", arrastando && "outline-2 outline-dashed outline-primaria -outline-offset-8")}
    >
      <aside className="col-span-5 flex min-h-0 flex-col gap-4 max-md:col-span-1">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SeletorDeMods mods={mods} aoMudar={aoMudarMods} />
          <Button variant="secondary" className="chapa h-10 rounded-none border-borda bg-superficie-elevada" onClick={() => seletor.current?.click()}>
            <Upload aria-hidden className="text-primaria" />
            Importar .osz
          </Button>
          <input ref={seletor} type="file" accept=".osz" multiple aria-label="Arquivos .osz" className="sr-only" onChange={(e) => receber(e.target.files)} />
        </div>

        {conjunto && (
          <div className="chapa bg-superficie-elevada/95 px-4 py-3">
            <h2 className="font-titulo text-3xl tracking-wide uppercase">{conjunto.tituloUnicode || conjunto.titulo}</h2>
            <p className="text-texto-suave">
              {conjunto.artistaUnicode || conjunto.artista} · mapa de {conjunto.mapper}
            </p>
            {conjunto.origem === "importado" && <p className="text-sm text-texto-suave">Importado · sem XP</p>}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {dificuldade?.beatmapId && conjunto?.origem === "osu" && (
            <PainelDoRankingDoMania beatmapId={dificuldade.beatmapId} aoAssistir={aoAssistir && ((linha) => aoAssistir(conjunto, dificuldade, linha))} />
          )}
        </div>

        <div className="flex justify-end gap-2">
          {aoTreinar && (
            <Button
              variant="outline"
              className="h-10 border-primaria bg-superficie-elevada px-6 font-titulo text-lg tracking-wide text-primaria uppercase"
              disabled={!dificuldade}
              onClick={() => conjunto && dificuldade && aoTreinar(conjunto, dificuldade)}
            >
              Treinar
            </Button>
          )}
          <Button className="h-10 px-8 font-titulo text-lg tracking-wide text-texto uppercase" disabled={!dificuldade} onClick={jogar}>
            Jogar
          </Button>
        </div>
      </aside>

      {conjuntos === null && <p className="col-span-7 text-texto-suave">Abrindo a biblioteca…</p>}
      {conjuntos?.length === 0 && (
        <p className="chapa col-span-7 m-auto max-w-md bg-superficie-elevada/90 px-6 py-4 text-center text-texto-suave">Nenhum mapa ainda. Arraste um .osz para cá ou use o botão de importar.</p>
      )}
      {!!lista.length && (
        <Carrossel
          rotulo="Mapas"
          itens={itens}
          indice={Math.min(indice, lista.length - 1)}
          dificuldade={dificuldade?.hash ?? ""}
          dificuldades={dificuldades}
          aoEscolherItem={(i) => {
            setIndice(i);
            setHash(null);
          }}
          aoEscolherDificuldade={setHash}
          aoJogar={jogar}
          aoGirar={(passos) => {
            const permitidos = passosSemDarAVolta(indice, passos, lista.length);
            if (!permitidos) return;
            setIndice(indice + permitidos);
            setHash(null);
          }}
        />
      )}
    </section>
  );
}
