import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Loader2, Pause, Skull, Zap } from "lucide-react";
import { agoraNoAudio, focoSaiuPeloAlt, momentoDoEvento, obterContextoDeAudio, saidaDeAudio, tocarEfeito } from "@/modules/audio";
import { Avatar, novaReacao, suportaWebGL, type Personagem, type Reacao } from "@/modules/character";
import { cenaDaPartida } from "./cena";
import { Palco, opacidadeDaPista, type EstadoDoPalco, type QualidadeDoPalco } from "@/modules/stage";
import { DIFICULDADES, INSTRUMENTOS, PISTA_ABERTA, carregarMusica, type Dificuldade, type Instrumento, type Musica, type MusicaCarregada } from "@/modules/songs";
import { useTelaEstreita } from "@/shared/hooks/useTelaEstreita";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { criarBot, jogarSozinho } from "./bot";
import { AvisoDeAcerto } from "./componentes/AvisoDeAcerto";
import { MedidorDeRock } from "./componentes/MedidorDeRock";
import { MedidorDeVida } from "./componentes/MedidorDeVida";
import { MenuDePausa } from "./componentes/MenuDePausa";
import { PainelDePontos } from "./componentes/PainelDePontos";
import { BarraDeEstrelas } from "./componentes/BarraDeEstrelas";
import { progressoDasEstrelas } from "./estrelas";
import { criarLojaDoHud, useLoja, type LojaDoHud } from "./lojaDoHud";
import { NOMES_DAS_PISTAS } from "./cores";
import { avancar, criarPartida, multiplicador, precisao, retirarEventos, type Julgamento } from "./partida";
import { aplicarEntradas, criarGravador, empacotarReplay, hashDoChart, type EventoDaTransmissao, type Replay } from "./replay";
import { desenharPista, type Cena } from "./pista/desenhar";
import { forcaDoTrovao } from "./pista/efeitos";
import { criarContadorDeFps } from "./fps";
import { layoutDaPista } from "./pista/geometria";
import { criarSprites } from "./pista/sprites";
import type { EstadoDoJogador } from "./rede";
import { resultadoDaPartida, type Resultado } from "./resultado";
import { noTempoReal, rotuloDaVelocidade } from "./velocidade";

/** O que a partida precisa saber das configurações do jogador. */
export interface OpcoesDaPartida {
  teclas: string[];
  teclaDaEstrela: string;
  rotuloDaTeclaDaEstrela: string;
  /** Com um controle conectado, o nome do botão aparece embaixo de cada traste. */
  rotulosDosTrastes?: string[];
  /** Segundos que a nota leva do horizonte até a linha de batida. */
  antecedencia: number;
  volumeDaMusica: number;
  volumeDosEfeitos: number;
  atrasoMs: number;
  semFalha: boolean;
  /** A nota aberta vira verde. O hash continua o do chart original, então replay, ranking e ao vivo seguem valendo. */
  semAberta: boolean;
  /** Velocidade da música (1 é a normal). */
  velocidadeDaMusica: number;
  bot: boolean;
  efeitos: boolean;
  /** Mostra o personagem 3D no palco e no HUD. */
  personagem: boolean;
  mostrarFps: boolean;
  qualidadeDoPalco: QualidadeDoPalco;
  modoCompetitivo: boolean;
}

/** Ao vivo, as entradas vão em lotes: um por segundo poupa a cota do relay e chega bem antes de quem assiste precisar. */
const INTERVALO_DO_LOTE_MS = 1000;

export const OPCOES_PADRAO_DA_PARTIDA: OpcoesDaPartida = {
  teclas: ["KeyA", "KeyS", "KeyJ", "KeyK", "KeyL", "KeyD"],
  teclaDaEstrela: "Space",
  rotuloDaTeclaDaEstrela: "Espaço",
  antecedencia: 1.46,
  volumeDaMusica: 0.8,
  volumeDosEfeitos: 0.5,
  atrasoMs: 0,
  semFalha: false,
  semAberta: false,
  velocidadeDaMusica: 1,
  bot: false,
  efeitos: true,
  personagem: true,
  mostrarFps: false,
  qualidadeDoPalco: "media",
  modoCompetitivo: false,
};


/** Ao despausar, a música volta depois de 3, 2, 1. */
const SEGUNDOS_PARA_RETOMAR = 3;
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
}

