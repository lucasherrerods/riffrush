import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Pause, Skull, Zap } from "lucide-react";
import { agoraNoAudio, momentoDoEvento, obterContextoDeAudio, tocarEfeito } from "@/modules/audio";
import { Chibi, type Personagem } from "@/modules/character";
import { DIFICULDADES, carregarMusica, type Dificuldade, type Musica, type MusicaCarregada } from "@/modules/songs";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { criarBot, jogarSozinho } from "./bot";
import { MedidorDeVida } from "./componentes/MedidorDeVida";
import { MenuDePausa } from "./componentes/MenuDePausa";
import { CORES_DO_MULTIPLICADOR } from "./cores";
import { ativarEstrela, avancar, criarPartida, multiplicador, retirarEventos, soltar, tocar } from "./partida";
import { desenharPista, type Cena } from "./pista/desenhar";
import { layoutDaPista } from "./pista/geometria";
import { criarSprites } from "./pista/sprites";
import type { EstadoDoJogador } from "./rede";
import { resultadoDaPartida, type Resultado } from "./resultado";

/** O que a partida precisa saber das configurações do jogador. */
export interface OpcoesDaPartida {
  teclas: string[];
  teclaDaEstrela: string;
  rotuloDaTeclaDaEstrela: string;
  /** Segundos que a nota leva do horizonte até a linha de batida. */
  antecedencia: number;
  volumeDaMusica: number;
  volumeDosEfeitos: number;
  atrasoMs: number;
  semFalha: boolean;
  bot: boolean;
  efeitos: boolean;
}

export const OPCOES_PADRAO_DA_PARTIDA: OpcoesDaPartida = {
  teclas: ["KeyA", "KeyS", "KeyJ", "KeyK", "KeyL"],
  teclaDaEstrela: "Space",
  rotuloDaTeclaDaEstrela: "Espaço",
  antecedencia: 1.46,
  volumeDaMusica: 0.8,
  volumeDosEfeitos: 0.5,
  atrasoMs: 0,
  semFalha: false,
  bot: false,
  efeitos: true,
};

interface Props {
  musica: Musica;
  dificuldade: Dificuldade;
  opcoes: OpcoesDaPartida;
  personagem: Personagem;
  /** Partida em rede: largada combinada, estado enviado à sala e o painel dos adversários. */
  rede?: {
    /** Instante (performance.now) em que a música começa para todos. */
    inicio: number;
    aoAtualizar: (estado: EstadoDoJogador) => void;
    adversarios?: ReactNode;
  };
  aoSair: () => void;
  aoTerminar: (resultado: Resultado) => void;
}

interface Hud {
  pontos: number;
  sequencia: number;
  multiplicador: number;
  vida: number;
  estrela: number;
  estrelaAtiva: boolean;
  progresso: number;
  /** Segundos que faltam para a música começar (contagem), ou 0. */
  contagem: number;
  pulso: number;
}

const ENTRADA = 2.5;
const HUD_INICIAL: Hud = { pontos: 0, sequencia: 0, multiplicador: 1, vida: 0.5, estrela: 0, estrelaAtiva: false, progresso: 0, contagem: 3, pulso: 0 };
const MAXIMO_DE_EXPLOSOES = 20;
const SINCRONIA_DO_VIDEO = 0.15;
const INTERVALO_DO_ENVIO_MS = 125;
const nada = () => {};

