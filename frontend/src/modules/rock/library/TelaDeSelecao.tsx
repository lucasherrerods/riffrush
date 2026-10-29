import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Ellipsis, Gauge, FileAudio, Flame, Heart, Info, ListOrdered, Play, RotateCcw, Trash2, Trophy } from "lucide-react";
import { tocarEfeito } from "@/modules/audio";
import type { Personagem } from "@/modules/rock/character";
import { rotuloDoComando, useDispositivo } from "@/modules/gamepad";
import { rotuloDaVelocidade } from "@/modules/rock/gameplay";
import { ModalDeModificadores } from "@/modules/modifiers";
import { recordeDe, useRecordes } from "@/modules/rock/results";
import { DIFICULDADES, dificuldadesDaMusica, idDoRanking, instrumentoDaMusica, instrumentosDaMusica, type Dificuldade, type Instrumento, type Musica } from "@/modules/rock/songs";
import { useTeclado } from "@/shared/hooks/useTeclado";
import { useTelaEstreita } from "@/shared/hooks/useTelaEstreita";
import { SeloDaNota } from "@/shared/ui/SeloDaNota";
import { cn } from "@/shared/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { Button } from "@/shared/ui/button";
import { GrupoDeOpcoes } from "@/shared/ui/GrupoDeOpcoes";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { AvatarPalhetando } from "./componentes/AvatarPalhetando";
import { Capa } from "./componentes/Capa";
import { Carrossel } from "./componentes/Carrossel";
import { alternarFavorita, carregarFavoritas, indicesVisiveis, salvarFavoritas, selecaoNoFiltro } from "./favoritas";
import { ehImportada, semAudio } from "./storage/historico";

interface Props {
  musicas: Musica[];
  indice: number;
  dificuldade: Dificuldade;
  /** O instrumento escolhido; a música que não o tem mostra o primeiro que tiver. */
  instrumento: Instrumento;
  personagem: Personagem;
  volumeDosEfeitos: number;
  aoSelecionar: (indice: number) => void;
  aoDificuldade: (dificuldade: Dificuldade) => void;
  aoInstrumento: (instrumento: Instrumento) => void;
  aoJogar: () => void;
  aoVoltar: () => void;
  aoImportar: (arquivos: File[]) => void;
  aoRemover: (musica: Musica) => void;
  /** O ranking online da música, montado pelo App. Sem ele (contas desligadas), só os detalhes aparecem. */
  ranking?: ReactNode;
  /** Velocidade da música, o modificador escolhido na modal (1 é a normal). */
  velocidadeDaMusica: number;
  aoVelocidadeDaMusica: (velocidade: number) => void;
}

/** Os botões acima da lista têm o recorte do botão principal: vermelhos ligados, da cor do header desligados. */
const estiloDoFiltro = (ligado: boolean) =>
  ligado ? { variant: "default" as const } : { variant: "ghost" as const, className: "corte gasto bg-superficie hover:bg-superficie-hover" };

const TIPOS_IMPORTAVEIS = "audio/*,video/*,.sng";
const formatar = (n: number) => n.toLocaleString("pt-BR");