interface Hud {
  pontos: number;
  sequencia: number;
  multiplicador: number;
  vida: number;
  estrela: number;
  estrelaAtiva: boolean;
  progresso: number;
  precisao: number;
  /** Segundos que faltam para a música começar (contagem), ou 0. */
  contagem: number;
  pulso: number;
  /** De 0 a 5: as estrelas conquistadas e o caminho até a próxima. */
  estrelas: number;
  estrelasDoRecorde: number;
  /** Última reação do personagem (erro, star power, derrota). */
  reacao: Reacao | null;
  fantasma: boolean;
  /** O último acerto, para o aviso de PERFEITO / ÓTIMO / BOM ao lado da pista. */
  julgamento: { julgamento: Julgamento; tempo: number } | null;
}

const ENTRADA = 2.5;
const HUD_INICIAL: Hud = { pontos: 0, sequencia: 0, multiplicador: 1, vida: 0.5, estrela: 0, estrelaAtiva: false, progresso: 0, precisao: 1, contagem: 3, pulso: 0, estrelas: 0, estrelasDoRecorde: 0, reacao: null, fantasma: false, julgamento: null };
const MAXIMO_DE_EXPLOSOES = 20;
/** Altura da faixa de toque da nota aberta, no pé da tela. */
const ALTURA_DA_FAIXA_ABERTA = 64;
const MAXIMO_DE_TROVOES = 4;
const SINCRONIA_DO_VIDEO = 0.15;
const INTERVALO_DO_ENVIO_MS = 125;
const nada = () => {};
/** Em telas mais estreitas os painéis encostam na pista em vez de sair da tela. */
const LARGURA_DO_PAINEL = 250;
const LARGURA_DO_HUD_LATERAL = 320;
const MARGEM_DO_HUD = 16;

