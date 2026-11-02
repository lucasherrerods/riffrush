import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { agoraNoAudio, momentoDoEvento, obterContextoDeAudio, saidaDeAudio } from "@/modules/audio";
import { limitesDaVolta, registrarVolta, rotuloDasVoltas, VOLTAS_INICIAIS, type Trecho, type Voltas } from "@/shared/lib/treino";
import { Button } from "@/shared/ui/button";
import { EscolhaDoTreino } from "@/shared/ui/EscolhaDoTreino";
import { MotorDoMania, iniciarMotorDoMania, velocidadeDosMods } from "./motor";
import { aplicarEventos, desenharPista, type QuadroDaPista } from "./desenhar";
import { MODS } from "./mods";
import { geometriaDaPista, type GeometriaDaPista } from "./pista";
import { colunaDaTecla, teclasDoMapa } from "./teclas";
import { mapaDoTrecho, trechosDoMapa } from "./treino";

/** A música começa depois deste respiro, para o jogador se posicionar. */
const ENTRADA_S = 2;
/** Depois da última nota, a partida espera isto antes de mostrar o resultado. */
const FOLGA_NO_FIM_MS = 1200;
/** No treino com contagem, o silêncio antes de cada repetição. */
const CONTAGEM_S = 3;
/** Sem contagem, a música volta quase na hora: só o tempo de agendar a fonte nova. */
const RECOMECO_S = 0.05;

export interface OpcoesDoMania {
  /** Quanto tempo a nota leva do topo até a linha de julgamento. */
  rolagemMs: number;
  /** Atraso do áudio do aparelho: positivo quando o som sai depois do que a tela mostra. */
  atrasoMs: number;
  volumeDaMusica: number;
  teclasPersonalizadas: Record<number, string[]>;
}

export const OPCOES_PADRAO_DO_MANIA: OpcoesDoMania = { rolagemMs: 700, atrasoMs: 0, volumeDaMusica: 0.8, teclasPersonalizadas: {} };

/** Uma entrada do jogador: [tempo em ms, coluna, 1 = toca / 0 = solta]. É o que o replay guarda. */
export type EntradaDoMania = [number, number, number];

export interface ResultadoDoMania {
  pontuacao: number;
  precisao: number;
  classificacao: string;
  /** De MAX a Miss. */
  contagem: number[];
  maiorCombo: number;
  derrota: boolean;
  mods: number;
  semente: number;
  hash: string;
  entradas: EntradaDoMania[];
}

export interface MapaParaJogar {
  titulo: string;
  dificuldade: string;
  /** O id da dificuldade no osu!, para a API conferir a partida. */
  beatmapId?: number;
  /** A partida vale XP e ranking: mapa ranked ou loved baixado da busca. */
  valeXp?: boolean;
  /** O .osu inteiro, que o motor lê. */
  texto: string;
  hash: string;
  audio: Uint8Array;
}

interface Props {
  mapa: MapaParaJogar;
  mods?: number;
  semente?: number;
  opcoes?: OpcoesDoMania;
  aoTerminar: (resultado: ResultadoDoMania) => void;
  aoSair: () => void;
  /** Treino: o jogador escolhe uma parte do mapa, que repete até ele sair. A partida nunca termina, então nada vai para o ranking. */
  treino?: boolean;
  /** Para os testes: o decodificador do áudio. */
  decodificar?: (contexto: AudioContext, bytes: Uint8Array) => Promise<AudioBuffer>;
}

const decodificarPadrao = (contexto: AudioContext, bytes: Uint8Array) => contexto.decodeAudioData(bytes.slice().buffer);

/** No treino ninguém falha, e os mods que derrubam a partida no primeiro erro não fazem sentido. */
const modsDoTreino = (mods: number) => (mods & ~(MODS.SD | MODS.PF)) | MODS.NF;

