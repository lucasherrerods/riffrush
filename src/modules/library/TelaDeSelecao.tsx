import { useEffect, useRef, type ReactNode } from "react";
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
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 bg-superficie px-8 py-4 max-md:px-4 max-md:py-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="font-display text-3xl leading-[1.1] font-bold tracking-[0.04em] text-destaque uppercase max-md:text-xl">Selecione a música</h1>
        <div className="flex-1" />
        <Button variant="outline" asChild>
          <label className="cursor-pointer font-display tracking-[0.04em] uppercase">
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

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-8 p-8 max-md:grid-cols-1 max-md:gap-4 max-md:p-4">
        <section aria-label="Informações da música" className="col-span-5 flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto max-md:col-span-1">
          <div className="flex gap-4">
            <Capa musica={musica} girando className="aspect-square w-1/2 rounded-md border border-borda max-md:hidden" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 max-md:flex-row">
              {musica.bpm > 0 && <Dado rotulo="BPM">{musica.bpm}</Dado>}
              <Dado rotulo="Gênero">{musica.genero}</Dado>
              <Dado rotulo="Intensidade" className="max-md:hidden">
                <span className="flex gap-1 py-1" aria-label={`Intensidade ${musica.intensidade} de 5`}>
                  {Array.from({ length: 5 }, (_, k) => (
                    <Flame key={k} className={cn("size-4", k < musica.intensidade ? "text-destaque" : "text-borda")} />
                  ))}
                </span>
              </Dado>
            </div>
          </div>

          <div className="min-w-0">
            <h2 className="truncate font-display text-3xl leading-[1.1] font-bold uppercase max-md:text-xl">{musica.titulo}</h2>
            <p className="truncate text-lg text-texto-suave">{musica.artista}</p>
          </div>

          <div className="flex items-end gap-4 rounded-md border border-borda bg-superficie p-4">
            <AvatarPalhetando personagem={personagem} bpm={musica.bpm || 120} className="h-40 w-auto shrink-0 max-md:hidden" />
            <div role="radiogroup" aria-label="Dificuldade" className="flex flex-1 flex-col gap-2 max-md:flex-row">
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
                      "flex items-center gap-2 rounded-sm border px-4 py-1 text-left transition-colors max-md:flex-1 max-md:flex-col max-md:px-2",
                      escolhida ? "border-destaque bg-destaque/15" : "border-transparent bg-superficie-elevada hover:border-borda",
                    )}
                  >
                    <span className={cn("flex-1 font-display text-base font-semibold tracking-[0.04em] uppercase", escolhida && "text-destaque")}>{d.rotulo}</span>
                    {recorde?.fullCombo && <span className="font-display text-base font-bold text-destaque">FC</span>}
                    <span className="font-mono text-base text-texto-suave">{recorde ? formatar(recorde.pontos) : "—"}</span>
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
            className="h-14 font-display text-xl font-bold tracking-[0.08em]"
            onClick={() => {
              efeito("selecionar");
              aoJogar();
            }}
          >
            <Play className="fill-current opacity-70" /> TOCAR
          </Button>
        </section>

        <ul ref={lista} aria-label="Músicas" className="col-span-7 flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto pr-2 max-md:col-span-1">
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
                    "flex w-full items-center gap-4 rounded-md border-2 px-4 py-2 text-left transition-colors",
                    selecionada ? "border-destaque bg-destaque/15" : "border-transparent bg-superficie hover:bg-superficie-elevada",
                  )}
                >
                  <Capa musica={m} decorativa className="size-12 rounded-sm" />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate font-display text-xl leading-[1.2] font-bold", selecionada && "text-destaque")}>{m.titulo}</span>
                    <span className="block truncate text-base text-texto-suave">{m.artista}</span>
                  </span>
                  {recorde && (
                    <span className="flex gap-1" aria-label={`${recorde.estrelas} estrelas`}>
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
      </div>

      <footer className="flex items-center gap-8 bg-superficie px-8 py-2 max-md:hidden">
        <Comando teclas="← →">Dificuldade</Comando>
        <Comando teclas="↑ ↓">Música</Comando>
        <Comando teclas="Enter">Confirmar</Comando>
        <Comando teclas="Esc">Voltar</Comando>
      </footer>
    </div>
  );
}

function Dado({ rotulo, className, children }: { rotulo: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-w-0 rounded-md border border-borda bg-superficie px-4 py-2 max-md:flex-1", className)}>
      <span className="block font-display text-base font-semibold tracking-[0.04em] text-destaque uppercase">{rotulo}</span>
      <span className="block truncate text-xl font-semibold">{children}</span>
    </div>
  );
}

function Comando({ teclas, children }: { teclas: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-base">
      <kbd className="rounded-sm bg-superficie-elevada px-2 font-mono text-texto-suave">{teclas}</kbd>
      <span className="font-display font-semibold tracking-[0.04em] uppercase">{children}</span>
    </span>
  );
}
