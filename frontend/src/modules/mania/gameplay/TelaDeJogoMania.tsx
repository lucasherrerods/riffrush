import { useEffect, useRef, useState } from "react";
import { agoraNoAudio, momentoDoEvento, obterContextoDeAudio, saidaDeAudio } from "@/modules/audio";
import { MotorDoMania, iniciarMotorDoMania, velocidadeDosMods } from "./motor";
import { aplicarEventos, desenharPista, type QuadroDaPista } from "./desenhar";
import { geometriaDaPista, type GeometriaDaPista } from "./pista";
import { colunaDaTecla, teclasDoMapa } from "./teclas";

/** A música começa depois deste respiro, para o jogador se posicionar. */
const ENTRADA_S = 2;
/** Depois da última nota, a partida espera isto antes de mostrar o resultado. */
const FOLGA_NO_FIM_MS = 1200;

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
  /** Para os testes: o decodificador do áudio. */
  decodificar?: (contexto: AudioContext, bytes: Uint8Array) => Promise<AudioBuffer>;
}

const decodificarPadrao = (contexto: AudioContext, bytes: Uint8Array) => contexto.decodeAudioData(bytes.slice().buffer);

export function TelaDeJogoMania({ mapa, mods = 0, semente = 0, opcoes = OPCOES_PADRAO_DO_MANIA, aoTerminar, aoSair, decodificar = decodificarPadrao }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pronta, setPronta] = useState(false);
  const retornos = useRef({ aoTerminar, aoSair });
  retornos.current = { aoTerminar, aoSair };

  useEffect(() => {
    let cancelado = false;
    let pararTudo = () => {};

    (async () => {
      await iniciarMotorDoMania();
      const contexto = obterContextoDeAudio();
      const buffer = await decodificar(contexto, mapa.audio);
      if (cancelado) return;
      const motor = new MotorDoMania(mapa.texto, mods, semente);
      const notas = motor.notas();
      const estados = new Uint8Array(notas.length / 3);
      const teclas = teclasDoMapa(motor.teclas, opcoes.teclasPersonalizadas);
      const apertadas = Array<boolean>(motor.teclas).fill(false);
      const entradas: EntradaDoMania[] = [];
      let ultimaNotaMs = 0;
      for (let i = 0; i < notas.length; i += 3) ultimaNotaMs = Math.max(ultimaNotaMs, notas[i + 1], notas[i + 2]);

      const ganho = contexto.createGain();
      ganho.gain.value = opcoes.volumeDaMusica;
      ganho.connect(saidaDeAudio());
      const fonte = contexto.createBufferSource();
      fonte.buffer = buffer;
      // A partida roda no tempo real; com DT e HT só o áudio muda de velocidade.
      fonte.playbackRate.value = velocidadeDosMods(mods);
      fonte.connect(ganho);
      const inicio = contexto.currentTime + ENTRADA_S;
      fonte.start(inicio);

      const emMs = (tempoDoAudio: number) => Math.round((tempoDoAudio - inicio) * 1000 - opcoes.atrasoMs);
      const quadro: QuadroDaPista = { agoraMs: emMs(agoraNoAudio(contexto)), rolagemMs: opcoes.rolagemMs, notas, estados, apertadas, combo: 0, vida: 1 };
      const lerEventos = () => {
        const julgamento = aplicarEventos(estados, notas, motor.eventos());
        if (julgamento !== undefined) quadro.julgamento = { codigo: julgamento, emMs: quadro.agoraMs };
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
      const desenhar = () => {
        quadro.agoraMs = emMs(agoraNoAudio(contexto));
        motor.avancar(quadro.agoraMs);
        lerEventos();
        quadro.combo = motor.combo;
        quadro.vida = motor.vida;
        if (c && geometria) {
          c.setTransform(quadro.escala ?? 1, 0, 0, quadro.escala ?? 1, 0, 0);
          desenharPista(c, geometria, quadro);
        }
        if (motor.derrota || (motor.terminou() && quadro.agoraMs > ultimaNotaMs + FOLGA_NO_FIM_MS)) return terminar();
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
  }, [mapa, mods, semente, opcoes, decodificar]);

  return (
    <main className="relative h-full bg-fundo text-texto">
      <header className="absolute inset-x-0 top-0 flex items-baseline justify-between px-6 py-4">
        <h1 className="font-titulo text-2xl tracking-wide">{mapa.titulo}</h1>
        <p className="text-texto-suave">{mapa.dificuldade}</p>
      </header>
      <canvas ref={canvas} aria-label="Pista do Mania" className="h-full w-full" />
      {!pronta && !erro && <p className="absolute inset-0 grid place-items-center text-texto-suave">Carregando o mapa…</p>}
      {erro && (
        <div role="alert" className="absolute inset-0 grid place-items-center">
          <p>Não foi possível abrir o mapa: {erro}</p>
        </div>
      )}
    </main>
  );
}