export function TelaDeJogo({ musica, dificuldade, opcoes, personagem, rede, aoSair, aoTerminar }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const controles = useRef({ pausar: nada, continuar: nada, desistir: nada });
  const emRede = !!rede;
  // A rede chega como objeto novo a cada render; só o instante de largada reinicia a partida.
  const inicioEmRede = rede?.inicio;
  const redeAtual = useRef(rede);
  redeAtual.current = rede;
  const [carregada, setCarregada] = useState<MusicaCarregada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [urlDoVideo, setUrlDoVideo] = useState<string | null>(null);
  const [hud, setHud] = useState(HUD_INICIAL);
  const [pausado, setPausado] = useState(false);
  const pausadoNaTela = useRef(false);
  pausadoNaTela.current = pausado;
  const [derrota, setDerrota] = useState(false);
  const [rodada, setRodada] = useState(0);
  const [aviso, setAviso] = useState<{ id: number; texto: string; estrela: boolean } | null>(null);
  const [tamanho, setTamanho] = useState({ largura: window.innerWidth, altura: window.innerHeight });

  useEffect(() => {
    let cancelado = false;
    carregarMusica(musica, dificuldade)
      .then((m) => !cancelado && setCarregada(m))
      .catch((e) => !cancelado && setErro(String(e)));
    return () => {
      cancelado = true;
    };
  }, [musica, dificuldade]);

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
    ganho.connect(audio.destination);
    const fonte = audio.createBufferSource();
    fonte.buffer = carregada.audio;
    fonte.connect(ganho);
    // Em rede a música começa no instante combinado; quem carregou atrasado entra no meio.
    const agora = audio.currentTime;
    const inicio = inicioEmRede === undefined ? agora + ENTRADA : agora + (inicioEmRede - performance.now()) / 1000;
    if (inicio > agora + 0.05) fonte.start(inicio);
    else fonte.start(agora + 0.05, agora + 0.05 - inicio);

    const partida = criarPartida(carregada.notas, { semFalha: opcoes.semFalha });
    const bot = opcoes.bot ? criarBot() : null;
    const sprites = criarSprites();
    const contexto2d = canvas.current?.getContext("2d") ?? null;
    const apertados = [false, false, false, false, false];
    const explosoes: Cena["explosoes"] = [];
    const atraso = opcoes.atrasoMs / 1000;
    const tempoDaMusica = (tempoDoAudio: number) => tempoDoAudio - inicio - atraso;
    let pausadoAgora = false;
    let terminou = false;
    let quadro = 0;
    let ultimoHud = HUD_INICIAL;
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
        terminou: terminouAgora,
      });
    const avisar = (texto: string, estrela = false) => setAviso({ id: ++idDoAviso, texto, estrela });

    const terminar = () => {
      if (terminou) return;
      terminou = true;
      publicar(true);
      video.current?.pause();
      if (partida.derrota) {
        fonte.stop();
        tocarEfeito("erro", opcoes.volumeDosEfeitos);
        setDerrota(true);
      } else {
        aoTerminar(resultadoDaPartida(partida, musica.id, dificuldade));
      }
    };

    const tratarEventos = (tempo: number) => {
      for (const evento of retirarEventos(partida)) {
        if (evento.tipo === "acerto") {
          explosoes.push({ pista: evento.nota.pista, tempo });
          if (explosoes.length > MAXIMO_DE_EXPLOSOES) explosoes.shift();
        } else if (evento.tipo === "erro" && ultimoHud.sequencia >= 10) {
          tocarEfeito("erro", opcoes.volumeDosEfeitos * 0.6);
        } else if (evento.tipo === "sequencia") {
          avisar(`${evento.valor} notas seguidas!`);
        } else if (evento.tipo === "fraseCompleta") {
          tocarEfeito("estrela", opcoes.volumeDosEfeitos * 0.6);
        } else if (evento.tipo === "estrelaPronta") {
          avisar(`Star Power pronto! [${opcoes.rotuloDaTeclaDaEstrela}]`, true);
        } else if (evento.tipo === "estrelaAtivada") {
          tocarEfeito("estrela", opcoes.volumeDosEfeitos);
          avisar("STAR POWER!", true);
        } else if (evento.tipo === "derrota") {
          terminar();
        }
      }
    };

    // Em rede a música dos outros não para: a pausa só abre o menu.
    const pausar = () => {
      if (terminou) return;
      if (inicioEmRede !== undefined) return setPausado(true);
      if (pausadoAgora) return;
      pausadoAgora = true;
      void audio.suspend();
      video.current?.pause();
      setPausado(true);
    };
    const continuar = () => {
      setPausado(false);
      if (!pausadoAgora) return;
      pausadoAgora = false;
      void audio.resume();
    };
    const desistir = () => {
      partida.derrota = true;
      terminou = true;
      publicar(true);
      aoTerminar(resultadoDaPartida(partida, musica.id, dificuldade));
    };
    controles.current = { pausar, continuar, desistir };

    const aoApertar = (evento: KeyboardEvent) => {
      if (evento.code === "Escape") {
        evento.preventDefault();
        if (pausadoAgora || (inicioEmRede !== undefined && pausadoNaTela.current)) continuar();
        else pausar();
        return;
      }
      if (pausadoAgora || terminou) return;
      const pista = opcoes.teclas.indexOf(evento.code);
      if (pista >= 0) {
        evento.preventDefault();
        if (evento.repeat) return;
        apertados[pista] = true;
        const tempo = tempoDaMusica(momentoDoEvento(audio, evento));
        tocar(partida, pista, tempo);
        tratarEventos(tempo);
      } else if (evento.code === opcoes.teclaDaEstrela) {
        evento.preventDefault();
        ativarEstrela(partida);
      }
    };
    const aoSoltar = (evento: KeyboardEvent) => {
      const pista = opcoes.teclas.indexOf(evento.code);
      if (pista < 0) return;
      apertados[pista] = false;
      soltar(partida, pista, tempoDaMusica(agoraNoAudio(audio)));
    };
    window.addEventListener("keydown", aoApertar);
    window.addEventListener("keyup", aoSoltar);
    const aoPerderFoco = () => inicioEmRede === undefined && pausar();
    window.addEventListener("blur", aoPerderFoco);

    const desenhar = () => {
      quadro = requestAnimationFrame(desenhar);
      const tempo = tempoDaMusica(agoraNoAudio(audio));

      if (!pausadoAgora && !terminou) {
        if (bot) jogarSozinho(bot, partida, tempo).forEach((apertado, i) => (apertados[i] = apertado));
        avancar(partida, tempo);
        tratarEventos(tempo);
        if (!terminou && tempo >= carregada.duracao) terminar();
        if (!terminou && performance.now() - ultimoEnvio > INTERVALO_DO_ENVIO_MS) {
          ultimoEnvio = performance.now();
          publicar(false);
        }
      }

      const clipe = video.current;
      if (clipe && !terminou && !pausadoAgora && tempo >= 0 && performance.now() - ultimaSincroniaDoVideo > 500) {
        ultimaSincroniaDoVideo = performance.now();
        if (clipe.paused) void clipe.play().catch(nada);
        if (Math.abs(clipe.currentTime - tempo) > SINCRONIA_DO_VIDEO) clipe.currentTime = tempo;
      }

      const elemento = canvas.current;
      if (contexto2d && elemento) {
        const escala = Math.min(2, window.devicePixelRatio || 1);
        const largura = elemento.clientWidth;
        const altura = elemento.clientHeight;
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
            batidas: carregada.batidas,
            apertados,
            explosoes,
            estrelaAtiva: partida.estrelaAtiva,
            multiplicador: Math.min(4, 1 + Math.floor(partida.sequencia / 10)),
            frasesFalhas: partida.frasesFalhas,
          },
          opcoes.efeitos,
          sprites,
        );
      }

      // O HUD é React: valores arredondados, e só re-renderiza quando algo visível mudou.
      const proximo: Hud = {
        pontos: Math.round(partida.pontos),
        sequencia: partida.sequencia,
        multiplicador: multiplicador(partida),
        vida: Math.round(partida.vida * 100) / 100,
        estrela: Math.round(partida.estrela * 100) / 100,
        estrelaAtiva: partida.estrelaAtiva,
        progresso: Math.round(Math.max(0, Math.min(1, tempo / carregada.duracao)) * 500) / 500,
        contagem: tempo < 0 ? Math.ceil(-tempo) : 0,
        pulso: partida.acertos,
      };
      if ((Object.keys(proximo) as (keyof Hud)[]).some((chave) => proximo[chave] !== ultimoHud[chave])) {
        ultimoHud = proximo;
        setHud(proximo);
      }
    };
    quadro = requestAnimationFrame(desenhar);

    return () => {
      cancelAnimationFrame(quadro);
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
  }, [carregada, rodada, opcoes, musica.id, dificuldade, aoTerminar, inicioEmRede]);

  const recomecar = () => {
    setPausado(false);
    setDerrota(false);
    setHud(HUD_INICIAL);
    setAviso(null);
    setRodada((r) => r + 1);
  };

  const rotuloDaDificuldade = DIFICULDADES.find((d) => d.id === dificuldade)?.rotulo;
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
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />

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
                {opcoes.bot && <span className="ml-2 rounded bg-[#38bdf8] px-2 font-black text-fundo">BOT</span>}
              </p>
            </div>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-superficie-elevada" aria-label="Progresso da música">
              <div className="h-full bg-primaria" style={{ width: `${hud.progresso * 100}%` }} />
            </div>
            <Button variant="ghost" size="icon" onClick={() => controles.current.pausar()} aria-label="Pausar">
              <Pause />
            </Button>
          </header>

          {rede?.adversarios}

          {urlDoVideo && (
            <motion.div
              initial={{ opacity: 0, x: -32 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute top-20 left-6 w-[min(26vw,360px)] overflow-hidden rounded-2xl border border-borda"
            >
              <video ref={video} src={urlDoVideo} muted playsInline className="aspect-video w-full bg-fundo object-cover" />
            </motion.div>
          )}

          <div className="absolute bottom-10 left-8 flex flex-col gap-4">
            <motion.div
              key={hud.multiplicador}
              initial={{ scale: 1.5 }}
              animate={{ scale: 1 }}
              className="flex size-20 items-center justify-center rounded-full border-4 text-3xl font-black"
              style={{ borderColor: hud.estrelaAtiva ? "#38bdf8" : CORES_DO_MULTIPLICADOR[Math.min(3, hud.multiplicador - 1)] }}
            >
              {hud.multiplicador}x
            </motion.div>
            <div>
              <p aria-label="Pontos" className="font-mono text-4xl font-black tabular-nums">
                {hud.pontos.toLocaleString("pt-BR")}
              </p>
              <p className="text-base text-texto-suave">
                Sequência{" "}
                <span aria-label="Sequência" className="font-bold text-texto">
                  {hud.sequencia}
                </span>
              </p>
            </div>
          </div>

          <div className="absolute bottom-10 flex flex-col items-center" style={{ left: layout.centro + layout.largura / 2 + 24 }}>
            <Chibi personagem={personagem} tocando={hud.contagem === 0 && !derrota} bpm={musica.bpm || 120} pulso={hud.pulso} triste={hud.vida < 0.25} className="mb-2 h-44 w-auto" />
            <div className="flex items-end gap-4">
              <div className="flex flex-col items-center gap-2" aria-label="Star power">
                <Zap className={cn("size-5", hud.estrela >= 0.5 ? "text-[#38bdf8]" : "text-borda")} aria-hidden />
                <div className="relative h-40 w-4 overflow-hidden rounded-full bg-superficie-elevada">
                  <div className={cn("absolute bottom-0 w-full rounded-full bg-[#38bdf8] transition-all", hud.estrelaAtiva && "animate-pulse")} style={{ height: `${hud.estrela * 100}%` }} />
                  <div className="absolute bottom-1/2 h-px w-full bg-texto/60" />
                </div>
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-base font-bold text-texto-suave">ROCK</span>
                <MedidorDeVida vida={hud.vida} className="h-40 w-6" />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {hud.contagem > 0 && !pausado && (
              <motion.p
                key={hud.contagem}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="pointer-events-none absolute inset-0 flex items-center justify-center text-8xl font-black"
              >
                {hud.contagem}
              </motion.p>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {aviso && (
              <motion.p
                key={aviso.id}
                initial={{ y: 16, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -16, opacity: 0 }}
                transition={{ duration: 0.25 }}
                onAnimationComplete={() => setTimeout(() => setAviso((a) => (a?.id === aviso.id ? null : a)), 1200)}
                className={cn("pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 text-3xl font-black", aviso.estrela ? "text-[#38bdf8]" : "text-[#facc15]")}
              >
                {aviso.texto}
              </motion.p>
            )}
          </AnimatePresence>
        </>
      )}

      <AnimatePresence>
        {(pausado || derrota) && (
          <MenuDePausa
            derrota={derrota}
            emRede={emRede}
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
