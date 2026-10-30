import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Loader2, Pause, Skull } from "lucide-react";
import { agoraNoAudio, focoSaiuPeloAlt, momentoDoEvento, obterContextoDeAudio, pausarAudio, retomarAudio, saidaDeAudio, tocarEfeito } from "@/modules/audio";
import { suportaWebGL, type Personagem } from "@/modules/rock/character";
import { cenaDaPartida } from "./cena";
import { Palco, type EstadoDoPalco } from "@/modules/rock/stage";
import { DIFICULDADES, INSTRUMENTOS, carregarMusica, type Dificuldade, type Instrumento, type Musica, type MusicaCarregada } from "@/modules/rock/songs";
import { bloquearTeclasDoSistema, ehAtalhoDoNavegador } from "@/modules/platform";
import { useTelaEstreita } from "@/shared/hooks/useTelaEstreita";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { ehArrasteParaCima } from "./gesto";
import { MenuDePausa } from "./componentes/MenuDePausa";
import { NumeroDaContagem } from "./componentes/NumeroDaContagem";
import { criarLojaDoHud, useLoja, type LojaDoHud } from "./lojaDoHud";
import { CONTROLE_VAZIO, HUD_INICIAL, PistaDoJogador, type ControleDoJogador, type FimDoJogador, type Hud, type RelogioDaPartida } from "./PistaDoJogador";
import { opcoesPeloNumeroDeJogadores, viewportsDaTela } from "./telaDividida";
import { hashDoChart, type EventoDaTransmissao, type Replay } from "./replay";
import { criarContadorDeFps, type LeituraDeFps } from "./fps";
import { layoutDaPista } from "./pista/geometria";
import type { EstadoDoJogador } from "./rede";
import type { Resultado } from "./resultado";
import { noTempoReal, rotuloDaVelocidade } from "./velocidade";
import type { JogadorLocal, OpcoesDaPartida } from "./opcoesDaPartida";

// Os testes e o módulo leem daqui; a definição fica num arquivo leve, para a tela da partida poder ser baixada só na hora de jogar.
export { OPCOES_PADRAO_DA_PARTIDA, type JogadorLocal, type OpcoesDaPartida } from "./opcoesDaPartida";



/** Ao despausar, a música volta depois de 3, 2, 1. */
const SEGUNDOS_PARA_RETOMAR = 3;
/** Atalhos fixos: P pausa como o Esc e R recomeça. Valem só quando não são teclas do jogo. */
const TECLA_DE_PAUSA = "KeyP";
const TECLA_DE_RECOMECAR = "KeyR";
interface Props {
  musica: Musica;
  dificuldade: Dificuldade;
  /** Sem ele, a guitarra. */
  instrumento?: Instrumento;
  opcoes: OpcoesDaPartida;
  personagem: Personagem;
  /** Pontos do recorde nesta música e dificuldade, para marcar na barra de estrelas. */
  recorde?: number;
  /** Partida em rede: largada combinada, estado enviado à sala e o painel dos adversários. */
  rede?: {
    /** Instante (performance.now) em que a música começa para todos. */
    inicio: number;
    aoAtualizar: (estado: EstadoDoJogador) => void;
    adversarios?: ReactNode;
  };
  aoSair: () => void;
  /** `gerarReplay` só vem quando o jogador tocou de verdade: sem bot, sem derrota e sem ser um replay. A API decide o que vale para o ranking. */
  aoTerminar: (resultado: Resultado, gerarReplay?: () => Promise<Uint8Array>) => void;
  /** Assiste a uma partida gravada: as entradas vêm do replay e o teclado só pausa. */
  replay?: Replay;
  /** Transmite a partida ao vivo: recebe o início, um lote de entradas por segundo, as pausas e o fim. */
  transmissao?: (evento: EventoDaTransmissao) => void;
  /** O placar do ranking no canto da tela, desenhado com os pontos de agora. */
  placar?: (pontos: number) => ReactNode;
  /** Quantas pessoas estão assistindo a transmissão. Com alguém, aparece o olho no canto. */
  espectadores?: number;
  /** Tela dividida: com dois ou mais, uma pista para cada um, com a mesma música. */
  jogadores?: JogadorLocal[];
  /** Na tela dividida, o resultado de cada jogador, na ordem de `jogadores`, quando a música acaba. */
  aoTerminarJuntos?: (resultados: Resultado[]) => void;
}


