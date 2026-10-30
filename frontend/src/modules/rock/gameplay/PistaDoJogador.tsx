import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronsUp } from "lucide-react";
import { PALHETA_DO_CONTROLE, veioDoControle } from "@/modules/gamepad";
import { tocarEfeito } from "@/modules/audio";
import { Avatar, novaReacao, type Personagem, type Reacao } from "@/modules/rock/character";
import { opacidadeDaPista, type EstadoDoPalco } from "@/modules/rock/stage";
import { PISTA_ABERTA, type Dificuldade, type Instrumento, type Musica, type MusicaCarregada } from "@/modules/rock/songs";
import { ehTelaEstreita } from "@/shared/hooks/useTelaEstreita";
import { cn } from "@/shared/lib/utils";
import { criarBot, jogarSozinho } from "./bot";
import { AvisoDeAcerto } from "./componentes/AvisoDeAcerto";
import { BarraDeEstrelas } from "./componentes/BarraDeEstrelas";
import { MedidorCompacto } from "./componentes/MedidorCompacto";
import { MedidorDeRock } from "./componentes/MedidorDeRock";
import { NumeroDaContagem } from "./componentes/NumeroDaContagem";
import { PainelDePontos } from "./componentes/PainelDePontos";
import { NOMES_DAS_PISTAS } from "./cores";
import { progressoDasEstrelas } from "./estrelas";
import { useLoja, type LojaDoHud } from "./lojaDoHud";
import { avancar, criarPartida, multiplicador, precisao, retirarEventos, type Julgamento } from "./partida";
import { desenharPista, type Cena } from "./pista/desenhar";
import { forcaDoTrovao } from "./pista/efeitos";
import type { layoutDaPista } from "./pista/geometria";
import { criarSprites } from "./pista/sprites";
import type { EstadoDoJogador } from "./rede";
import { aplicarEntradas, criarGravador, empacotarReplay, hashDoChart, partidaNoInstante, type EventoDaTransmissao, type Replay } from "./replay";
import { resultadoDaPartida, type Resultado } from "./resultado";
import type { OpcoesDaPartida } from "./TelaDeJogo";
import { noTempoReal } from "./velocidade";