export function TelaDeJogo({ musica, dificuldade, instrumento = "guitarra", opcoes, personagem, recorde, rede, aoSair, aoTerminar, placar, replay, transmissao, espectadores = 0 }: Props) {
  // O replay toca na velocidade em que foi gravado, não na das configurações de quem assiste.
  const velocidade = replay?.velocidade ?? opcoes.velocidadeDaMusica;
  const recordeAtual = useRef(recorde);
  recordeAtual.current = recorde;
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const controles = useRef<{ pausar: () => void; continuar: () => void; desistir: () => void; apertar: (pista: number, evento: Event) => void; largar: (pista: number) => void; estrela: () => void }>({
    pausar: nada,
    continuar: nada,
    desistir: nada,
    apertar: nada,
    largar: nada,
    estrela: nada,
  });
  const estreita = useTelaEstreita();
  const [comWebGL] = useState(suportaWebGL);
  const cena = cenaDaPartida({ modoCompetitivo: opcoes.modoCompetitivo, efeitos: opcoes.efeitos, personagem: opcoes.personagem, comWebGL, estreita });
  const comPalco = cena.palco;
  const comPalcoAgora = useRef(comPalco);
  comPalcoAgora.current = comPalco;
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
  const redeAtual = useRef(rede);
  redeAtual.current = rede;
  // Lida no loop: trocar a função a cada render não pode reiniciar a partida.
  const transmissaoAtual = useRef(transmissao);
  transmissaoAtual.current = transmissao;
  const [carregada, setCarregada] = useState<MusicaCarregada | null>(null);
  const temAberta = useMemo(() => !!carregada?.notas.some((n) => n.pista === PISTA_ABERTA), [carregada]);
  const [erro, setErro] = useState<string | null>(null);
  const [urlDoVideo, setUrlDoVideo] = useState<string | null>(null);
  const [loja] = useState(() => criarLojaDoHud<Hud>(HUD_INICIAL));
  const [pausado, setPausado] = useState(false);
  /** Ao despausar: segundos que faltam para a música voltar (3, 2, 1), ou 0. */
  const [retomando, setRetomando] = useState(0);
  const pausadoNaTela = useRef(false);
  pausadoNaTela.current = pausado;
  const [derrota, setDerrota] = useState(false);
  const [rodada, setRodada] = useState(0);
  const [aviso, setAviso] = useState<{ id: number; texto: string; estrela: boolean } | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [tamanho, setTamanho] = useState({ largura: window.innerWidth, altura: window.innerHeight });

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
    const fonte = audio.createBufferSource();
    fonte.buffer = carregada.audio;
    // A partida roda no tempo real: só o áudio (e o vídeo) toca na velocidade escolhida.
    fonte.playbackRate.value = velocidade;
    fonte.connect(ganho);
    // Em rede a música começa no instante combinado; quem carregou atrasado entra no meio.
    const agora = audio.currentTime;
    const inicio = inicioEmRede === undefined ? agora + ENTRADA : agora + (inicioEmRede - performance.now()) / 1000;
    if (inicio > agora + 0.05) fonte.start(inicio);
    else fonte.start(agora + 0.05, (agora + 0.05 - inicio) * velocidade);
    const duracao = noTempoReal(carregada.duracao, velocidade);
    const batidas = carregada.batidas.map((b) => ({ ...b, tempo: noTempoReal(b.tempo, velocidade) }));

    // Em rede ninguém sai da música: quem zera a vida vira fantasma e segue pontuando.
    const partida = replay
      ? criarPartida(carregada.notas, { semFalha: replay.semFalha, fantasma: replay.fantasma, semAberta: replay.semAberta, velocidade })
      : criarPartida(carregada.notas, { semFalha: opcoes.semFalha, fantasma: inicioEmRede !== undefined, semAberta: opcoes.semAberta, velocidade });
    const bot = opcoes.bot && !replay ? criarBot() : null;
    const gravador = criarGravador(partida);
    let proximaEntrada = 0;
    // Os lotes só saem depois do início: o relay apaga o que tinha quando chega um início novo.
    let transmitindo = false;
    let entradasEnviadas = 0;
    let ultimoLote = 0;
    let transmissaoAcabou = false;
    const transmitir = (evento: EventoDaTransmissao) => transmitindo && !transmissaoAcabou && transmissaoAtual.current?.(evento);
    const encerrarTransmissao = () => {
      // O que foi tocado depois do último lote vai antes do fim, para quem assiste ver o final inteiro.
      if (gravador.entradas.length > entradasEnviadas) {
        transmitir({ tipo: "lote", entradas: gravador.entradas.slice(entradasEnviadas), ate: partida.tempo ?? 0 });
        entradasEnviadas = gravador.entradas.length;
      }
      transmitir({ tipo: "fim" });
      transmissaoAcabou = true;
    };
    if (transmissaoAtual.current && !replay && !bot) {
      void hashDoChart(carregada.notas).then((hash) => {
        if (transmissaoAcabou) return;
        transmitindo = true;
        transmitir({ tipo: "inicio", hashDoChart: hash, semFalha: opcoes.semFalha, semAberta: opcoes.semAberta, velocidade });
      });
    }
    const sprites = criarSprites();
    const contexto2d = canvas.current?.getContext("2d") ?? null;
    // O tamanho vem do ResizeObserver: ler clientWidth no loop, logo depois de mudar a opacidade, força um layout por quadro.
    const medida = { largura: canvas.current?.clientWidth ?? 0, altura: canvas.current?.clientHeight ?? 0 };
    const observador =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(([entrada]) => {
            medida.largura = entrada.contentRect.width;
            medida.altura = entrada.contentRect.height;
          });
    if (canvas.current) observador?.observe(canvas.current);
    const apertados = Array<boolean>(PISTA_ABERTA + 1).fill(false);
    const explosoes: Cena["explosoes"] = [];
    const falhas: Cena["falhas"] = [];
    const trovoes: Cena["trovoes"] = [];
    let estrelaDesde: number | null = null;
    let julgamento: Hud["julgamento"] = null;
    let reacao: Reacao | null = null;
    const reagir = (tipo: Reacao["tipo"]) => (reacao = novaReacao(reacao, tipo));
    let ultimoTrovao = -Infinity;
    const atraso = opcoes.atrasoMs / 1000;
    const tempoDaMusica = (tempoDoAudio: number) => tempoDoAudio - inicio - atraso;
    let pausadoAgora = false;
    let terminou = false;
    let quadro = 0;
    // Com o bot o recorde não vale, então também não tem festa.
    let recordeBatido = opcoes.bot || !!replay;
    let ultimaSincroniaDoVideo = 0;
    let idDoAviso = 0;
    let ultimoEnvio = 0;
    const publicar = (terminouAgora: boolean) =>
      redeAtual.current?.aoAtualizar({
        pontos: Math.round(partida.pontos),
        vida: partida.vida,
        sequencia: partida.sequencia,
        pulso: partida.acertos,
        derrota: partida.derrota,
        fantasma: partida.fantasma,
        terminou: terminouAgora,
      });
    const avisar = (texto: string, estrela = false) => setAviso({ id: ++idDoAviso, texto, estrela });

    const terminar = () => {
      if (terminou) return;
      terminou = true;
      encerrarTransmissao();
      publicar(true);
      video.current?.pause();
      if (partida.derrota) {
        fonte.stop();
        tocarEfeito("erro", opcoes.volumeDosEfeitos);
        setDerrota(true);
      } else {
        const resultado = resultadoDaPartida(partida, musica.id, dificuldade, instrumento);
        // Fantasma também manda: a API rejulga o replay das músicas do Encore para dar o XP, e deixa o fantasma fora do ranking.
        const tocouDeVerdade = !bot && !replay;
        const gerarReplay = async () =>
          empacotarReplay({
            semFalha: opcoes.semFalha,
            fantasma: inicioEmRede !== undefined,
            semAberta: opcoes.semAberta,
            velocidade,
            hashDoChart: await hashDoChart(carregada.notas),
            entradas: gravador.entradas,
          });
        aoTerminar(resultado, tocouDeVerdade ? gerarReplay : undefined);
      }
    };

    const tratarEventos = (tempo: number) => {
      for (const evento of retirarEventos(partida)) {
        if (evento.tipo === "acerto") {
          explosoes.push({ pista: evento.nota.pista, tempo });
          julgamento = { julgamento: evento.julgamento, tempo };
          if (explosoes.length > MAXIMO_DE_EXPLOSOES) explosoes.shift();
          const forca = forcaDoTrovao(partida.sequencia);
          if (forca) {
            ultimoTrovao = tempo;
            trovoes.push({ tempo, forca, semente: partida.sequencia });
            if (trovoes.length > MAXIMO_DE_TROVOES) trovoes.shift();
          }
        } else if (evento.tipo === "erro") {
          reagir("errou");
          falhas.push({ pista: evento.nota.pista, tempo });
          if (falhas.length > MAXIMO_DE_EXPLOSOES) falhas.shift();
          tocarEfeito("notaPerdida", opcoes.volumeDosEfeitos);
        } else if (evento.tipo === "sequencia") {
          avisar(`${evento.valor} notas seguidas!`);
        } else if (evento.tipo === "fraseCompleta") {
          tocarEfeito("estrela", opcoes.volumeDosEfeitos * 0.6);
        } else if (evento.tipo === "estrelaPronta") {
          avisar(`Star Power pronto! [${opcoes.rotuloDaTeclaDaEstrela}]`, true);
        } else if (evento.tipo === "estrelaAtivada") {
          estrelaDesde = tempo;
          reagir("nitro");
          tocarEfeito("estrela", opcoes.volumeDosEfeitos);
          avisar("STAR POWER!", true);
        } else if (evento.tipo === "derrota") {
          reagir("derrota");
          terminar();
        } else if (evento.tipo === "virouFantasma") {
          tocarEfeito("erro", opcoes.volumeDosEfeitos);
          avisar("Virou fantasma! Acerte as notas para voltar.");
        }
      }
    };

    /** O 3, 2, 1 antes de a música voltar, como no começo. Enquanto conta, a partida segue pausada. */
    let retomada: ReturnType<typeof setTimeout> | null = null;
    const cancelarRetomada = () => {
      if (retomada) clearTimeout(retomada);
      retomada = null;
      setRetomando(0);
    };

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
      pausadoAgora = true;
      void audio.suspend();
      video.current?.pause();
      setPausado(true);
      transmitir({ tipo: "pausa", pausado: true });
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
          pausadoAgora = false;
          void audio.resume();
          transmitir({ tipo: "pausa", pausado: false });
        }, 1000);
      };
      contar(SEGUNDOS_PARA_RETOMAR);
    };
    const desistir = () => {
      partida.derrota = true;
      terminou = true;
      encerrarTransmissao();
      publicar(true);
      aoTerminar(resultadoDaPartida(partida, musica.id, dificuldade, instrumento));
    };
    const estrela = () => !replay && gravador.ativarEstrela();
    Object.assign(controles.current, { pausar, continuar, desistir, estrela });

    /** Teclado e toque apertam do mesmo jeito: o instante vem do próprio evento. */
    const apertar = (pista: number, evento: Event) => {
      if (pausadoAgora || terminou || replay) return;
      apertados[pista] = true;
      const tempo = tempoDaMusica(momentoDoEvento(audio, evento));
      gravador.tocar(pista, tempo);
      tratarEventos(tempo);
    };
    const largar = (pista: number) => {
      if (replay) return;
      apertados[pista] = false;
      gravador.soltar(pista, tempoDaMusica(agoraNoAudio(audio)));
    };
    controles.current.apertar = apertar;
    controles.current.largar = largar;

    const aoApertar = (evento: KeyboardEvent) => {
      if (evento.code === "Escape") {
        evento.preventDefault();
        if (retomada) pausar();
        else if (pausadoAgora || (inicioEmRede !== undefined && pausadoNaTela.current)) continuar();
        else pausar();
        return;
      }
      if (pausadoAgora || terminou) return;
      const pista = opcoes.teclas.indexOf(evento.code);
      if (pista >= 0) {
        evento.preventDefault();
        if (!evento.repeat) apertar(pista, evento);
      } else if (evento.code === opcoes.teclaDaEstrela) {
        evento.preventDefault();
        estrela();
      }
    };
    const aoSoltar = (evento: KeyboardEvent) => {
      const pista = opcoes.teclas.indexOf(evento.code);
      if (pista >= 0) largar(pista);
    };
    window.addEventListener("keydown", aoApertar);
    window.addEventListener("keyup", aoSoltar);
    // Soltar o Alt sozinho (volume) pode tirar o foco no Windows: isso não é sair do jogo.
    const aoPerderFoco = () => inicioEmRede === undefined && !focoSaiuPeloAlt() && pausar();
    window.addEventListener("blur", aoPerderFoco);

    const contadorDeFps = criarContadorDeFps();
    const desenhar = () => {
      quadro = requestAnimationFrame(desenhar);
      const novoFps = contadorDeFps.quadro(performance.now());
      if (opcoes.mostrarFps && novoFps !== null) setFps(Math.round(novoFps));
      const tempo = tempoDaMusica(agoraNoAudio(audio));

      if (!pausadoAgora && !terminou) {
        if (bot) jogarSozinho(bot, partida, tempo).forEach((apertado, i) => (apertados[i] = apertado));
        // Ao vivo, a partida de quem assiste espera o próximo lote em vez de passar das entradas que já chegaram.
        const tempoDaPartida = replay?.ateAgora === undefined ? tempo : Math.min(tempo, replay.ateAgora);
        if (replay) proximaEntrada = aplicarEntradas(partida, replay.entradas, proximaEntrada, tempoDaPartida, apertados);
        avancar(partida, tempoDaPartida);
        if (transmitindo && performance.now() - ultimoLote >= INTERVALO_DO_LOTE_MS) {
          ultimoLote = performance.now();
          transmitir({ tipo: "lote", entradas: gravador.entradas.slice(entradasEnviadas), ate: partida.tempo ?? tempo });
          entradasEnviadas = gravador.entradas.length;
        }
        tratarEventos(tempo);
        if (!terminou && tempo >= duracao) terminar();
        if (!terminou && performance.now() - ultimoEnvio > INTERVALO_DO_ENVIO_MS) {
          ultimoEnvio = performance.now();
          publicar(false);
        }
      }

      const clipe = video.current;
      if (clipe && !terminou && !pausadoAgora && tempo >= 0 && performance.now() - ultimaSincroniaDoVideo > 500) {
        ultimaSincroniaDoVideo = performance.now();
        clipe.playbackRate = velocidade;
        if (clipe.paused) void clipe.play().catch(nada);
        if (Math.abs(clipe.currentTime - tempo * velocidade) > SINCRONIA_DO_VIDEO) clipe.currentTime = tempo * velocidade;
      }

      estadoDoPalco.current = {
        personagem,
        tocando: tempo >= 0 && !partida.derrota,
        bpm: (musica.bpm || 120) * velocidade,
        pulso: partida.acertos,
        triste: partida.vida < 0.25,
        tempo,
        entrada: ENTRADA,
        estrelaAtiva: partida.estrelaAtiva,
        desdeTrovao: tempo - ultimoTrovao,
        reacao,
      };

      const elemento = canvas.current;
      // Com palco, a pista some na abertura para a cena dominar e volta até a música começar.
      if (elemento) elemento.style.opacity = comPalcoAgora.current ? String(opacidadeDaPista(tempo, ENTRADA)) : "1";
      if (contexto2d && elemento) {
        const escala = Math.min(2, window.devicePixelRatio || 1);
        const { largura, altura } = medida;
        if (elemento.width !== Math.round(largura * escala) || elemento.height !== Math.round(altura * escala)) {
          elemento.width = Math.round(largura * escala);
          elemento.height = Math.round(altura * escala);
        }
        contexto2d.setTransform(escala, 0, 0, escala, 0, 0);
        desenharPista(
          contexto2d,
          largura,
          altura,
          tempo,
          opcoes.antecedencia,
          {
            notas: partida.notas,
            primeira: partida.primeira,
            batidas,
            apertados,
            explosoes,
            falhas,
            estrelaAtiva: partida.estrelaAtiva,
            multiplicador: Math.min(4, 1 + Math.floor(partida.sequencia / 10)),
            frasesFalhas: partida.frasesFalhas,
            trovoes,
            estrelaDesde,
          },
          opcoes.efeitos,
          sprites,
        );
      }

      // O HUD fica na loja: valores arredondados, e só os componentes dele re-renderizam quando algo visível muda.
      const recorde = recordeAtual.current;
      if (!recordeBatido && recorde && partida.pontos > recorde) {
        recordeBatido = true;
        avisar("RECORDE BATIDO!", true);
      }

      const proximo: Hud = {
        pontos: Math.round(partida.pontos),
        sequencia: partida.sequencia,
        multiplicador: multiplicador(partida),
        vida: Math.round(partida.vida * 100) / 100,
        estrela: Math.round(partida.estrela * 100) / 100,
        estrelaAtiva: partida.estrelaAtiva,
        progresso: Math.round(Math.max(0, Math.min(1, tempo / duracao)) * 500) / 500,
        precisao: Math.round(precisao(partida) * 1000) / 1000,
        contagem: tempo < 0 ? Math.ceil(-tempo) : 0,
        pulso: partida.acertos,
        fantasma: partida.fantasma,
        estrelas: Math.round(progressoDasEstrelas(partida.pontos, carregada.notas.length) * 100) / 100,
        estrelasDoRecorde: progressoDasEstrelas(recordeAtual.current ?? 0, carregada.notas.length),
        reacao,
        julgamento,
      };
      loja.definir(proximo);
    };
    quadro = requestAnimationFrame(desenhar);

    return () => {
      cancelarRetomada();
      encerrarTransmissao();
      cancelAnimationFrame(quadro);
      observador?.disconnect();
      window.removeEventListener("keydown", aoApertar);
      window.removeEventListener("keyup", aoSoltar);
      window.removeEventListener("blur", aoPerderFoco);
      try {
        fonte.stop();
      } catch {
        // Já estava parada.
      }
      ganho.disconnect();
      video.current?.pause();
      void audio.resume();
    };
  }, [carregada, rodada, opcoes, musica.id, dificuldade, instrumento, aoTerminar, inicioEmRede, replay]);

  const recomecar = () => {
    setPausado(false);
    setRetomando(0);
    setDerrota(false);
    loja.definir(HUD_INICIAL);
    setAviso(null);
    setRodada((r) => r + 1);
  };

  // A guitarra é o padrão e não aparece; os outros instrumentos vêm antes da dificuldade.
  const rotuloDaDificuldade = [instrumento !== "guitarra" && INSTRUMENTOS.find((i) => i.id === instrumento)?.rotulo, DIFICULDADES.find((d) => d.id === dificuldade)?.rotulo]
    .filter(Boolean)
    .join(" · ");
  const layout = layoutDaPista(tamanho.largura, tamanho.altura);

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
    <div className="relative h-full w-full touch-none overflow-hidden select-none">
      {comPalco && carregada && <Palco lerEstado={() => estadoDoPalco.current} comPersonagem={cena.personagem} qualidade={opcoes.qualidadeDoPalco} />}
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      {/* Vinheta: as bordas escurecem e a luz fica no braço, como num palco. */}
      <div
        data-parte="vinheta"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 70%, transparent 35%, color-mix(in srgb, var(--cor-fundo) 85%, transparent) 100%)" }}
      />

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
          <header className="absolute top-0 right-0 left-0 flex items-center gap-4 px-6 pt-4">
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold">{musica.titulo}</h1>
              <p className="truncate text-base text-texto-suave">
                {musica.artista} · {rotuloDaDificuldade}
                {opcoes.bot && !replay && <span className="ml-2 rounded bg-estrela px-2 font-black text-fundo">BOT</span>}
                {velocidade !== 1 && <span className="ml-2 rounded bg-superficie-elevada px-2 font-black">{rotuloDaVelocidade(velocidade)}</span>}
                {replay && <span className="ml-2 rounded bg-primaria px-2 font-black">{replay.ateAgora === undefined ? "REPLAY" : "AO VIVO"}</span>}
                {opcoes.mostrarFps && <span className="ml-2 font-mono tabular-nums">{fps ?? "–"} FPS</span>}
              </p>
            </div>
            <ProgressoDaMusica loja={loja} />
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

          {/* Áreas de toque: uma embaixo de cada traste (funcionam com o mouse também). */}
          <div
            className="absolute flex"
            style={{
              left: layout.centro - layout.largura / 2,
              width: layout.largura,
              top: layout.linhaDeBatida - layout.larguraDoTraste * 0.45,
              bottom: temAberta ? ALTURA_DA_FAIXA_ABERTA : 0,
            }}
          >
            {NOMES_DAS_PISTAS.map((nome, pista) => (
              <div
                key={nome}
                role="button"
                aria-label={`Traste ${nome}`}
                className="flex h-full flex-1 items-end justify-center"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  controles.current.apertar(pista, e.nativeEvent);
                }}
                onPointerUp={() => controles.current.largar(pista)}
                onPointerCancel={() => controles.current.largar(pista)}
              >
                {opcoes.rotulosDosTrastes && (
                  <span className="mb-2 rounded-sm bg-superficie-elevada px-2 font-titulo text-lg tracking-wide text-texto-suave">{opcoes.rotulosDosTrastes[pista]}</span>
                )}
              </div>
            ))}
          </div>

          {/* A nota aberta não tem traste: no toque, ela tem uma faixa própria no pé da tela. */}
          {temAberta && (
            <div
              role="button"
              aria-label="Nota aberta"
              className="absolute bottom-0 flex items-center justify-center border-t border-borda bg-superficie/60"
              style={{ left: layout.centro - layout.largura / 2, width: layout.largura, height: ALTURA_DA_FAIXA_ABERTA }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                controles.current.apertar(PISTA_ABERTA, e.nativeEvent);
              }}
              onPointerUp={() => controles.current.largar(PISTA_ABERTA)}
              onPointerCancel={() => controles.current.largar(PISTA_ABERTA)}
            >
              <span className="font-titulo text-lg tracking-wide text-texto-suave">
                Aberta{opcoes.rotulosDosTrastes && ` · ${opcoes.rotulosDosTrastes[PISTA_ABERTA]}`}
              </span>
            </div>
          )}

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

          <HudDaPartida loja={loja} layout={layout} estreita={estreita} comPalco={comPalco} pausado={pausado} derrota={derrota} personagem={cena.personagem ? personagem : null} bpm={(musica.bpm || 120) * velocidade} aoEstrela={() => controles.current.estrela()} />

          <AnimatePresence>
            {aviso && (
              <motion.p
                key={aviso.id}
                initial={{ y: 16, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -16, opacity: 0 }}
                transition={{ duration: 0.25 }}
                onAnimationComplete={() => setTimeout(() => setAviso((a) => (a?.id === aviso.id ? null : a)), 1200)}
                className={cn("pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 text-3xl font-black", aviso.estrela ? "text-estrela" : "text-ouro")}
              >
                {aviso.texto}
              </motion.p>
            )}
          </AnimatePresence>
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

