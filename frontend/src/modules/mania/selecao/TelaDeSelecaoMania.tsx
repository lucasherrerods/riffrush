import { useRef, useState, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";
import { faixaDasEstrelas } from "../beatmaps/dificuldades";
import { SeletorDeMods } from "./SeletorDeMods";

interface Props {
  conjuntos: ConjuntoSalvo[] | null;
  mods: number;
  aoMudarMods: (mods: number) => void;
  aoImportar: (arquivos: File[]) => void;
  aoJogar: (conjunto: ConjuntoSalvo, dificuldade: DificuldadeSalva) => void;
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

export function TelaDeSelecaoMania({ conjuntos, mods, aoMudarMods, aoImportar, aoJogar }: Props) {
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
        <Button variant="secondary" onClick={() => seletor.current?.click()}>
          <Upload aria-hidden className="opacity-70" />
          Importar .osz
        </Button>
        <input ref={seletor} type="file" accept=".osz" multiple aria-label="Arquivos .osz" className="sr-only" onChange={(e) => receber(e.target.files)} />
      </div>

      {conjuntos === null && <p className="text-texto-suave">Abrindo a biblioteca…</p>}
      {conjuntos?.length === 0 && (
        <p className="m-auto max-w-md text-center text-texto-suave">Nenhum mapa ainda. Arraste um .osz para cá ou use o botão de importar.</p>
      )}

      {!!conjuntos?.length && (
        <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {conjuntos.map((conjunto) => {
            const expandido = aberto === conjunto.id;
            return (
              <li key={conjunto.id} className="rounded-md border border-borda bg-superficie">
                <button
                  type="button"
                  aria-expanded={expandido}
                  onClick={() => setAberto(expandido ? null : conjunto.id)}
                  className="flex w-full items-baseline justify-between gap-4 px-4 py-3 text-left"
                >
                  <span>
                    <span className="block font-semibold">{conjunto.tituloUnicode || conjunto.titulo}</span>
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
                            className={cn("w-full px-4 py-2 text-left hover:bg-superficie-elevada", selecionada && "bg-superficie-elevada")}
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

      <div className="flex justify-end">
        <Button disabled={!escolhida} onClick={() => escolhida && aoJogar(escolhida.conjunto, escolhida.dificuldade)}>
          Jogar
        </Button>
      </div>
    </section>
  );
}
