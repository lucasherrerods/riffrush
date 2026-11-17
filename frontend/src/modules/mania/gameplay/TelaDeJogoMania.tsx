import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { agoraNoAudio, momentoDoEvento, obterContextoDeAudio, saidaDeAudio } from "@/modules/audio";
import { pontoDaPartida } from "@/modules/player";
import { limitesDaVolta, registrarVolta, rotuloDasVoltas, VOLTAS_INICIAIS, type Trecho, type Voltas } from "@/shared/lib/treino";
import { Button } from "@/shared/ui/button";
import { EscolhaDoTreino } from "@/shared/ui/EscolhaDoTreino";
import { MotorDoMania, iniciarMotorDoMania, velocidadeDosMods } from "./motor";
import { aplicarEventos, desenharPista, type QuadroDaPista } from "./desenhar";
import { MODS } from "./mods";
import { colunaDoToque, geometriaDaPista, type GeometriaDaPista } from "./pista";
import { colunaDaTecla, teclasDoMapa } from "./teclas";
import { registrarEventos, type Estatisticas } from "./estatisticas";
import { anotarNaBarraDeUr, BarraDeUrDaPartida, CabecalhoDaPartida, CarregandoPartida, type LeituraDaBarraDeUr } from "@/modules/partida";
import { CORES_DOS_JULGAMENTOS } from "../tema";
import { CapaDaFonte } from "../selecao/CapaDoConjunto";
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
  /** Para os gráficos do resultado. */
  estatisticas: Estatisticas;
  /** A janela do 50 no tempo real: o limite da barra de desvio. */
  janelaMs: number;
}

/** O que a partida manda para quem assiste ao vivo: as entradas novas a cada segundo, com até onde a música chegou. */
export type EventoDoManiaAoVivo = { tipo: "inicio" } | { tipo: "lote"; entradas: EntradaDoMania[]; ate: number } | { tipo: "fim" };

/** O placar que a partida em rede manda para a sala. */
export interface JogadaEmRede {
  pontos: number;
  precisao: number;
  combo: number;
  derrota: boolean;
  terminou: boolean;
}

/** De quanto em quanto tempo o placar vai para a sala, como no Rock. */
const PLACAR_MS = 125;

/** De quanto em quanto tempo as entradas vão para quem assiste. */
const LOTE_MS = 1000;

export interface MapaParaJogar {
  titulo: string;
  artista?: string;
  /** A capa do conjunto: a URL do site ou o fundo guardado. */
  capa?: Blob | string;
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
  /** Quando a partida acaba de qualquer jeito: o segundo do áudio em que a música estava, para a trilha dos menus continuar dali. */
  aoMarcarPontoDaMusica?: (segundos: number) => void;
  /** Treino: o jogador escolhe uma parte do mapa, que repete até ele sair. A partida nunca termina, então nada vai para o ranking. */
  treino?: boolean;
  /** Para os testes: o decodificador do áudio. */
  decodificar?: (contexto: AudioContext, bytes: Uint8Array) => Promise<AudioBuffer>;
  /** Assistir: as entradas do replay tocam sozinhas, no tempo da música, e o teclado só serve para sair. */
  replay?: EntradaDoMania[];
  /** O selo no alto da tela durante o replay, como "REPLAY · Ana". */
  rotuloDoReplay?: string;
  /** Transmitir a partida para quem assiste ao vivo. No treino não transmite. */
  aoTransmitir?: (evento: EventoDoManiaAoVivo) => void;
  /** Assistindo ao vivo: o performance.now em que a música começou para quem assiste, que entra no meio dela. */
  aoVivo?: { inicio: number };
  /** Partida numa sala: a música larga no `inicio` da sala (performance.now), o placar vai para os outros e os deles aparecem na tela. */
  rede?: { inicio: number; aoAtualizar: (jogada: JogadaEmRede) => void; adversarios?: ReactNode };
}