export function TelaDeSelecao(props: Props) {
  const { musicas, indice, dificuldade, personagem, volumeDosEfeitos, aoSelecionar, aoDificuldade, aoInstrumento, aoJogar, aoVoltar, aoImportar, aoRemover, ranking, velocidadeDaMusica, aoVelocidadeDaMusica } = props;
  const recordes = useRecordes();
  const musica = musicas[indice];
  const instrumentos = instrumentosDaMusica(musica);
  const instrumento = instrumentoDaMusica(musica, props.instrumento);
  const dificuldades = dificuldadesDaMusica(musica, instrumento);
  const recordeAtual = recordeDe(recordes, idDoRanking(musica), dificuldade, instrumento);
  const rotuloDaDificuldade = DIFICULDADES.find((d) => d.id === dificuldade)?.rotulo;
  const efeito = (nome: "mover" | "selecionar" | "voltar") => tocarEfeito(nome, volumeDosEfeitos);
  const dispositivo = useDispositivo();

  const [favoritas, setFavoritas] = useState(carregarFavoritas);
  const [soFavoritas, setSoFavoritas] = useState(false);
  const favorita = favoritas.has(musica.id);
  const alternarFavoritaAtual = () => {
    efeito("mover");
    const novas = alternarFavorita(favoritas, musica.id);
    setFavoritas(novas);
    salvarFavoritas(novas);
    if (!soFavoritas || novas.has(musica.id)) return;
    // Desfavoritada com o filtro ligado, ela some da lista: a seleção vai para a próxima favorita.
    const proxima = selecaoNoFiltro(indicesVisiveis(musicas, novas, true), indice);
    if (proxima !== undefined) aoSelecionar(proxima);
  };
  const visiveis = indicesVisiveis(musicas, favoritas, soFavoritas);
  const alternarFiltro = () => {
    efeito("mover");
    const ligado = !soFavoritas;
    setSoFavoritas(ligado);
    // A selecionada que some do filtro dá lugar à próxima favorita.
    const proxima = selecaoNoFiltro(indicesVisiveis(musicas, favoritas, ligado), indice);
    if (proxima !== undefined && proxima !== indice) aoSelecionar(proxima);
  };

  /** Anda pelas músicas visíveis dando a volta no fim da lista. */
  const andar = (passos: number) => {
    if (!visiveis.length) return;
    efeito("mover");
    const atual = Math.max(visiveis.indexOf(indice), 0);
    aoSelecionar(visiveis[(((atual + passos) % visiveis.length) + visiveis.length) % visiveis.length]);
  };
  const escolherDificuldade = (id: Dificuldade) => {
    efeito("mover");
    aoDificuldade(id);
  };
  const escolherInstrumento = (id: Instrumento) => {
    efeito("mover");
    aoInstrumento(id);
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
  const [menuAberto, setMenuAberto] = useState(false);
  const [modificadoresAbertos, setModificadoresAbertos] = useState(false);
  const podeRemover = ehImportada(musica);
  const confirmarRemocao = () => {
    setRemovendo(false);
    aoRemover(musica);
  };

  const estreita = useTelaEstreita();
  // No celular, Detalhes e Ranking abrem em janelas em vez de abas.
  const [janela, setJanela] = useState<"detalhes" | "ranking" | null>(null);

  useTeclado((evento) => {
    // Com o modal ou o menu de opções aberto, as teclas são dele: Esc o fecha, sem voltar ao menu.
    if (removendo || menuAberto || modificadoresAbertos || janela) return;
    if (evento.code === "Delete" && podeRemover) return setRemovendo(true);
    if (evento.code === "KeyF") return alternarFavoritaAtual();
    // Shift+Tab é do modo competitivo; o Tab sozinho troca o instrumento.
    if (evento.code === "Tab" && !evento.shiftKey && instrumentos.length > 1) {
      evento.preventDefault();
      const atual = instrumentos.findIndex((i) => i.id === instrumento);
      return escolherInstrumento(instrumentos[(atual + 1) % instrumentos.length].id);
    }
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

  const dados = (
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
  );

  const detalhes = (
    <div className="placa flex min-h-0 items-end gap-4 p-4">
      <AvatarPalhetando personagem={personagem} bpm={musica.bpm || 120} className="h-40 w-auto shrink-0 max-md:hidden [@media(max-height:680px)]:h-24" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Dado rotulo="Dificuldade">{rotuloDaDificuldade}</Dado>
        {recordeAtual && (
          <p className="flex items-center gap-2 px-4 text-base text-texto-suave">
            <Trophy className="size-4 text-ouro opacity-70" /> Recorde:
            <span className="font-mono font-bold text-texto">{formatar(recordeAtual.pontos)}</span>
            {recordeAtual.precisao !== undefined && <SeloDaNota precisao={recordeAtual.precisao} />}
          </p>
        )}
      </div>
    </div>
  );

  const favoritar = (
    <Button
      variant="ghost"
      size="sm"
      aria-pressed={favorita}
      title="Favoritar (F)"
      onClick={alternarFavoritaAtual}
      className={cn("rounded-md", favorita ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-superficie")}
    >
      {favorita ? "Tirar dos favoritos" : "Favoritar"}
    </Button>
  );

  const tocar = precisaReimportar ? (
    <div className="flex flex-col gap-2">
      <p className="text-base text-texto-suave">O áudio não está mais salvo neste aparelho. Escolha o arquivo de novo para tocar.</p>
      <Button size="lg" className="h-11 font-titulo text-xl tracking-widest max-md:h-10 max-md:text-lg" asChild>
        <label className="">
          <RotateCcw className="opacity-70" /> Importar de novo
          <input ref={reimportar} type="file" accept={TIPOS_IMPORTAVEIS} className="sr-only" onChange={(e) => importarEscolhidos(e.target)} />
        </label>
      </Button>
    </div>
  ) : (
    <Button size="lg" className="h-11 font-titulo text-xl tracking-widest max-md:h-10 max-md:text-lg" onClick={jogar}>
      <Play className="fill-current opacity-70" /> TOCAR
    </Button>
  );

  const filtros = (
    <>
    <Button {...estiloDoFiltro(velocidadeDaMusica !== 1)} onClick={() => setModificadoresAbertos(true)}>
      <Gauge className="opacity-70" /> Modificadores
      {velocidadeDaMusica !== 1 && <span className="font-mono">{rotuloDaVelocidade(velocidadeDaMusica)}</span>}
    </Button>
    <Button {...estiloDoFiltro(soFavoritas)} aria-pressed={soFavoritas} onClick={alternarFiltro}>
      <Heart className={cn(soFavoritas ? "fill-current" : "opacity-70")} /> Favoritos
    </Button>
    </>
  );

  const lista = visiveis.length ? (
    <Carrossel
      className="flex-1"
      musicas={visiveis.map((i) => musicas[i])}
      indice={visiveis.indexOf(indice)}
      dificuldade={dificuldade}
      instrumento={instrumento}
      dificuldades={dificuldades}
      recordes={recordes}
      favoritas={favoritas}
      aoEscolherMusica={(i) => {
        efeito("mover");
        aoSelecionar(visiveis[i]);
      }}
      aoEscolherDificuldade={escolherDificuldade}
      aoJogar={jogar}
      aoGirar={andar}
      menuDaSelecionada={
        podeRemover && (
          <DropdownMenu open={menuAberto} onOpenChange={setMenuAberto}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Opções de ${musica.titulo}`}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="perigo" onSelect={() => setRemovendo(true)}>
                <Trash2 /> Apagar música
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      }
    />
  ) : (
    <p className="placa p-4 text-base text-texto-suave">Nenhuma música favorita ainda. {estreita ? "Favorite com o botão Favoritar." : "Favorite com o coração ou a tecla F."}</p>
  );

  const modais = (
    <>
      <ModalDeModificadores
        aberto={modificadoresAbertos}
        aoMudarAberto={setModificadoresAbertos}
        velocidadeDaMusica={velocidadeDaMusica}
        aoMudarVelocidade={aoVelocidadeDaMusica}
      />
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
    </>
  );

  const cabecalho = (
    <header className="flex items-center gap-4 bg-superficie px-8 py-2 max-md:gap-2 max-md:px-2">
      <Button variant="ghost" size="icon" onClick={aoVoltar} aria-label="Voltar">
        <ArrowLeft />
      </Button>
      <h1 className="titulo-de-tela min-w-0 truncate text-destaque max-md:text-lg">Selecione a música</h1>
      <div className="flex-1" />
      <Button variant="outline" asChild>
        <label className="">
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
  );

  if (estreita) {
    return (
      <div className="relative isolate flex h-full flex-col">
        {cabecalho}
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
          <section aria-label="Informações da música" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-2xl leading-[1.1]">{musica.titulo}</h2>
                <p className="truncate text-base text-texto-suave">{musica.artista}</p>
              </div>
              {favoritar}
            </div>
            <div className="flex flex-wrap gap-1.5 [&_button]:h-8 [&_button]:gap-1 [&_button]:px-2 [&_button]:text-xs">
              <Button variant="outline" size="sm" onClick={() => setJanela("detalhes")}>
                <Info className="opacity-70" /> Detalhes
              </Button>
              {ranking && (
                <Button variant="outline" size="sm" onClick={() => setJanela("ranking")}>
                  <ListOrdered className="opacity-70" /> Ranking
                </Button>
              )}
              {filtros}
            </div>
            {instrumentos.length > 1 && <GrupoDeOpcoes titulo="Instrumento" opcoes={instrumentos.map((i) => ({ id: i.id, rotulo: i.rotulo }))} valor={instrumento} aoEscolher={escolherInstrumento} />}
          </section>
          {lista}
        </div>
        <footer className="flex flex-col bg-superficie p-2">{tocar}</footer>
        {modais}
        <Dialog open={janela !== null} onOpenChange={(aberto) => !aberto && setJanela(null)}>
          {/* O Esc só fecha a janela: sem passar adiante, a tela não volta ao menu. */}
          <DialogContent aria-describedby={undefined} onEscapeKeyDown={(evento) => evento.stopPropagation()}>
            <DialogTitle>{janela === "ranking" ? "Ranking" : "Detalhes"}</DialogTitle>
            {janela === "ranking" ? (
              <div className="flex max-h-[60vh] min-h-0 flex-col">{ranking}</div>
            ) : (
              <div className="flex flex-col gap-2">
                {dados}
                {detalhes}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

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

      {cabecalho}

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-8 p-8 max-md:grid-cols-1 max-md:gap-4 max-md:p-4">
        <section aria-label="Informações da música" className="col-span-5 flex min-h-0 min-w-0 flex-col gap-4 max-md:col-span-1">
          {/* Tudo cabe sem rolagem: capa pequena ao lado do título e os dados numa linha só. */}
          <div className="flex items-center gap-4">
            <Capa musica={musica} girando className="size-28 rounded-md border border-borda max-md:hidden" />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-4xl leading-[1.1] max-md:text-2xl">{musica.titulo}</h2>
              <p className="truncate text-lg text-texto-suave">{musica.artista}</p>
            </div>
            {favoritar}
          </div>

          {instrumentos.length > 1 && (
            <GrupoDeOpcoes
              titulo="Instrumento"
              opcoes={instrumentos.map((i) => ({ id: i.id, rotulo: i.rotulo }))}
              valor={instrumento}
              aoEscolher={escolherInstrumento}
            />
          )}

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
              {/* Os dados da música ficam nesta aba para sobrar altura para o ranking. */}
              <TabsContent value="detalhes" className="flex flex-col gap-4">
                {dados}
                {detalhes}
              </TabsContent>
              <TabsContent value="ranking" className="flex min-h-0 flex-col">
                {ranking}
              </TabsContent>
            </Tabs>
          ) : (
            <>
              {dados}
              {detalhes}
              <div className="flex-1" />
            </>
          )}
          {tocar}
        </section>

        <div className="col-span-7 flex min-h-0 min-w-0 flex-col gap-4 max-md:col-span-1">
          <div className="flex justify-end gap-2">
            {filtros}
          </div>
          {lista}
        </div>
      </div>

      <footer className="flex items-center gap-8 bg-superficie px-8 py-2 max-md:hidden">
        <Comando teclas={rotuloDoComando("horizontal", dispositivo)}>Dificuldade</Comando>
        <Comando teclas={rotuloDoComando("vertical", dispositivo)}>Música</Comando>
        {instrumentos.length > 1 && <Comando teclas={rotuloDoComando("instrumento", dispositivo)}>Instrumento</Comando>}
        <Comando teclas={rotuloDoComando("confirmar", dispositivo)}>Confirmar</Comando>
        {dispositivo === "teclado" && <Comando teclas="F">Favoritar</Comando>}
        <Comando teclas={rotuloDoComando("voltar", dispositivo)}>Voltar</Comando>
      </footer>
      {modais}
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
