import { useEffect, useRef } from "react";
import { ArrowLeft, FileAudio, Flame, Play, Star, Trophy } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import type { Personagem } from "@/modules/character";
import { carregarRecordes, recordeDe } from "@/modules/results";
import { DIFICULDADES, type Dificuldade, type Musica } from "@/modules/songs";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { AvatarPalhetando } from "./componentes/AvatarPalhetando";
import { Capa } from "./componentes/Capa";

interface Props {
  musicas: Musica[];
  indice: number;
  dificuldade: Dificuldade;
  personagem: Personagem;
  volumeDosEfeitos: number;
  aoSelecionar: (indice: number) => void;
  aoDificuldade: (dificuldade: Dificuldade) => void;
  aoJogar: () => void;
  aoVoltar: () => void;
  aoImportar: (arquivos: File[]) => void;
}

const TIPOS_IMPORTAVEIS = "audio/*,video/*,.sng";
const formatar = (n: number) => n.toLocaleString("pt-BR");

export function TelaDeSelecao(props: Props) {
  const { musicas, indice, dificuldade, personagem, volumeDosEfeitos, aoSelecionar, aoDificuldade, aoJogar, aoVoltar, aoImportar } = props;
  const lista = useRef<HTMLUListElement>(null);
  const recordes = carregarRecordes();
  const musica = musicas[indice];
  const recordeAtual = recordeDe(recordes, musica.id, dificuldade);
  const efeito = (nome: "mover" | "selecionar" | "voltar") => tocarEfeito(nome, volumeDosEfeitos);

  useEffect(() => {
    lista.current?.querySelector(`[data-indice="${indice}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [indice]);

  useTeclado((evento) => {
    const posicao = DIFICULDADES.findIndex((d) => d.id === dificuldade);
    if (evento.code === "ArrowDown" || evento.code === "ArrowUp") {
      evento.preventDefault();
      efeito("mover");
      aoSelecionar((indice + (evento.code === "ArrowDown" ? 1 : musicas.length - 1)) % musicas.length);
    } else if (evento.code === "ArrowLeft" || evento.code === "ArrowRight") {
      const proxima = DIFICULDADES[posicao + (evento.code === "ArrowRight" ? 1 : -1)];
      if (proxima) {
        efeito("mover");
        aoDificuldade(proxima.id);
      }
    } else if (evento.code === "Enter") {
      efeito("selecionar");
      aoJogar();
    } else if (evento.code === "Escape" || evento.code === "Backspace") {
      efeito("voltar");
      aoVoltar();
    }
  });

  return (
    <div className="flex h-full flex-col gap-6 p-8 max-md:gap-4 max-md:p-4">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-4xl leading-[1.1] font-black tracking-[-0.02em] max-md:text-2xl">Escolha a música</h1>
        <div className="flex-1" />
        <Button variant="outline" asChild>
          <label className="cursor-pointer">
            <FileAudio className="opacity-70" />
            <span className="max-md:sr-only">Importar música, clipe ou .sng</span>
            <input
              type="file"
              accept={TIPOS_IMPORTAVEIS}
              multiple
              className="sr-only"
              onChange={(e) => {
                aoImportar(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-6 max-md:grid-cols-1">
        <ul ref={lista} className="col-span-5 flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto pr-2">
          {musicas.map((m, i) => {
            const selecionada = i === indice;
            const recorde = recordeDe(recordes, m.id, dificuldade);
            return (
              <li key={m.id} data-indice={i}>
                <button
                  aria-current={selecionada}
                  onClick={() => {
                    if (selecionada) return aoJogar();
                    efeito("mover");
                    aoSelecionar(i);
                  }}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-2xl border p-2 text-left transition-colors",
                    selecionada ? "border-primaria bg-superficie-elevada" : "border-transparent bg-superficie hover:bg-superficie-elevada",
                  )}
                >
                  <Capa musica={m} decorativa className="size-12 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold">{m.titulo}</span>
                    <span className="block truncate text-base text-texto-suave">{m.artista}</span>
                  </span>
                  {recorde && (
                    <span className="flex gap-1 pr-2" aria-label={`${recorde.estrelas} estrelas`}>
                      {Array.from({ length: 5 }, (_, k) => (
                        <Star key={k} className={cn("size-3", k < recorde.estrelas ? "fill-[#facc15] text-[#facc15]" : "text-borda")} />
                      ))}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <section className="col-span-7 flex min-w-0 flex-col gap-6 rounded-3xl border border-borda bg-superficie p-6 max-md:gap-4 max-md:p-4">
          <div className="flex items-center gap-6">
            <Capa musica={musica} girando className="size-44 rounded-2xl max-md:hidden" />
            <div className="flex min-w-0 flex-col gap-2">
              <span className="w-fit rounded-full bg-superficie-elevada px-3 py-1 text-base">{musica.genero}</span>
              <h2 className="text-3xl leading-[1.1] font-black tracking-[-0.02em] max-md:text-xl">{musica.titulo}</h2>
              <p className="text-lg text-texto-suave">{musica.artista}</p>
              <div className="flex items-center gap-4 text-base text-texto-suave">
                {musica.bpm > 0 && <span>{musica.bpm} BPM</span>}
                <span className="flex gap-1" aria-label={`Intensidade ${musica.intensidade} de 5`}>
                  {Array.from({ length: 5 }, (_, k) => (
                    <Flame key={k} className={cn("size-4", k < musica.intensidade ? "text-destaque" : "text-borda")} />
                  ))}
                </span>
              </div>
            </div>
            <AvatarPalhetando personagem={personagem} bpm={musica.bpm || 120} className="ml-auto h-44 w-auto shrink-0 max-md:h-24" />
          </div>

          <div>
            <p className="mb-2 text-base font-semibold text-texto-suave">Dificuldade (← →)</p>
            <div role="radiogroup" aria-label="Dificuldade" className="grid grid-cols-4 gap-2">
              {DIFICULDADES.map((d) => {
                const recorde = recordeDe(recordes, musica.id, d.id);
                const escolhida = d.id === dificuldade;
                return (
                  <button
                    key={d.id}
                    role="radio"
                    aria-checked={escolhida}
                    onClick={() => {
                      efeito("mover");
                      aoDificuldade(d.id);
                    }}
                    className={cn(
                      "rounded-2xl border p-4 transition-colors",
                      escolhida ? "border-destaque bg-superficie-elevada" : "border-borda hover:bg-superficie-elevada",
                    )}
                  >
                    <span className="block text-base font-bold">{d.rotulo}</span>
                    <span className="block font-mono text-base text-texto-suave">{recorde ? formatar(recorde.pontos) : "—"}</span>
                    {recorde?.fullCombo && <span className="block text-base font-black text-destaque">FC</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {recordeAtual && (
            <p className="flex items-center gap-2 text-base text-texto-suave">
              <Trophy className="size-4 text-[#facc15] opacity-70" /> Recorde:
              <span className="font-mono font-bold text-texto">{formatar(recordeAtual.pontos)}</span>
            </p>
          )}

          <div className="flex-1" />
          <Button
            size="lg"
            className="h-14 text-lg font-black"
            onClick={() => {
              efeito("selecionar");
              aoJogar();
            }}
          >
            <Play className="fill-current opacity-70" /> TOCAR
          </Button>
        </section>
      </div>
    </div>
  );
}
