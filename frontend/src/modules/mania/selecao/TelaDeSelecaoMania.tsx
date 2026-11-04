import { useRef, useState, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";
import { faixaDasEstrelas } from "../beatmaps/dificuldades";
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
}

const ehOsz = (arquivo: File) => arquivo.name.toLowerCase().endsWith(".osz");

function RotuloDaDificuldade({ conjunto, dificuldade }: { conjunto: ConjuntoSalvo; dificuldade: DificuldadeSalva }) {
  const estrelas = conjunto.estrelas?.[dificuldade.hash];
  return (
    <span className="flex items-baseline gap-2">
      <span className="font-titulo text-lg tracking-wide">{dificuldade.teclas}K</span>
      <span>{dificuldade.dificuldade}</span>
      {estrelas !== undefined && (
        <span className="text-texto-suave">
          {estrelas.toFixed(2).replace(".", ",")}★ {faixaDasEstrelas(estrelas)}
        </span>
      )}
    </span>
  );
}

export function TelaDeSelecaoMania({ conjuntos, mods, aoMudarMods, aoImportar, aoJogar, aoTreinar }: Props) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [escolhida, setEscolhida] = useState<{ conjunto: ConjuntoSalvo; dificuldade: DificuldadeSalva } | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);

  const receber = (arquivos: FileList | null) => {
    const osz = [...(arquivos ?? [])].filter(ehOsz);
    if (osz.length) aoImportar(osz);
  };
  const aoSoltar = (evento: DragEvent) => {
    evento.preventDefault();
    setArrastando(false);
    receber(evento.dataTransfer.files);
  };

  return (
    <section
      aria-label="Seleção de mapas"
      onDragOver={(e) => {
        e.preventDefault();
        setArrastando(true);
      }}
      onDragLeave={() => setArrastando(false)}
      onDrop={aoSoltar}
      className={cn("flex h-full flex-col gap-6 p-6", arrastando && "outline-2 outline-dashed outline-primaria -outline-offset-8")}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SeletorDeMods mods={mods} aoMudar={aoMudarMods} />
        <Button variant="secondary" className="chapa h-10 rounded-none border-borda bg-superficie-elevada" onClick={() => seletor.current?.click()}>
          <Upload aria-hidden className="text-primaria" />
          Importar .osz
        </Button>
        <input ref={seletor} type="file" accept=".osz" multiple aria-label="Arquivos .osz" className="sr-only" onChange={(e) => receber(e.target.files)} />
      </div>

      {conjuntos === null && <p className="text-texto-suave">Abrindo a biblioteca…</p>}
      {conjuntos?.length === 0 && (
        <p className="chapa m-auto max-w-md bg-superficie-elevada/90 px-6 py-4 text-center text-texto-suave">Nenhum mapa ainda. Arraste um .osz para cá ou use o botão de importar.</p>
      )}

      {!!conjuntos?.length && (
        <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {conjuntos.map((conjunto) => {
            const expandido = aberto === conjunto.id;
            return (
              <li key={conjunto.id} className={cn("chapa bg-superficie-elevada/95", expandido && "border-primaria")}>
                <button
                  type="button"
                  aria-expanded={expandido}
                  onClick={() => setAberto(expandido ? null : conjunto.id)}
                  className="flex w-full items-baseline justify-between gap-4 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block font-titulo text-xl tracking-wide uppercase">{conjunto.tituloUnicode || conjunto.titulo}</span>
                    <span className="text-texto-suave">
                      {conjunto.artistaUnicode || conjunto.artista} · mapa de {conjunto.mapper}
                    </span>
                  </span>
                  {conjunto.origem === "importado" && <span className="text-sm text-texto-suave">Importado · sem XP</span>}
                </button>
                {expandido && (
                  <ul aria-label="Dificuldades" className="flex flex-col border-t border-borda">
                    {conjunto.mapas.map((dificuldade) => {
                      const selecionada = escolhida?.dificuldade.hash === dificuldade.hash;
                      return (
                        <li key={dificuldade.hash}>
                          <button
                            type="button"
                            aria-pressed={selecionada}
                            onClick={() => setEscolhida({ conjunto, dificuldade })}
                            className={cn("w-full px-4 py-2 text-left transition-colors hover:bg-primaria/10", selecionada && "bg-primaria text-superficie-elevada hover:bg-primaria [&_.text-texto-suave]:text-superficie-elevada/80")}
                          >
                            <RotuloDaDificuldade conjunto={conjunto} dificuldade={dificuldade} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {escolhida?.dificuldade.beatmapId && escolhida.conjunto.origem === "osu" && <PainelDoRankingDoMania beatmapId={escolhida.dificuldade.beatmapId} />}
      <div className="flex justify-end gap-2">
        {aoTreinar && (
          <Button variant="outline" className="h-10 border-primaria bg-superficie-elevada px-6 font-titulo text-lg tracking-wide text-primaria uppercase" disabled={!escolhida} onClick={() => escolhida && aoTreinar(escolhida.conjunto, escolhida.dificuldade)}>
            Treinar
          </Button>
        )}
        <Button className="h-10 px-8 font-titulo text-lg tracking-wide text-superficie-elevada uppercase" disabled={!escolhida} onClick={() => escolhida && aoJogar(escolhida.conjunto, escolhida.dificuldade)}>
          Jogar
        </Button>
      </div>
    </section>
  );
}