const decodificarPadrao = (contexto: AudioContext, bytes: Uint8Array) => contexto.decodeAudioData(bytes.slice().buffer);

/** No treino ninguém falha, e os mods que derrubam a partida no primeiro erro não fazem sentido. */
const modsDoTreino = (mods: number) => (mods & ~(MODS.SD | MODS.PF)) | MODS.NF;

export function TelaDeJogoMania({ mapa, mods = 0, semente = 0, opcoes = OPCOES_PADRAO_DO_MANIA, aoTerminar, aoSair, treino = false, decodificar = decodificarPadrao, replay, rotuloDoReplay, aoTransmitir, aoVivo, aoMarcarPontoDaMusica, rede }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [precisao, setPrecisao] = useState(1);
  const [progresso, setProgresso] = useState(0);
  /** A barra de UR do topo lê daqui a cada quadro. */
  const lerUr = useRef<() => LeituraDaBarraDeUr | null>(() => null);
  const [pronta, setPronta] = useState(false);
  const [trechos, setTrechos] = useState<Trecho[] | null>(null);
  const [trecho, setTrecho] = useState<Trecho | null>(null);
  const [contagemNoTreino, setContagemNoTreino] = useState(true);
  const [voltas, setVoltas] = useState<Voltas>(VOLTAS_INICIAIS);
  /** Segundos que faltam para a música voltar, na contagem do treino. */
  const [falta, setFalta] = useState(0);
  const aoAtualizar = rede?.aoAtualizar;
  const retornos = useRef({ aoTerminar, aoSair, aoTransmitir, aoMarcarPontoDaMusica, aoAtualizar });
  retornos.current = { aoTerminar, aoSair, aoTransmitir, aoMarcarPontoDaMusica, aoAtualizar };
  // Lido só ao montar: quem assiste remonta a tela (pela key) a cada sincronização.
  const inicioAoVivo = useRef(aoVivo?.inicio ?? rede?.inicio);
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
      if (inicioAoVivo.current !== undefined) {
        // Ao vivo, a música entra já no ponto em que a partida de quem joga está, ou espera ela começar.
        const desde = (performance.now() - inicioAoVivo.current) / 1000;
        if (desde >= 0) tocar(RECOMECO_S, desde + RECOMECO_S);
        else tocar(-desde, 0);
      } else tocar(ENTRADA_S, desdeNoTreino);

      const transmitindo = !treino;
      const transmitir = (evento: EventoDoManiaAoVivo) => transmitindo && retornos.current.aoTransmitir?.(evento);
      let enviadas = 0;
      let ultimoLoteMs = -Infinity;
      const mandarLote = (agoraMs: number) => {
        ultimoLoteMs = agoraMs;
        transmitir({ tipo: "lote", entradas: entradas.slice(enviadas), ate: agoraMs / 1000 });
        enviadas = entradas.length;
      };
      let transmissaoEncerrada = false;
      const encerrarTransmissao = () => {
        if (transmissaoEncerrada) return;
        transmissaoEncerrada = true;
        transmitir({ tipo: "fim" });
      };
      transmitir({ tipo: "inicio" });

      const emMs = (tempoDoAudio: number) => Math.round((tempoDoAudio - inicio) * 1000 - opcoes.atrasoMs);
      const quadro: QuadroDaPista = { agoraMs: emMs(agoraNoAudio(contexto)), rolagemMs: opcoes.rolagemMs, notas, estados, apertadas, combo: 0, vida: 1 };
      // Até o 50: o Miss não tem desvio para marcar.
      const ur: LeituraDaBarraDeUr = { marcas: [], janelas: Array.from(motor.janelas()).slice(0, 5), agoraMs: quadro.agoraMs };
      lerUr.current = () => ((ur.agoraMs = quadro.agoraMs), ur);
      const estatisticas: Estatisticas = { julgamentos: [], desvios: [] };
      const lerEventos = () => {
        const eventos = motor.eventos();
        const desviosAntes = estatisticas.desvios.length;
        registrarEventos(estatisticas, eventos);
        anotarNaBarraDeUr(ur, estatisticas.desvios, estatisticas.desvios.slice(desviosAntes), quadro.agoraMs);
        const julgamento = aplicarEventos(estados, notas, eventos);
        if (julgamento !== undefined) {
          quadro.julgamento = { codigo: julgamento, emMs: quadro.agoraMs };
          // Só muda com julgamento novo; o React ignora quando o valor é o mesmo.
          setPrecisao(motor.precisao());
        }
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
        setPrecisao(1);
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

      const jogada = (terminou: boolean): JogadaEmRede => ({ pontos: motor.pontuacao(), precisao: motor.precisao(), combo: motor.combo, derrota: motor.derrota, terminou });
      let ultimoPlacarMs = -Infinity;

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
          estatisticas,
          janelaMs: motor.janelas()[4],
        };
        if (enviadas < entradas.length) mandarLote(quadro.agoraMs);
        retornos.current.aoAtualizar?.(jogada(true));
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
        if (coluna < 0 || replay) return;
        evento.preventDefault();
        if (evento.repeat) return;
        tocarColuna(coluna, evento);
      };
      const aoSoltar = (evento: KeyboardEvent) => soltarColuna(colunaDaTecla(teclas, evento.code), evento);
      // Teclado e dedo entram pelo mesmo caminho: o motor e o replay não sabem de onde veio a nota.
      function tocarColuna(coluna: number, evento: Event) {
        if (apertadas[coluna]) return;
        apertadas[coluna] = true;
        const tempo = emMs(momentoDoEvento(contexto, evento));
        motor.tocar(coluna, tempo);
        entradas.push([tempo, coluna, 1]);
        lerEventos();
      }
      function soltarColuna(coluna: number, evento: Event) {
        if (coluna < 0 || replay || !apertadas[coluna]) return;
        apertadas[coluna] = false;
        const tempo = emMs(momentoDoEvento(contexto, evento));
        motor.soltar(coluna, tempo);
        entradas.push([tempo, coluna, 0]);
        lerEventos();
      }
      window.addEventListener("keydown", aoApertar);
      window.addEventListener("keyup", aoSoltar);

      // No celular cada dedo aperta a coluna onde encostou e solta ao sair da tela (as notas longas seguram junto).
      const dedos = new Map<number, number>();
      const aoEncostar = (evento: PointerEvent) => {
        if (evento.pointerType === "mouse" || replay || !geometria || !tela) return;
        evento.preventDefault();
        const coluna = colunaDoToque(evento.clientX - tela.getBoundingClientRect().left, geometria);
        dedos.set(evento.pointerId, coluna);
        tocarColuna(coluna, evento);
      };
      const aoTirarODedo = (evento: PointerEvent) => {
        const coluna = dedos.get(evento.pointerId);
        if (coluna === undefined) return;
        dedos.delete(evento.pointerId);
        // Outro dedo ainda na mesma coluna a mantém apertada.
        if (![...dedos.values()].includes(coluna)) soltarColuna(coluna, evento);
      };

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
      tela?.addEventListener("pointerdown", aoEncostar);
      tela?.addEventListener("pointerup", aoTirarODedo);
      tela?.addEventListener("pointercancel", aoTirarODedo);

      // No replay, cada entrada gravada entra no motor quando a música chega no tempo dela, como se fosse tocada agora.
      let proximaDoReplay = 0;
      const tocarReplayAte = (agoraMs: number) => {
        if (!replay) return;
        while (proximaDoReplay < replay.length && replay[proximaDoReplay][0] <= agoraMs) {
          const [tempo, coluna, toca] = replay[proximaDoReplay++];
          if (toca) motor.tocar(coluna, tempo);
          else motor.soltar(coluna, tempo);
          apertadas[coluna] = toca === 1;
          entradas.push([tempo, coluna, toca]);
          lerEventos();
        }
      };

      let pedido = 0;
      let faltaNaTela = 0;
      let progressoNaTela = 0;
      const duracaoMs = (buffer.duration / velocidade) * 1000;
      let voltasFeitas = 0;
      const desenhar = () => {
        const agora = agoraNoAudio(contexto);
        quadro.agoraMs = emMs(agora);
        tocarReplayAte(quadro.agoraMs);
        if (ultimoLoteMs === -Infinity) ultimoLoteMs = quadro.agoraMs;
        else if (quadro.agoraMs - ultimoLoteMs >= LOTE_MS) mandarLote(quadro.agoraMs);
        motor.avancar(quadro.agoraMs);
        lerEventos();
        quadro.combo = motor.combo;
        quadro.vida = motor.vida;
        if (retornos.current.aoAtualizar && quadro.agoraMs >= 0 && quadro.agoraMs - ultimoPlacarMs >= PLACAR_MS) {
          ultimoPlacarMs = quadro.agoraMs;
          retornos.current.aoAtualizar(jogada(false));
        }
        // Em passos de 0,2%: o React só re-renderiza quando a barra anda de verdade.
        const progressoAgora = Math.round(Math.max(0, Math.min(1, quadro.agoraMs / duracaoMs)) * 500) / 500;
        if (progressoAgora !== progressoNaTela) setProgresso((progressoNaTela = progressoAgora));
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
        retornos.current.aoMarcarPontoDaMusica?.(pontoDaPartida(inicio, agoraNoAudio(contexto), velocidade));
        encerrarTransmissao();
        cancelAnimationFrame(pedido);
        observador?.disconnect();
        window.removeEventListener("keydown", aoApertar);
        window.removeEventListener("keyup", aoSoltar);
        tela?.removeEventListener("pointerdown", aoEncostar);
        tela?.removeEventListener("pointerup", aoTirarODedo);
        tela?.removeEventListener("pointercancel", aoTirarODedo);
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
  }, [mapa, mods, semente, opcoes, decodificar, treino, trecho, contagemNoTreino, replay]);

  const escolhendo = treino && !trecho;
  return (
    <main className="relative h-full overflow-hidden bg-fundo text-texto">
      <canvas ref={canvas} aria-label="Pista do Mania" className="absolute inset-0 h-full w-full touch-none select-none" />
      {pronta && <BarraDeUrDaPartida ler={() => lerUr.current()} cores={CORES_DOS_JULGAMENTOS} />}
      {pronta && (
        <CabecalhoDaPartida
          titulo={mapa.titulo}
          artista={mapa.artista}
          detalhe={mapa.dificuldade}
          capa={<CapaDaFonte fonte={mapa.capa} />}
          precisao={precisao}
          progresso={progresso}
          selos={
            <>
              {replay && <span className="rounded bg-primaria px-2 font-black text-texto">{rotuloDoReplay ?? "REPLAY"}</span>}
              {trecho && <span className="rounded bg-primaria px-2 font-black text-texto">{["TREINO", trecho.nome, rotuloDasVoltas(voltas)].filter(Boolean).join(" · ")}</span>}
            </>
          }
          acoes={
            trecho && (
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
            )
          }
        />
      )}
      {rede?.adversarios && <div className="pointer-events-none absolute top-28 right-6 z-10 w-72 max-md:right-2 max-md:w-48">{rede.adversarios}</div>}
      {falta > 0 && (
        <p role="timer" className="pointer-events-none absolute inset-0 grid place-items-center font-titulo text-8xl">
          {falta}
        </p>
      )}
      {!pronta && !erro && !(escolhendo && trechos) && <CarregandoPartida mensagem="Carregando o mapa…" titulo={mapa.titulo} detalhe={mapa.dificuldade} />}
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