const ENTRADA = 2.5;
const SINCRONIA_DO_VIDEO = 0.15;
/** Pular para o fim exato terminaria o replay na hora: a barra para um pouco antes. */
const FOLGA_DO_FIM = 0.5;
/** Quantos segundos cada seta pula no replay. */
const SALTO_DAS_SETAS: Record<string, number> = { ArrowLeft: -5, ArrowRight: 5 };
const nada = () => {};

export function TelaDeJogo({ musica, dificuldade, instrumento = "guitarra", opcoes, personagem, recorde, rede, aoSair, aoTerminar, placar, replay, transmissao, espectadores = 0, jogadores, aoTerminarJuntos }: Props) {
  const divididos = jogadores && jogadores.length > 1 ? jogadores : null;
  const quantos = divididos?.length ?? 1;
  // O replay toca na velocidade em que foi gravado, não na das configurações de quem assiste.
  const velocidade = replay?.velocidade ?? opcoes.velocidadeDaMusica;
  const video = useRef<HTMLVideoElement>(null);
  const controles = useRef<{ pausar: () => void; continuar: () => void; desistir: () => void; irPara: (fracao: number) => void }>({
    pausar: nada,
    continuar: nada,
    irPara: nada,
    desistir: nada,
  });
  // Um controle por pista; o da primeira é o do jogador sozinho.
  const controlesDasPistas = useMemo(() => Array.from({ length: quantos }, () => ({ current: { ...CONTROLE_VAZIO } as ControleDoJogador })), [quantos]);
  const jogador = controlesDasPistas[0];
  // O relógio é um objeto só: a pista o recebe uma vez e lê o que a música preencher a cada sessão.
  const [relogio] = useState<RelogioDaPartida>(() => ({ agora: () => -ENTRADA, doEvento: () => -ENTRADA, pausado: () => true }));
  const fimDoJogador = useRef<(fim: FimDoJogador, pista: number) => void>(nada);
  const estreita = useTelaEstreita();
  const inicioDoArraste = useRef<{ x: number; y: number } | null>(null);
  const [comWebGL] = useState(suportaWebGL);
  const cena = cenaDaPartida({ modoCompetitivo: opcoes.modoCompetitivo, efeitos: opcoes.efeitos, personagem: opcoes.personagem, comWebGL, estreita, jogadores: quantos });
  const comPalco = cena.palco;
  const estadoDoPalco = useRef<EstadoDoPalco>({
    personagem,
    tocando: false,
    bpm: (musica.bpm || 120) * velocidade,
    pulso: 0,
    triste: false,
    tempo: -ENTRADA,
    entrada: ENTRADA,
    estrelaAtiva: false,
    desdeTrovao: Infinity,
  });
  const emRede = !!rede;
  // A rede chega como objeto novo a cada render; só o instante de largada reinicia a partida.
  const inicioEmRede = rede?.inicio;
  const [carregada, setCarregada] = useState<MusicaCarregada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [urlDoVideo, setUrlDoVideo] = useState<string | null>(null);
  const lojas = useMemo(() => Array.from({ length: quantos }, () => criarLojaDoHud<Hud>(HUD_INICIAL)), [quantos]);
  const loja = lojas[0];
  const [pausado, setPausado] = useState(false);
  /** Ao despausar: segundos que faltam para a música voltar (3, 2, 1), ou 0. */
  const [retomando, setRetomando] = useState(0);
  const pausadoNaTela = useRef(false);
  pausadoNaTela.current = pausado;
  const [derrota, setDerrota] = useState(false);
  const [rodada, setRodada] = useState(0);
  const [fps, setFps] = useState<LeituraDeFps | null>(null);
  const [tamanho, setTamanho] = useState({ largura: window.innerWidth, altura: window.innerHeight });
  // A música e a pista recomeçam juntas: as duas dependem só da sessão.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sessao = useMemo(() => ({}), [carregada, rodada, opcoes, musica.id, dificuldade, instrumento, aoTerminar, inicioEmRede, replay, jogadores]);

  useEffect(() => {
    let cancelado = false;
    carregarMusica(musica, dificuldade, instrumento)
      .then(async (m) => {
        if (replay && (await hashDoChart(m.notas)) !== replay.hashDoChart) {
          throw new Error("Este replay foi gravado com outra versão do chart desta música.");
        }
        return m;
      })
      .then((m) => !cancelado && setCarregada(m))
      .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelado = true;
    };
  }, [musica, dificuldade, instrumento, replay]);

  useEffect(() => {
    const fonte = musica.arquivoDeVideo ?? (musica.video ? musica.arquivo : undefined);
    if (!fonte) return;
    const url = URL.createObjectURL(fonte);
    setUrlDoVideo(url);
    return () => URL.revokeObjectURL(url);
  }, [musica]);

  // Na pausa e no replay o jogador pode querer sair da janela: o bloqueio vale só com a partida rodando.
  const segurarTeclas = opcoes.bloquearAtalhos && carregada !== null && !replay && !pausado && !derrota;
  useEffect(() => {
    if (!segurarTeclas) return;
    void bloquearTeclasDoSistema(true);
    const aoApertar = (evento: KeyboardEvent) => ehAtalhoDoNavegador(evento) && evento.preventDefault();
    const semMenu = (evento: Event) => evento.preventDefault();
    window.addEventListener("keydown", aoApertar);
    window.addEventListener("contextmenu", semMenu);
    return () => {
      void bloquearTeclasDoSistema(false);
      window.removeEventListener("keydown", aoApertar);
      window.removeEventListener("contextmenu", semMenu);
    };
  }, [segurarTeclas]);

  useEffect(() => {
    const aoRedimensionar = () => setTamanho({ largura: window.innerWidth, altura: window.innerHeight });
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  useEffect(() => {
    if (!carregada) return;
    const audio = obterContextoDeAudio();
    const ganho = audio.createGain();
    ganho.gain.value = opcoes.volumeDaMusica;
    ganho.connect(saidaDeAudio());
    const criarFonte = () => {
      const nova = audio.createBufferSource();
      nova.buffer = carregada.audio;
      // A partida roda no tempo real: só o áudio (e o vídeo) toca na velocidade escolhida.
      nova.playbackRate.value = velocidade;
      nova.connect(ganho);
      return nova;
    };
    let fonte = criarFonte();
    // Em rede a música começa no instante combinado; quem carregou atrasado entra no meio.
    const agora = audio.currentTime;
    let inicio = inicioEmRede === undefined ? agora + ENTRADA : agora + (inicioEmRede - performance.now()) / 1000;
    if (inicio > agora + 0.05) fonte.start(inicio);
    else fonte.start(agora + 0.05, (agora + 0.05 - inicio) * velocidade);
    const duracao = noTempoReal(carregada.duracao, velocidade);
    const atraso = opcoes.atrasoMs / 1000;
    const tempoDaMusica = (tempoDoAudio: number) => tempoDoAudio - inicio - atraso;
    let pausadoAgora = false;
    /** Onde a música parou. Na pausa o relógio fica nela, mesmo se o áudio voltar a andar sozinho. */
    let posicaoNaPausa = 0;
    let terminou = false;
    let quadro = 0;
    let ultimaSincroniaDoVideo = 0;
    Object.assign(relogio, {
      agora: () => (pausadoAgora ? posicaoNaPausa - atraso : tempoDaMusica(agoraNoAudio(audio))),
      doEvento: (evento: Event) => (pausadoAgora ? posicaoNaPausa - atraso : tempoDaMusica(momentoDoEvento(audio, evento))),
      pausado: () => pausadoAgora,
    });

    // Na tela dividida ninguém é vaiado (vira fantasma): a partida acaba quando a música acaba para todos.
    const resultados: Resultado[] = [];
    let terminaram = 0;
    fimDoJogador.current = (fim, pista) => {
      if (divididos) {
        if (!fim.derrota) resultados[pista] = fim.resultado;
        if (++terminaram < divididos.length) return;
        terminou = true;
        return aoTerminarJuntos?.(resultados);
      }
      terminou = true;
      video.current?.pause();
      if (fim.derrota) {
        fonte.stop();
        tocarEfeito("erro", opcoes.volumeDosEfeitos);
        setDerrota(true);
      } else {
        aoTerminar(fim.resultado, fim.gerarReplay);
      }
    };

    /** O 3, 2, 1 antes de a música voltar, como no começo. Enquanto conta, a partida segue pausada. */
    let retomada: ReturnType<typeof setTimeout> | null = null;
    const cancelarRetomada = () => {
      if (retomada) clearTimeout(retomada);
      retomada = null;
      setRetomando(0);
    };
    const transmitirPausa = (pausado: boolean) => jogador.current.transmitirPausa(pausado);

    // Em rede a música dos outros não para: a pausa só abre o menu.
    const pausar = () => {
      if (terminou) return;
      if (inicioEmRede !== undefined) return setPausado(true);
      // Pausar no meio da contagem: a música nem voltou, só reabre o menu.
      if (retomada) {
        cancelarRetomada();
        return setPausado(true);
      }
      if (pausadoAgora) return;
      posicaoNaPausa = agoraNoAudio(audio) - inicio;
      pausadoAgora = true;
      pausarAudio();
      video.current?.pause();
      setPausado(true);
      transmitirPausa(true);
    };
    const continuar = () => {
      setPausado(false);
      if (!pausadoAgora || retomada) return;
      const contar = (falta: number) => {
        setRetomando(falta);
        retomada = setTimeout(() => {
          if (falta > 1) return contar(falta - 1);
          retomada = null;
          setRetomando(0);
          // O áudio pode ter andado na pausa (o celular retoma sozinho): volta a música para onde parou.
          if (Math.abs(agoraNoAudio(audio) - inicio - posicaoNaPausa) > 0.05) tocarDe(posicaoNaPausa);
          pausadoAgora = false;
          retomarAudio();
          transmitirPausa(false);
        }, 1000);
      };
      contar(SEGUNDOS_PARA_RETOMAR);
    };
    const desistir = () => {
      const resultado = jogador.current.desistir();
      terminou = true;
      aoTerminar(resultado);
    };
    /** Só no replay gravado: refaz a partida no instante escolhido e recomeça o áudio dali, pausado ou não. */
    const irPara = (fracao: number) => irParaOTempo(fracao * duracao);
    const irParaOTempo = (tempo: number) => {
      if (!replay || replay.ateAgora !== undefined || terminou) return;
      const alvo = Math.max(0, Math.min(tempo, duracao - FOLGA_DO_FIM));
      jogador.current.refazerEm(alvo);
      tocarDe(alvo);
    };
    /** Recomeça o áudio no segundo `alvo` da música; antes do zero, espera o que falta para ela começar. */
    function tocarDe(alvo: number) {
      try {
        fonte.stop();
      } catch {
        // Ainda não tinha começado.
      }
      fonte = criarFonte();
      const quando = audio.currentTime + 0.05;
      if (alvo >= 0) fonte.start(quando, alvo * velocidade);
      else fonte.start(quando - alvo);
      inicio = quando - alvo;
      if (video.current) video.current.currentTime = Math.max(0, alvo) * velocidade;
    }
    Object.assign(controles.current, { pausar, continuar, desistir, irPara });

    const teclaDoJogo = (codigo: string) => opcoes.teclas.includes(codigo) || codigo === opcoes.teclaDaEstrela || codigo === opcoes.teclaDaPalheta;
    const atalhoFixo = (evento: KeyboardEvent, codigo: string) =>
      evento.code === codigo && !evento.repeat && !evento.ctrlKey && !evento.metaKey && !evento.altKey && !teclaDoJogo(codigo);
    const aoApertar = (evento: KeyboardEvent) => {
      if (atalhoFixo(evento, TECLA_DE_RECOMECAR)) {
        // Em rede a partida é da sala, e o replay não se recomeça.
        if (inicioEmRede !== undefined || replay) return;
        evento.preventDefault();
        return atalhos.current.recomecar();
      }
      if (evento.code === "Escape" || atalhoFixo(evento, TECLA_DE_PAUSA)) {
        evento.preventDefault();
        if (retomada) pausar();
        else if (pausadoAgora || (inicioEmRede !== undefined && pausadoNaTela.current)) continuar();
        else pausar();
        return;
      }
      // No replay as setas pulam na música, pausado ou não.
      if (replay && SALTO_DAS_SETAS[evento.code]) {
        evento.preventDefault();
        irParaOTempo(relogio.agora() + SALTO_DAS_SETAS[evento.code]);
      }
    };
    window.addEventListener("keydown", aoApertar);
    // Soltar o Alt sozinho (volume) pode tirar o foco no Windows: isso não é sair do jogo.
    const aoPerderFoco = () => inicioEmRede === undefined && !focoSaiuPeloAlt() && pausar();
    window.addEventListener("blur", aoPerderFoco);

    const contadorDeFps = criarContadorDeFps();
    const aoMudarVisibilidade = () => contadorDeFps.reiniciar();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    // O carimbo do rAF é a hora do quadro; performance.now() ali dentro soma o atraso de quem rodou antes no mesmo quadro.
    const aCadaQuadro = (agora: number) => {
      quadro = requestAnimationFrame(aCadaQuadro);
      const leitura = contadorDeFps.quadro(agora);
      if (opcoes.mostrarFps && leitura !== null) setFps(leitura);
      // Algo de fora (o sistema, outro som do jogo) pode religar o áudio com a partida pausada.
      if (pausadoAgora && audio.state === "running") void audio.suspend();
      const tempo = relogio.agora();
      const clipe = video.current;
      if (clipe && !terminou && !pausadoAgora && tempo >= 0 && performance.now() - ultimaSincroniaDoVideo > 500) {
        ultimaSincroniaDoVideo = performance.now();
        clipe.playbackRate = velocidade;
        if (clipe.paused) void clipe.play().catch(nada);
        if (Math.abs(clipe.currentTime - tempo * velocidade) > SINCRONIA_DO_VIDEO) clipe.currentTime = tempo * velocidade;
      }
    };
    quadro = requestAnimationFrame(aCadaQuadro);

    return () => {
      cancelarRetomada();
      cancelAnimationFrame(quadro);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      window.removeEventListener("keydown", aoApertar);
      window.removeEventListener("blur", aoPerderFoco);
      try {
        fonte.stop();
      } catch {
        // Já estava parada.
      }
      ganho.disconnect();
      video.current?.pause();
      retomarAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao]);

  const recomecar = () => {
    setPausado(false);
    setRetomando(0);
    setDerrota(false);
    for (const l of lojas) l.definir(HUD_INICIAL);
    setRodada((r) => r + 1);
  };
  const atalhos = useRef({ recomecar });
  atalhos.current.recomecar = recomecar;

  // A guitarra é o padrão e não aparece; os outros instrumentos vêm antes da dificuldade.
  const rotuloDaDificuldade = [instrumento !== "guitarra" && INSTRUMENTOS.find((i) => i.id === instrumento)?.rotulo, DIFICULDADES.find((d) => d.id === dificuldade)?.rotulo]
    .filter(Boolean)
    .join(" · ");
  const layout = layoutDaPista(tamanho.largura, tamanho.altura);

  // O que é igual em todas as pistas: a música, o relógio e a pausa.
  const pistaComum = (carregada: MusicaCarregada) => ({
    sessao,
    carregada,
    musica,
    dificuldade,
    instrumento,
    velocidade,
    entrada: ENTRADA,
    relogio,
    comPalco,
    personagem,
    estadoDoPalco,
    pausado,
    derrota,
    replay,
  });

  if (erro) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <Skull className="size-12 text-perigo" aria-hidden />
        <p className="max-w-md text-base text-texto-suave">Não consegui carregar essa música. {erro}</p>
        <Button onClick={aoSair}>Voltar</Button>
      </div>
    );
  }


  return (
    <div
      className="relative h-full w-full touch-none overflow-hidden select-none"
      // No celular, arrastar o dedo para cima em qualquer lugar solta o star power.
      onPointerDown={(e) => {
        if (estreita) inicioDoArraste.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        const inicio = inicioDoArraste.current;
        inicioDoArraste.current = null;
        if (inicio && ehArrasteParaCima(inicio, { x: e.clientX, y: e.clientY })) jogador.current.estrela();
      }}
    >
      {comPalco && carregada && <Palco lerEstado={() => estadoDoPalco.current} comPersonagem={cena.personagem} qualidade={opcoes.qualidadeDoPalco} />}

      {!carregada && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <Loader2 className="size-10 animate-spin text-primaria" aria-hidden />
          <p className="text-lg font-semibold">{musica.arquivo ? "Analisando o áudio..." : "Gravando a banda..."}</p>
          <p className="text-base text-texto-suave">
            {musica.titulo} · {rotuloDaDificuldade}
          </p>
        </div>
      )}

      {carregada && (
        <>
          {/* A rodada recomeça a pista do zero, com os avisos limpos. */}
          {divididos ? (
            viewportsDaTela(quantos).map((viewport, i) => (
              <div
                key={`${rodada}-${i}`}
                data-parte="viewport"
                className={cn("absolute inset-y-0 overflow-hidden", i > 0 && "border-l border-borda")}
                style={{ left: `${viewport.esquerda * 100}%`, width: `${viewport.largura * 100}%` }}
              >
                <PistaDoJogador
                  {...pistaComum(carregada)}
                  opcoes={opcoesPeloNumeroDeJogadores(divididos[i].opcoes, quantos)}
                  controle={controlesDasPistas[i]}
                  loja={lojas[i]}
                  layout={layoutDaPista(tamanho.largura * viewport.largura, tamanho.altura)}
                  // A coluna é estreita: o HUD compacto cabe nela, mas as faixas de toque do celular não fazem sentido.
                  estreita
                  comFaixasDeToque={false}
                  personagemDoHud={null}
                  recorde={undefined}
                  emRede
                  aceitaEvento={divididos[i].aceitaEvento}
                  aoFim={(fim) => fimDoJogador.current(fim, i)}
                />
                <span className="pointer-events-none absolute bottom-2 left-2 rounded-sm bg-superficie-elevada px-2 font-titulo text-lg tracking-wide">{divididos[i].nome}</span>
              </div>
            ))
          ) : (
            <PistaDoJogador
              key={rodada}
              {...pistaComum(carregada)}
              opcoes={opcoes}
              controle={jogador}
              loja={loja}
              layout={layout}
              estreita={estreita}
              personagemDoHud={cena.personagem ? personagem : null}
              recorde={recorde}
              emRede={inicioEmRede !== undefined}
              aoAtualizarRede={rede?.aoAtualizar}
              transmissao={transmissao}
              aoFim={(fim) => fimDoJogador.current(fim, 0)}
            />
          )}

          <header className={cn("absolute top-0 right-0 left-0 flex items-center", estreita ? "gap-2 px-3 pt-1" : "gap-4 px-6 pt-4")}>
            <div className="min-w-0">
              <h1 className="texto-titulo-da-partida truncate font-bold">{musica.titulo}</h1>
              <p className={cn("truncate text-texto-suave", estreita ? "text-xs" : "text-base")}>
                {musica.artista} · {rotuloDaDificuldade}
                {opcoes.bot && !replay && <span className="ml-2 rounded bg-estrela px-2 font-black text-fundo">BOT</span>}
                {velocidade !== 1 && <span className="ml-2 rounded bg-superficie-elevada px-2 font-black">{rotuloDaVelocidade(velocidade)}</span>}
                {replay && <span className="ml-2 rounded bg-primaria px-2 font-black">{replay.ateAgora === undefined ? "REPLAY" : "AO VIVO"}</span>}
                {opcoes.mostrarFps && <span className="ml-2 font-mono tabular-nums">{fps ? Math.round(fps.fps) : "–"} FPS{fps && ` · ${Math.round(fps.piorQuadroMs)} ms`}</span>}
              </p>
            </div>
            <ProgressoDaMusica loja={loja} aoIrPara={replay && replay.ateAgora === undefined ? (fracao) => controles.current.irPara(fracao) : undefined} />
            {espectadores > 0 && (
              <span
                role="status"
                aria-label={`${espectadores} ${espectadores === 1 ? "pessoa assistindo" : "pessoas assistindo"}`}
                className="flex shrink-0 items-center gap-2 rounded-md border border-primaria/50 bg-primaria/15 px-2 py-1 font-mono text-base font-bold text-primaria tabular-nums"
              >
                <Eye className="size-4" aria-hidden />
                {espectadores}
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={() => controles.current.pausar()} aria-label="Pausar">
              <Pause />
            </Button>
          </header>

          {rede?.adversarios}

          {/* Canto superior esquerdo: o clipe da música e, embaixo, o placar do ranking. */}
          <div data-parte="canto-esquerdo" className="absolute top-20 left-6 flex flex-col gap-4">
            {urlDoVideo && cena.video && (
              <motion.div initial={{ opacity: 0, x: -32 }} animate={{ opacity: 1, x: 0 }} className="w-[min(26vw,360px)] overflow-hidden rounded-2xl border border-borda">
                <video ref={video} src={urlDoVideo} muted playsInline className="aspect-video w-full bg-fundo object-cover" />
              </motion.div>
            )}
            {placar && !estreita && <PlacarDaPartida loja={loja} placar={placar} />}
          </div>
        </>
      )}

      <AnimatePresence>
        {retomando > 0 && !pausado && <NumeroDaContagem key={`retomada-${retomando}`} valor={retomando} />}
      </AnimatePresence>
      <AnimatePresence>
        {(pausado || derrota) && (
          <MenuDePausa
            derrota={derrota}
            emRede={emRede}
            aoVivo={replay?.ateAgora !== undefined}
            aoContinuar={() => controles.current.continuar()}
            aoRecomecar={recomecar}
            aoSair={aoSair}
            aoDesistir={() => controles.current.desistir()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** No replay gravado a barra também é um controle: clicar ou arrastar leva a partida para aquele ponto. */
function ProgressoDaMusica({ loja, aoIrPara }: { loja: LojaDoHud<Hud>; aoIrPara?: (fracao: number) => void }) {
  const { progresso } = useLoja(loja);
  return (
    <div className={cn("relative flex-1", aoIrPara && "py-2")}>
      <div className="h-1.5 overflow-hidden rounded-full bg-superficie-elevada" aria-label="Progresso da música">
        <div className="h-full bg-primaria" style={{ width: `${progresso * 100}%` }} />
      </div>
      {aoIrPara && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progresso}
          onChange={(e) => aoIrPara(Number(e.target.value))}
          // As teclas são do jogo (o Esc pausa): a barra não fica com o foco depois do clique.
          onPointerUp={(e) => e.currentTarget.blur()}
          aria-label="Posição da música"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      )}
    </div>
  );
}

/** Só o placar re-renderiza quando os pontos mudam. */
function PlacarDaPartida({ loja, placar }: { loja: LojaDoHud<Hud>; placar: (pontos: number) => ReactNode }) {
  const { pontos } = useLoja(loja);
  return <>{placar(pontos)}</>;
}