function ProgressoDaMusica({ loja }: { loja: LojaDoHud<Hud> }) {
  const { progresso } = useLoja(loja);
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-superficie-elevada" aria-label="Progresso da música">
      <div className="h-full bg-primaria" style={{ width: `${progresso * 100}%` }} />
    </div>
  );
}

interface PropsDoHud {
  loja: LojaDoHud<Hud>;
  layout: ReturnType<typeof layoutDaPista>;
  estreita: boolean;
  comPalco: boolean;
  pausado: boolean;
  derrota: boolean;
  /** Sem ele, o HUD não mostra o personagem. */
  personagem: Personagem | null;
  bpm: number;
  aoEstrela: () => void;
}

/** Tudo que muda junto com o placar: só este pedaço re-renderiza a cada quadro, não a tela inteira. */
function HudDaPartida({ loja, layout, estreita, comPalco, pausado, derrota, personagem, bpm, aoEstrela }: PropsDoHud) {
  const hud = useLoja(loja);
  const avatarDoJogador = (className: string) =>
    personagem && <Avatar personagem={personagem} tocando={hud.contagem === 0 && !derrota} bpm={bpm} pulso={hud.pulso} triste={hud.vida < 0.25} reacao={hud.reacao} className={className} />;

  return (
    <>
      {/* Os números ficam colados à esquerda da pista; no celular a pista ocupa a largura toda e eles sobem para o topo. */}
      <div
        className={cn("absolute", estreita ? "top-20 left-4" : "bottom-10 -translate-x-full")}
        style={estreita ? undefined : { left: Math.max(layout.centro - layout.largura / 2 - 24, LARGURA_DO_PAINEL + MARGEM_DO_HUD) }}
      >
        {/* O aviso fica no painel, acima da precisão, e não em cima da pista: não tapa as notas que vêm chegando. */}
        <PainelDePontos
          pontos={hud.pontos}
          sequencia={hud.sequencia}
          multiplicador={hud.multiplicador}
          precisao={hud.precisao}
          estrelaAtiva={hud.estrelaAtiva}
          compacto={estreita}
          aviso={<AvisoDeAcerto julgamento={hud.julgamento} />}
        />
      </div>

      {estreita ? (
        <div data-parte="hud-compacto" className="absolute top-20 right-4 flex flex-col items-end gap-2">
          {avatarDoJogador("h-20 w-auto")}
          <MedidorDeVida vida={hud.vida} fantasma={hud.fantasma} horizontal className="h-2.5 w-24" />
          <button
            aria-label={`Ativar star power (${Math.round(hud.estrela * 100)}%)`}
            onClick={aoEstrela}
            className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-base font-bold", hud.estrela >= 0.5 ? "bg-estrela text-fundo" : "bg-superficie-elevada text-texto-suave")}
          >
            <Zap className="size-4 opacity-70" aria-hidden /> {Math.round(hud.estrela * 100)}%
          </button>
        </div>
      ) : (
        <div data-parte="hud-lateral" className="absolute bottom-10 flex flex-col items-center" style={{ left: Math.min(layout.centro + layout.largura / 2 + 24, layout.centro * 2 - LARGURA_DO_HUD_LATERAL - MARGEM_DO_HUD) }}>
          {/* Com o palco, o personagem já está em cena atrás da pista. */}
          {!comPalco && avatarDoJogador("mb-2 h-44 w-auto")}
          <div className="flex items-end gap-4">
            <BarraDeEstrelas progresso={hud.estrelas} recorde={hud.estrelasDoRecorde} />
            <MedidorDeRock vida={hud.vida} estrela={hud.estrela} estrelaAtiva={hud.estrelaAtiva} fantasma={hud.fantasma} className="w-64" />
          </div>
        </div>
      )}

      <AnimatePresence>
        {hud.contagem > 0 && !pausado && <NumeroDaContagem key={hud.contagem} valor={hud.contagem} />}
      </AnimatePresence>
    </>
  );
}
/** O número grande do 3, 2, 1: no começo da música e ao voltar da pausa. */
function NumeroDaContagem({ valor }: { valor: number }) {
  return (
    <motion.p
      role="timer"
      aria-label={`Volta em ${valor}`}
      initial={{ scale: 2, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.5, opacity: 0 }}
      className="pointer-events-none absolute inset-0 flex items-center justify-center text-8xl font-black"
    >
      {valor}
    </motion.p>
  );
}

/** Só o placar re-renderiza quando os pontos mudam. */
function PlacarDaPartida({ loja, placar }: { loja: LojaDoHud<Hud>; placar: (pontos: number) => ReactNode }) {
  const { pontos } = useLoja(loja);
  return <>{placar(pontos)}</>;
}