export function TelaDeJogoMania({ mapa, mods = 0, semente = 0, opcoes = OPCOES_PADRAO_DO_MANIA, aoTerminar, aoSair, treino = false, decodificar = decodificarPadrao }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pronta, setPronta] = useState(false);
  const [trechos, setTrechos] = useState<Trecho[] | null>(null);
  const [trecho, setTrecho] = useState<Trecho | null>(null);
  const [contagemNoTreino, setContagemNoTreino] = useState(true);
  const [voltas, setVoltas] = useState<Voltas>(VOLTAS_INICIAIS);
  /** Segundos que faltam para a música voltar, na contagem do treino. */
  const [falta, setFalta] = useState(0);
  const retornos = useRef({ aoTerminar, aoSair });
  retornos.current = { aoTerminar, aoSair };
  // Trocar de trecho não decodifica o áudio de novo.
  const decodificado = useRef<{ mapa: MapaParaJogar; buffer: AudioBuffer } | null>(null);

  useEffect(() => {
    let cancelado = false;
    let pararTudo = () => {};

    (async () => {
      await iniciarMotorDoMania();
      const contexto = obterContextoDeAudio();
      const buffer = decodificado.current?.mapa === mapa ? decodificado.current.buffer : await decodificar(contexto, mapa.audio);
      if (cancelado) return;
      decodificado.current = { mapa, buffer };
      if (treino && !trecho) {
        setTrechos(trechosDoMapa(mapa.texto, buffer.duration));
        return;
      }
      const velocidade = velocidadeDosMods(mods);
      const textoDaPartida = trecho ? mapaDoTrecho(mapa.texto, trecho) : mapa.texto;
      const modsDaPartida = trecho ? modsDoTreino(mods) : mods;
      let motor = new MotorDoMania(textoDaPartida, modsDaPartida, semente);
      let notas = motor.notas();
      let estados = new Uint8Array(notas.length / 3);
      const teclas = teclasDoMapa(motor.teclas, opcoes.teclasPersonalizadas);
      const apertadas = Array<boolean>(motor.teclas).fill(false);
      const entradas: EntradaDoMania[] = [];
      let ultimaNotaMs = 0;
      for (let i = 0; i < notas.length; i += 3) ultimaNotaMs = Math.max(ultimaNotaMs, notas[i + 1], notas[i + 2]);
      // No tempo real: com DT e HT a música inteira encolhe ou estica.
      const volta = trecho && limitesDaVolta(trecho, velocidade, buffer.duration / velocidade);

      const ganho = contexto.createGain();
      ganho.gain.value = opcoes.volumeDaMusica;
      ganho.connect(saidaDeAudio());
      let fonte: AudioBufferSourceNode;
      let inicio = 0;
      /** Toca a música a partir do segundo `desde` (tempo real) depois de `espera` segundos. */
      const tocar = (espera: number, desde: number) => {
        fonte = contexto.createBufferSource();
        fonte.buffer = buffer;
        // A partida roda no tempo real; com DT e HT só o áudio muda de velocidade.
        fonte.playbackRate.value = velocidade;
        fonte.connect(ganho);
        const quando = contexto.currentTime + espera;
        fonte.start(quando, desde * velocidade);
        inicio = quando - desde;
      };
      const desdeNoTreino = volta ? Math.max(0, volta.inicio) : 0;
      tocar(ENTRADA_S, desdeNoTreino);

      const emMs = (tempoDoAudio: number) => Math.round((tempoDoAudio - inicio) * 1000 - opcoes.atrasoMs);
      const quadro: QuadroDaPista = { agoraMs: emMs(agoraNoAudio(contexto)), rolagemMs: opcoes.rolagemMs, notas, estados, apertadas, combo: 0, vida: 1 };
      const lerEventos = () => {
        const julgamento = aplicarEventos(estados, notas, motor.eventos());
        if (julgamento !== undefined) quadro.julgamento = { codigo: julgamento, emMs: quadro.agoraMs };
      };

      /** No treino, o fim da parte começa uma partida nova dela e volta a música para o começo. */
      const repetirTrecho = () => {
        if (!volta) return;
        if (motor.contagem().some((n) => n > 0)) {
          const precisao = motor.precisao();
          setVoltas((atuais) => registrarVolta(atuais, precisao));
        }
        motor.free();
        motor = new MotorDoMania(textoDaPartida, modsDaPartida, semente);
        quadro.notas = notas = motor.notas();
        quadro.estados = estados = new Uint8Array(notas.length / 3);
        quadro.julgamento = undefined;
        try {
          fonte.stop();
        } catch {
          // A fonte já tinha parado.
        }
        tocar(contagemNoTreino ? CONTAGEM_S : RECOMECO_S, desdeNoTreino);
      };

      let terminada = false;
      const terminar = () => {
        if (terminada) return;
        terminada = true;
        const resultado: ResultadoDoMania = {
          pontuacao: motor.pontuacao(),
          precisao: motor.precisao(),
          classificacao: motor.classificacao(),
          contagem: [...motor.contagem()],
          maiorCombo: motor.maiorCombo,
          derrota: motor.derrota,
          mods,
          semente,
          hash: mapa.hash,
          entradas,
        };
        pararTudo();
        retornos.current.aoTerminar(resultado);
      };

      const aoApertar = (evento: KeyboardEvent) => {
        if (evento.code === "Escape") {
          pararTudo();
          retornos.current.aoSair();
          return;
        }
        const coluna = colunaDaTecla(teclas, evento.code);
        if (coluna < 0) return;
        evento.preventDefault();
        if (evento.repeat || apertadas[coluna]) return;
        apertadas[coluna] = true;
        const tempo = emMs(momentoDoEvento(contexto, evento));
        motor.tocar(coluna, tempo);
        entradas.push([tempo, coluna, 1]);
        lerEventos();
      };
      const aoSoltar = (evento: KeyboardEvent) => {
        const coluna = colunaDaTecla(teclas, evento.code);
        if (coluna < 0 || !apertadas[coluna]) return;
        apertadas[coluna] = false;
        const tempo = emMs(momentoDoEvento(contexto, evento));
        motor.soltar(coluna, tempo);
        entradas.push([tempo, coluna, 0]);
        lerEventos();
      };
      window.addEventListener("keydown", aoApertar);
      window.addEventListener("keyup", aoSoltar);

      // O tamanho vem do ResizeObserver e a geometria só muda com ele: ler clientWidth todo quadro força um layout.
      const tela = canvas.current;
      const c = tela?.getContext("2d") ?? null;
      let geometria: GeometriaDaPista | null = null;
      const medir = () => {
        if (!tela) return;
        // Até 2x: mais que isso pesa no celular e não se vê diferença.
        const escala = Math.min(window.devicePixelRatio || 1, 2);
        const largura = tela.clientWidth;
        const altura = tela.clientHeight;
        tela.width = Math.round(largura * escala);
        tela.height = Math.round(altura * escala);
        quadro.escala = escala;
        geometria = geometriaDaPista(largura, altura, motor.teclas);
      };
      medir();
      const observador = tela && typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
      if (tela) observador?.observe(tela);

      let pedido = 0;
      let faltaNaTela = 0;
      let voltasFeitas = 0;
      const desenhar = () => {
        const agora = agoraNoAudio(contexto);
        quadro.agoraMs = emMs(agora);
        motor.avancar(quadro.agoraMs);
        lerEventos();
        quadro.combo = motor.combo;
        quadro.vida = motor.vida;
        if (c && geometria) {
          c.setTransform(quadro.escala ?? 1, 0, 0, quadro.escala ?? 1, 0, 0);
          desenharPista(c, geometria, quadro);
        }
        if (volta) {
          // A contagem só aparece na espera entre as voltas, não no respiro da primeira.
          const restante = contagemNoTreino && voltasFeitas > 0 ? Math.max(0, Math.ceil(inicio + desdeNoTreino - agora)) : 0;
          if (restante !== faltaNaTela) setFalta((faltaNaTela = restante));
          if (quadro.agoraMs >= volta.fim * 1000) {
            voltasFeitas++;
            repetirTrecho();
          }
        } else if (motor.derrota || (motor.terminou() && quadro.agoraMs > ultimaNotaMs + FOLGA_NO_FIM_MS)) return terminar();
        pedido = requestAnimationFrame(desenhar);
      };
      pedido = requestAnimationFrame(desenhar);

      pararTudo = () => {
        cancelAnimationFrame(pedido);
        observador?.disconnect();
        window.removeEventListener("keydown", aoApertar);
        window.removeEventListener("keyup", aoSoltar);
        try {
          fonte.stop();
        } catch {
          // A fonte já tinha parado.
        }
        ganho.disconnect();
        motor.free();
        pararTudo = () => {};
      };
      setPronta(true);
    })().catch((e: unknown) => !cancelado && setErro(e instanceof Error ? e.message : String(e)));

    return () => {
      cancelado = true;
      pararTudo();
    };
  }, [mapa, mods, semente, opcoes, decodificar, treino, trecho, contagemNoTreino]);

  const escolhendo = treino && !trecho;
  return (
    <main className="relative h-full bg-fundo text-texto">
      <header className="absolute inset-x-0 top-0 flex items-baseline justify-between gap-4 px-6 py-4">
        <h1 className="font-titulo text-2xl tracking-wide">{mapa.titulo}</h1>
        {trecho && (
          <p className="rounded bg-primaria px-2 font-black">{["TREINO", trecho.nome, rotuloDasVoltas(voltas)].filter(Boolean).join(" · ")}</p>
        )}
        <div className="flex items-baseline gap-4">
          {trecho && (
            <Button
              variant="ghost"
              size="sm"
              // As teclas são do jogo: o botão não fica com o foco depois do clique.
              onPointerUp={(e) => e.currentTarget.blur()}
              onClick={() => {
                setPronta(false);
                setFalta(0);
                setTrecho(null);
              }}
            >
              Trocar trecho
            </Button>
          )}
          <p className="text-texto-suave">{mapa.dificuldade}</p>
        </div>
      </header>
      <canvas ref={canvas} aria-label="Pista do Mania" className="h-full w-full" />
      {falta > 0 && (
        <p role="timer" className="pointer-events-none absolute inset-0 grid place-items-center font-titulo text-8xl">
          {falta}
        </p>
      )}
      {!pronta && !erro && !(escolhendo && trechos) && <p className="absolute inset-0 grid place-items-center text-texto-suave">Carregando o mapa…</p>}
      <AnimatePresence>
        {escolhendo && trechos && (
          <EscolhaDoTreino
            trechos={trechos}
            aviso="Os mods escolhidos valem, menos SD e PF; ninguém falha no treino."
            contagem={contagemNoTreino}
            aoContagem={setContagemNoTreino}
            aoComecar={(escolhido) => {
              setVoltas(VOLTAS_INICIAIS);
              setTrecho(escolhido);
            }}
            aoSair={aoSair}
          />
        )}
      </AnimatePresence>
      {erro && (
        <div role="alert" className="absolute inset-0 grid place-items-center">
          <p>Não foi possível abrir o mapa: {erro}</p>
        </div>
      )}
    </main>
  );
}
