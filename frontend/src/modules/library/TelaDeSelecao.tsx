import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, FileAudio, Flame, Info, ListOrdered, Play, RotateCcw, Trash2, Trophy } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import type { Personagem } from "@/modules/character";
import { rotuloDoComando, useDispositivo } from "@/modules/gamepad";
import { carregarRecordes, recordeDe } from "@/modules/results";
import { DIFICULDADES, dificuldadesDaMusica, type Dificuldade, type Musica } from "@/modules/songs";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { AvatarPalhetando } from "./componentes/AvatarPalhetando";
import { Capa } from "./componentes/Capa";
import { Carrossel } from "./componentes/Carrossel";
import { ehImportada, semAudio } from "./storage/historico";

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
  aoRemover: (musica: Musica) => void;
  /** O ranking online da música, montado pelo App. Sem ele (contas desligadas), só os detalhes aparecem. */
  ranking?: ReactNode;
}

const TIPOS_IMPORTAVEIS = "audio/*,video/*,.sng";
const formatar = (n: number) => n.toLocaleString("pt-BR");

export function TelaDeSelecao(props: Props) {
  const { musicas, indice, dificuldade, personagem, volumeDosEfeitos, aoSelecionar, aoDificuldade, aoJogar, aoVoltar, aoImportar, aoRemover, ranking } = props;
  const recordes = carregarRecordes();
  const musica = musicas[indice];
  const dificuldades = dificuldadesDaMusica(musica);
  const recordeAtual = recordeDe(recordes, musica.id, dificuldade);
  const rotuloDaDificuldade = DIFICULDADES.find((d) => d.id === dificuldade)?.rotulo;
  const efeito = (nome: "mover" | "selecionar" | "voltar") => tocarEfeito(nome, volumeDosEfeitos);
  const dispositivo = useDispositivo();

  /** Anda pelas músicas dando a volta no fim da lista. */
  const andar = (passos: number) => {
    efeito("mover");
    aoSelecionar((((indice + passos) % musicas.length) + musicas.length) % musicas.length);
  };
  const escolherDificuldade = (id: Dificuldade) => {
    efeito("mover");
    aoDificuldade(id);
  };
  const reimportar = useRef<HTMLInputElement>(null);
  const precisaReimportar = semAudio(musica);
  const jogar = () => {
    efeito("selecionar");
    if (precisaReimportar) reimportar.current?.click();
    else aoJogar();
  };
  const importarEscolhidos = (campo: HTMLInputElement) => {
    aoImportar(Array.from(campo.files ?? []));
    campo.value = "";
  };

  const [removendo, setRemovendo] = useState(false);
  const podeRemover = ehImportada(musica);
  const confirmarRemocao = () => {
    setRemovendo(false);
    aoRemover(musica);
  };

  useTeclado((evento) => {
    // Com o modal aberto, as teclas são dele: Esc o fecha, sem voltar ao menu.
    if (removendo) return;
    if (evento.code === "Delete" && podeRemover) return setRemovendo(true);
    const posicao = dificuldades.findIndex((d) => d.id === dificuldade);
    if (evento.code === "ArrowDown" || evento.code === "ArrowUp") {
      evento.preventDefault();
      andar(evento.code === "ArrowDown" ? 1 : -1);
    } else if (evento.code === "ArrowLeft" || evento.code === "ArrowRight") {
      const proxima = dificuldades[posicao + (evento.code === "ArrowRight" ? 1 : -1)];
      if (proxima) escolherDificuldade(proxima.id);
    } else if (evento.code === "Enter") {
      jogar();
    } else if (evento.code === "Escape" || evento.code === "Backspace") {
      efeito("voltar");
      aoVoltar();
    }
  });

  const detalhes = (
    <div className="placa flex min-h-0 items-end gap-4 p-4">
      <AvatarPalhetando personagem={personagem} bpm={musica.bpm || 120} className="h-40 w-auto shrink-0 max-md:hidden [@media(max-height:680px)]:h-24" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Dado rotulo="Dificuldade">{rotuloDaDificuldade}</Dado>
        {recordeAtual && (
          <p className="flex items-center gap-2 px-4 text-base text-texto-suave">
            <Trophy className="size-4 text-ouro opacity-70" /> Recorde:
            <span className="font-mono font-bold text-texto">{formatar(recordeAtual.pontos)}</span>
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative isolate flex h-full flex-col">
      {/* A capa da música, borrada, pinta o fundo da tela e troca junto com a seleção. */}
      <AnimatePresence initial={false}>
        <motion.div
          key={musica.id}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <Capa musica={musica} decorativa className="size-full scale-110 blur-3xl" />
        </motion.div>
      </AnimatePresence>

      <header className="flex items-center gap-4 bg-superficie px-8 py-4 max-md:px-4 max-md:py-2">
        <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
          <ArrowLeft />
        </Button>
        <h1 className="text-4xl leading-[1.1] text-destaque max-md:text-2xl">Selecione a música</h1>
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
              onChange={(e) => importarEscolhidos(e.target)}
            />
          </label>
        </Button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-8 p-8 max-md:grid-cols-1 max-md:gap-4 max-md:p-4">
        <section aria-label="Informações da música" className="col-span-5 flex min-h-0 min-w-0 flex-col gap-4 max-md:col-span-1">
          {/* Tudo cabe sem rolagem: capa pequena ao lado do título e os dados numa linha só. */}
          <div className="flex items-center gap-4">
            <Capa musica={musica} girando className="size-28 rounded-md border border-borda max-md:hidden" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-4xl leading-[1.1] max-md:text-2xl">{musica.titulo}</h2>
              <p className="truncate text-lg text-texto-suave">{musica.artista}</p>
            </div>
            {podeRemover && (
              <Button variant="ghost" size="icon" onClick={() => setRemovendo(true)} aria-label={`Remover ${musica.titulo}`} className="shrink-0">
                <Trash2 className="opacity-70" />
              </Button>
            )}
          </div>

          <div className="flex min-w-0 gap-2">
            {musica.bpm > 0 && <Dado rotulo="BPM" className="flex-1">{musica.bpm}</Dado>}
            <Dado rotulo="Gênero" className="flex-1">{musica.genero}</Dado>
            <Dado rotulo="Intensidade" className="flex-1 max-md:hidden">
              <span className="flex gap-1 py-1" aria-label={`Intensidade ${musica.intensidade} de 5`}>
                {Array.from({ length: 5 }, (_, k) => (
                  <Flame key={k} className={cn("size-4", k < musica.intensidade ? "text-destaque" : "text-borda")} />
                ))}
              </span>
            </Dado>
          </div>

          {ranking ? (
            // Como no osu!: o ranking da música ao lado da roda, e os detalhes numa aba vizinha.
            <Tabs defaultValue="ranking" className="min-h-0 flex-1">
              <TabsList className="w-full">
                <TabsTrigger value="detalhes">
                  <Info className="opacity-70" /> Detalhes
                </TabsTrigger>
                <TabsTrigger value="ranking">
                  <ListOrdered className="opacity-70" /> Ranking
                </TabsTrigger>
              </TabsList>
              <TabsContent value="detalhes">{detalhes}</TabsContent>
              <TabsContent value="ranking" className="flex min-h-0 flex-col">
                {ranking}
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {detalhes}
              <div className="flex-1" />
            </>
          )}
          {precisaReimportar ? (
            <div className="flex flex-col gap-2">
              <p className="text-base text-texto-suave">O áudio não está mais salvo neste aparelho. Escolha o arquivo de novo para tocar.</p>
              <Button size="lg" className="h-14 font-titulo text-2xl tracking-widest" asChild>
                <label className="cursor-pointer">
                  <RotateCcw className="opacity-70" /> Importar de novo
                  <input ref={reimportar} type="file" accept={TIPOS_IMPORTAVEIS} className="sr-only" onChange={(e) => importarEscolhidos(e.target)} />
                </label>
              </Button>
            </div>
          ) : (
            <Button size="lg" className="h-14 font-titulo text-2xl tracking-widest" onClick={jogar}>
              <Play className="fill-current opacity-70" /> TOCAR
            </Button>
          )}
        </section>

        <Carrossel
          musicas={musicas}
          indice={indice}
          dificuldade={dificuldade}
          dificuldades={dificuldades}
          recordes={recordes}
          aoEscolherMusica={(i) => {
            efeito("mover");
            aoSelecionar(i);
          }}
          aoEscolherDificuldade={escolherDificuldade}
          aoJogar={jogar}
          aoGirar={andar}
        />
      </div>

      <footer className="flex items-center gap-8 bg-superficie px-8 py-2 max-md:hidden">
        <Comando teclas={rotuloDoComando("horizontal", dispositivo)}>Dificuldade</Comando>
        <Comando teclas={rotuloDoComando("vertical", dispositivo)}>Música</Comando>
        <Comando teclas={rotuloDoComando("confirmar", dispositivo)}>Confirmar</Comando>
        <Comando teclas={rotuloDoComando("voltar", dispositivo)}>Voltar</Comando>
      </footer>
      <Dialog open={removendo} onOpenChange={setRemovendo}>
        <DialogContent>
          <DialogTitle>Remover {musica.titulo}?</DialogTitle>
          <DialogDescription>A música e o arquivo salvo serão apagados deste aparelho. Os recordes continuam guardados. Isso não pode ser desfeito.</DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={confirmarRemocao}>
              <Trash2 className="opacity-70" /> Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Dado({ rotulo, className, children }: { rotulo: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("chapa min-w-0 px-4 py-2 max-md:flex-1", className)}>
      <span className="block font-titulo text-lg tracking-wide text-destaque uppercase">{rotulo}</span>
      <span className="block truncate text-xl font-semibold">{children}</span>
    </div>
  );
}

function Comando({ teclas, children }: { teclas: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-base">
      <kbd className="rounded-sm bg-superficie-elevada px-2 font-mono text-texto-suave">{teclas}</kbd>
      <span className="font-titulo text-xl tracking-wide uppercase">{children}</span>
    </span>
  );
}