export interface Hud {
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

export const HUD_INICIAL: Hud = { pontos: 0, sequencia: 0, multiplicador: 1, vida: 0.5, estrela: 0, estrelaAtiva: false, progresso: 0, precisao: 1, contagem: 3, pulso: 0, estrelas: 0, estrelasDoRecorde: 0, reacao: null, fantasma: false, julgamento: null };

/** O relógio da música, de quem toca o áudio: todas as pistas leem o mesmo. */
export interface RelogioDaPartida {
  /** Segundos da música agora; negativo durante a contagem. */
  agora: () => number;
  /** Segundos da música no instante em que o evento aconteceu. */
  doEvento: (evento: Event) => number;
  /** Pausado ou contando para voltar: a pista não aceita toques. */
  pausado: () => boolean;
}

/** Como a pista termina: na derrota a tela abre o menu; senão, entrega o resultado. */
export type FimDoJogador = { derrota: true } | { derrota: false; resultado: Resultado; gerarReplay?: () => Promise<Uint8Array> };

/** O que a tela pede à pista de fora do loop. */
export interface ControleDoJogador {
  estrela: () => void;
  /** Encerra a partida como derrota e devolve o resultado até aqui. */
  desistir: () => Resultado;
  /** Só no replay gravado: refaz a partida no instante dado (em segundos da música). */
  refazerEm: (tempo: number) => void;
  /** Avisa quem assiste ao vivo que a música parou ou voltou. */
  transmitirPausa: (pausado: boolean) => void;
}

const nada = () => {};
export const CONTROLE_VAZIO: ControleDoJogador = { estrela: nada, desistir: () => ({}) as Resultado, refazerEm: nada, transmitirPausa: nada };

/** Ao vivo, as entradas vão em lotes: um por segundo poupa a cota do relay e chega bem antes de quem assiste precisar. */
const INTERVALO_DO_LOTE_MS = 1000;
const MAXIMO_DE_EXPLOSOES = 20;
const MAXIMO_DE_TROVOES = 4;
/** Altura da faixa de toque da nota aberta, no pé da tela. */
const ALTURA_DA_FAIXA_ABERTA = 64;
const INTERVALO_DO_ENVIO_MS = 125;
/** Em telas mais estreitas os painéis encostam na pista em vez de sair da tela. */
const LARGURA_DO_PAINEL = 250;
const LARGURA_DO_HUD_LATERAL = 320;
const MARGEM_DO_HUD = 16;

interface Props {
  /** Muda sempre que a tela recomeça a música: a partida recomeça junto. */
  sessao: object;
  carregada: MusicaCarregada;
  musica: Musica;
  dificuldade: Dificuldade;
  instrumento: Instrumento;
  opcoes: OpcoesDaPartida;
  velocidade: number;
  /** Segundos de abertura antes da música, para o palco e a pista. */
  entrada: number;
  relogio: RelogioDaPartida;
  controle: MutableRefObject<ControleDoJogador>;
  loja: LojaDoHud<Hud>;
  layout: ReturnType<typeof layoutDaPista>;
  estreita: boolean;
  comPalco: boolean;
  /** Sem ele, o HUD não mostra o personagem. */
  personagemDoHud: Personagem | null;
  personagem: Personagem;
  estadoDoPalco: MutableRefObject<EstadoDoPalco>;
  pausado: boolean;
  derrota: boolean;
  recorde?: number;
  replay?: Replay;
  /** Em rede: quem zera a vida vira fantasma e o estado vai para a sala. */
  emRede: boolean;
  aoAtualizarRede?: (estado: EstadoDoJogador) => void;
  transmissao?: (evento: EventoDaTransmissao) => void;
  aoFim: (fim: FimDoJogador) => void;
}

/** A pista e o HUD de um jogador, com a própria partida. O áudio e o relógio vêm de fora, da tela. */
export function PistaDoJogador(props: Props) {
  const { sessao, carregada, opcoes, velocidade, entrada, relogio, controle, loja, layout, estreita, comPalco, personagemDoHud, pausado, derrota, replay, emRede } = props;
  // Lidos no loop: trocar a função ou o recorde a cada render não pode reiniciar a partida.
  const atuais = useRef(props);
  atuais.current = props;
  const canvas = useRef<HTMLCanvasElement>(null);
  // A faixa de toque acende enquanto o dedo segura o traste; muda direto no DOM para não re-renderizar a tela a cada toque.
  const faixas = useRef<(HTMLSpanElement | null)[]>([]);
  const marcarFaixa = (pista: number, apertada: boolean) => faixas.current[pista]?.toggleAttribute("data-apertada", apertada);
  const toques = useRef<{ apertar: (pista: number, evento: Event) => void; largar: (pista: number) => void }>({ apertar: nada, largar: nada });
  const temAberta = useMemo(() => carregada.notas.some((n) => n.pista === PISTA_ABERTA), [carregada]);
  const [aviso, setAviso] = useState<{ id: number; texto: string; estrela: boolean } | null>(null);

  useEffect(() => {
    const { musica, dificuldade, instrumento } = atuais.current;
    const duracao = noTempoReal(carregada.duracao, velocidade);
    const batidas = carregada.batidas.map((b) => ({ ...b, tempo: noTempoReal(b.tempo, velocidade) }));
    const opcoesDoReplay = replay && { semFalha: replay.semFalha, fantasma: replay.fantasma, semAberta: replay.semAberta, velocidade, jeito: replay.jeito, puneToqueEmVazio: replay.puneToqueEmVazio };
    let partida = opcoesDoReplay
      ? criarPartida(carregada.notas, opcoesDoReplay)
      : criarPartida(carregada.notas, { semFalha: opcoes.semFalha, fantasma: emRede, semAberta: opcoes.semAberta, velocidade, jeito: opcoes.jeitoDeJogar });
    const bot = opcoes.bot && !replay ? criarBot() : null;
    const gravador = criarGravador(partida);
    let proximaEntrada = 0;
    // Os lotes só saem depois do início: o relay apaga o que tinha quando chega um início novo.
    let transmitindo = false;
    let entradasEnviadas = 0;
    let ultimoLote = 0;
    let transmissaoAcabou = false;
    const transmitir = (evento: EventoDaTransmissao) => transmitindo && !transmissaoAcabou && atuais.current.transmissao?.(evento);
    const encerrarTransmissao = () => {
      // O que foi tocado depois do último lote vai antes do fim, para quem assiste ver o final inteiro.
      if (gravador.entradas.length > entradasEnviadas) {
        transmitir({ tipo: "lote", entradas: gravador.entradas.slice(entradasEnviadas), ate: partida.tempo ?? 0 });
        entradasEnviadas = gravador.entradas.length;
      }
      transmitir({ tipo: "fim" });
      transmissaoAcabou = true;
    };
    if (atuais.current.transmissao && !replay && !bot) {
      void hashDoChart(carregada.notas).then((hash) => {
        if (transmissaoAcabou) return;
        transmitindo = true;
        transmitir({ tipo: "inicio", hashDoChart: hash, semFalha: opcoes.semFalha, semAberta: opcoes.semAberta, velocidade, jeito: opcoes.jeitoDeJogar, puneToqueEmVazio: true });
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
    let terminou = false;
    let quadro = 0;
    // Com o bot o recorde não vale, então também não tem festa.
    let recordeBatido = opcoes.bot || !!replay;
    let idDoAviso = 0;
    let ultimoEnvio = 0;
    const publicar = (terminouAgora: boolean) =>
      atuais.current.aoAtualizarRede?.({
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
      if (partida.derrota) return atuais.current.aoFim({ derrota: true });
      const resultado = resultadoDaPartida(partida, musica.id, dificuldade, instrumento);
      // Fantasma também manda: a API rejulga o replay das músicas do Encore para dar o XP, e deixa o fantasma fora do ranking.
      const tocouDeVerdade = !bot && !replay;
      const gerarReplay = async () =>
        empacotarReplay({
          semFalha: opcoes.semFalha,
          fantasma: emRede,
          semAberta: opcoes.semAberta,
          velocidade,
          jeito: opcoes.jeitoDeJogar,
          puneToqueEmVazio: true,
          hashDoChart: await hashDoChart(carregada.notas),
          entradas: gravador.entradas,
        });
      atuais.current.aoFim({ derrota: false, resultado, gerarReplay: tocouDeVerdade ? gerarReplay : undefined });
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
          avisar(ehTelaEstreita() ? "Star power!" : `Star Power pronto! [${opcoes.rotuloDaTeclaDaEstrela}]`, true);
        } else if (evento.tipo === "estrelaAtivada") {
          estrelaDesde = tempo;
          reagir("nitro");
          tocarEfeito("estrela", opcoes.volumeDosEfeitos);
          avisar("STAR POWER!", true);
        } else if (evento.tipo === "derrota") {
          reagir("derrota");
          terminar();
        } else if (evento.tipo === "toqueEmVazio") {
          // Pune como erro, mas sem o "ERRO" na pista: não havia nota ali para errar.
          reagir("errou");
          tocarEfeito("erro", opcoes.volumeDosEfeitos);
        } else if (evento.tipo === "virouFantasma") {
          tocarEfeito("erro", opcoes.volumeDosEfeitos);
          avisar("Virou fantasma! Acerte as notas para voltar.");
        }
      }
    };

    const estrela = () => !replay && gravador.ativarEstrela();
    const desistir = () => {
      partida.derrota = true;
      terminou = true;
      encerrarTransmissao();
      publicar(true);
      return resultadoDaPartida(partida, musica.id, dificuldade, instrumento);
    };
    const refazerEm = (alvo: number) => {
      if (!replay || !opcoesDoReplay) return;
      const refeita = partidaNoInstante(carregada.notas, opcoesDoReplay, replay.entradas, alvo);
      partida.motor.free();
      partida = refeita.partida;
      proximaEntrada = refeita.proximaEntrada;
      refeita.apertados.forEach((apertado, i) => (apertados[i] = apertado));
      explosoes.length = falhas.length = trovoes.length = 0;
      julgamento = null;
      estrelaDesde = partida.estrelaAtiva ? alvo : null;
    };
    const transmitirPausa = (pausado: boolean) => transmitir({ tipo: "pausa", pausado });
    Object.assign(controle.current, { estrela, desistir, refazerEm, transmitirPausa });

    /** Teclado e toque apertam do mesmo jeito: o instante vem do próprio evento. */
    const apertar = (pista: number, evento: Event) => {
      if (relogio.pausado() || terminou || replay) return;
      apertados[pista] = true;
      const tempo = relogio.doEvento(evento);
      gravador.tocar(pista, tempo);
      tratarEventos(tempo);
    };
    const largar = (pista: number) => {
      if (replay) return;
      apertados[pista] = false;
      gravador.soltar(pista, relogio.agora());
    };
    const palhetar = (evento: Event) => {
      if (relogio.pausado() || terminou || replay) return;
      const tempo = relogio.doEvento(evento);
      gravador.palhetar(tempo);
      tratarEventos(tempo);
    };
    /** O A do controle também manda Enter (confirma na pausa): só o direcional palheta pelo controle. */
    const ehPalheta = (evento: KeyboardEvent) =>
      opcoes.jeitoDeJogar === "palhetada" && (evento.code === PALHETA_DO_CONTROLE || (evento.code === opcoes.teclaDaPalheta && !veioDoControle(evento)));
    toques.current = { apertar, largar };

    // O Esc e as setas do replay são da tela; aqui ficam só as teclas que tocam.
    const aoApertar = (evento: KeyboardEvent) => {
      if (evento.code === "Escape" || relogio.pausado() || terminou) return;
      const pista = opcoes.teclas.indexOf(evento.code);
      if (ehPalheta(evento)) {
        evento.preventDefault();
        if (!evento.repeat) palhetar(evento);
      } else if (pista >= 0) {
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

    const desenhar = () => {
      quadro = requestAnimationFrame(desenhar);
      const tempo = relogio.agora();

      if (!relogio.pausado() && !terminou) {
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

      atuais.current.estadoDoPalco.current = {
        personagem: atuais.current.personagem,
        tocando: tempo >= 0 && !partida.derrota,
        bpm: (musica.bpm || 120) * velocidade,
        pulso: partida.acertos,
        triste: partida.vida < 0.25,
        tempo,
        entrada,
        estrelaAtiva: partida.estrelaAtiva,
        desdeTrovao: tempo - ultimoTrovao,
        reacao,
      };

      const elemento = canvas.current;
      // Com palco, a pista some na abertura para a cena dominar e volta até a música começar.
      if (elemento) elemento.style.opacity = atuais.current.comPalco ? String(opacidadeDaPista(tempo, entrada)) : "1";
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
      const recorde = atuais.current.recorde;
      if (!recordeBatido && recorde && partida.pontos > recorde) {
        recordeBatido = true;
        avisar("RECORDE BATIDO!", true);
      }

      loja.definir({
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
        estrelasDoRecorde: progressoDasEstrelas(recorde ?? 0, carregada.notas.length),
        reacao,
        julgamento,
      });
    };
    quadro = requestAnimationFrame(desenhar);

    return () => {
      encerrarTransmissao();
      cancelAnimationFrame(quadro);
      observador?.disconnect();
      window.removeEventListener("keydown", aoApertar);
      window.removeEventListener("keyup", aoSoltar);
    };
    // A sessão já muda com tudo que reinicia a partida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao]);

  return (
    <>
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      {/* Vinheta: as bordas escurecem e a luz fica no braço, como num palco. */}
      <div
        data-parte="vinheta"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 70%, transparent 35%, color-mix(in srgb, var(--cor-fundo) 85%, transparent) 100%)" }}
      />

      {/* Áreas de toque: uma embaixo de cada traste (funcionam com o mouse também). */}
      <div
        className="absolute flex"
        style={{
          left: estreita ? 0 : layout.centro - layout.largura / 2,
          width: estreita ? "100%" : layout.largura,
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
              toques.current.apertar(pista, e.nativeEvent);
              marcarFaixa(pista, true);
            }}
            onPointerUp={() => {
              toques.current.largar(pista);
              marcarFaixa(pista, false);
            }}
            onPointerCancel={() => {
              toques.current.largar(pista);
              marcarFaixa(pista, false);
            }}
          >
            {opcoes.rotulosDosTrastes && (
              <span className="mb-2 rounded-sm bg-superficie-elevada px-2 font-titulo text-lg tracking-wide text-texto-suave">{opcoes.rotulosDosTrastes[pista]}</span>
            )}
          </div>
        ))}
      </div>

      {/* No celular, faixas como teclas de piano marcam, logo abaixo dos trastes, onde o dedo pode tocar. */}
      {estreita && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 flex border-t border-texto/40"
          style={{
            top: layout.linhaDeBatida + layout.larguraDoTraste * 0.45,
            bottom: temAberta ? ALTURA_DA_FAIXA_ABERTA : 0,
          }}
        >
          {NOMES_DAS_PISTAS.map((nome, pista) => (
            <span
              key={nome}
              ref={(elemento) => {
                faixas.current[pista] = elemento;
              }}
              data-parte="alvo-do-toque"
              className="flex-1 border-r border-texto/40 bg-texto/5 transition-colors duration-75 last:border-r-0 data-[apertada]:bg-texto/25"
            />
          ))}
        </div>
      )}

      {/* A nota aberta não tem traste: no toque, ela tem uma faixa própria no pé da tela. */}
      {temAberta && (
        <div
          role="button"
          aria-label="Nota aberta"
          className="absolute bottom-0 flex items-center justify-center border-t border-borda bg-superficie/60"
          style={{ left: layout.centro - layout.largura / 2, width: layout.largura, height: ALTURA_DA_FAIXA_ABERTA }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture?.(e.pointerId);
            toques.current.apertar(PISTA_ABERTA, e.nativeEvent);
          }}
          onPointerUp={() => toques.current.largar(PISTA_ABERTA)}
          onPointerCancel={() => toques.current.largar(PISTA_ABERTA)}
        >
          <span className="font-titulo text-lg tracking-wide text-texto-suave">
            Aberta{opcoes.rotulosDosTrastes && ` · ${opcoes.rotulosDosTrastes[PISTA_ABERTA]}`}
          </span>
        </div>
      )}

      <HudDaPartida loja={loja} layout={layout} estreita={estreita} comPalco={comPalco} pausado={pausado} derrota={derrota} personagem={personagemDoHud} bpm={(props.musica.bpm || 120) * velocidade} aoEstrela={() => controle.current.estrela()} />

      <AnimatePresence>
        {aviso && (
          <motion.p
            key={aviso.id}
            initial={{ y: 16, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: 0.25 }}
            onAnimationComplete={() => setTimeout(() => setAviso((a) => (a?.id === aviso.id ? null : a)), 1200)}
            className={cn("pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 texto-aviso-da-partida font-black", aviso.estrela ? "text-estrela" : "text-ouro")}
          >
            {aviso.texto}
          </motion.p>
        )}
      </AnimatePresence>
    </>
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
        data-parte={estreita ? "hud-compacto" : undefined}
        className={cn("absolute", estreita ? "top-12 right-3 left-3" : "bottom-10 -translate-x-full")}
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
          lateral={
            estreita && (
              <div className="flex items-start gap-2">
                {avatarDoJogador("h-14 w-auto")}
                {/* Os pinos do star power e a barra de vida: tocar neles ativa o star power. */}
                <button aria-label={`Ativar star power (${Math.round(hud.estrela * 100)}%)`} onClick={aoEstrela} className="-mr-2 flex w-32 flex-col items-center">
                  <MedidorCompacto vida={hud.vida} estrela={hud.estrela} estrelaAtiva={hud.estrelaAtiva} className="w-full" />
                  {/* Com o star power pronto, a seta lembra que arrastar para cima o solta. */}
                  {hud.estrela >= 0.5 && !hud.estrelaAtiva && (
                    <ChevronsUp data-parte="seta-do-star-power" aria-label="Arraste para cima para soltar o star power" className="mt-6 size-10 animate-bounce text-estrela" />
                  )}
                </button>
              </div>
            )
          }
        />
      </div>

      {!estreita && (
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
