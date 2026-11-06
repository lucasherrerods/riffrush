import type { Batida, Nota } from "@/modules/rock/songs";
import iniciarWasm, { initSync, janela_de_acerto, julgar as julgarNoMotor, MotorDaPartida, quantizar as quantizarNoMotor, velocidades } from "./wasm/motor";
import urlDoWasm from "./wasm/motor_bg.wasm?url";

/*
 * As regras da partida vivem no motor em Rust (backend/motor), compilado para WASM: é o mesmo código
 * que a API usa para rejulgar os replays, então o app e o servidor nunca dão resultados diferentes.
 * Aqui fica só um espelho do estado em objetos JS, que o desenho e o HUD leem a cada quadro, atualizado
 * depois de cada mudança com o que o motor diz que mudou.
 */

/** Carrega o motor. O app espera isso antes da primeira partida. */
export async function iniciarMotor() {
  await iniciarWasm({ module_or_path: urlDoWasm });
}

/** Para os testes, que já têm os bytes do .wasm na mão. */
export function iniciarMotorComBytes(bytes: BufferSource) {
  initSync({ module: bytes });
}

/** Até onde, em segundos de cada lado da batida, o toque ganha cada julgamento. A janela de acerto é de
 * 110 ms para cada lado; as faixas dentro dela são só o retorno na tela. O teste de paridade confere com o motor. */
export const JANELAS = { perfeito: 0.035, otimo: 0.07, bom: 0.11 } as const;
export type Julgamento = keyof typeof JANELAS;
/** Quanto cada julgamento vale no valor dos acertos. A precisão é de notas acertadas, como no Clone Hero. */
export const VALOR_DO_JULGAMENTO: Record<Julgamento, number> = { perfeito: 300, otimo: 200, bom: 100 };
export const JANELA_DE_ACERTO = JANELAS.bom;
export const PONTOS_POR_NOTA = 50;
const JULGAMENTOS: Julgamento[] = ["perfeito", "otimo", "bom"];

export const quantizar = (tempo: number) => quantizarNoMotor(tempo);
export const julgar = (distancia: number) => JULGAMENTOS[julgarNoMotor(distancia)];
/** O motor confere com o valor que ele usa de verdade. */
export const janelaDoMotor = () => janela_de_acerto();

export interface NotaEmJogo extends Nota {
  acertada: boolean;
  perdida: boolean;
  segurando: boolean;
  /** Sustain largado antes do fim. */
  solta: boolean;
  /** Até onde o sustain já rendeu pontos. */
  segurouAte: number;
}

export type Evento =
  | { tipo: "acerto"; nota: NotaEmJogo; julgamento: Julgamento }
  | { tipo: "erro"; nota: NotaEmJogo }
  | { tipo: "sequencia"; valor: number }
  | { tipo: "fraseCompleta" }
  | { tipo: "estrelaPronta" }
  | { tipo: "estrelaAtivada" }
  | { tipo: "derrota" }
  | { tipo: "virouFantasma" }
  /** Um toque que não acertou nada: zera a sequência e tira vida. Na palheta, `pista` é `null`. */
  | { tipo: "toqueEmVazio"; pista: number | null };

export interface Partida {
  notas: NotaEmJogo[];
  /** Índice da primeira nota que ainda importa; as anteriores já passaram. */
  primeira: number;
  tempo: number | null;
  pontos: number;
  sequencia: number;
  maiorSequencia: number;
  acertos: number;
  julgamentos: Record<Julgamento, number>;
  /** Soma do valor de cada acerto. */
  valorDosAcertos: number;
  /** Notas que passaram sem ser tocadas. */
  erros: number;
  vida: number;
  /** De 0 a 1, derivado de `estrelaEmCompassos`. */
  estrela: number;
  /** Quantos compassos de star power a barra guarda (a cheia guarda 8). */
  estrelaEmCompassos: number;
  /** Palhetadas e toques que não acertaram nada. Qualquer um tira o full combo. */
  toquesEmVazio: number;
  /** O bônus dos solos já fechados, que já está dentro de `pontos`. */
  bonusDeSolo: number;
  /** Todas as notas acertadas sem nenhum toque em vão. */
  fullCombo: boolean;
  estrelaAtiva: boolean;
  derrota: boolean;
  semFalha: boolean;
  /** A vida zerou em algum momento. Fica marcado até o fim, mesmo que a vida volte. */
  fantasma: boolean;
  frasesFalhas: Set<number>;
  eventos: Evento[];
  /** Onde as regras rodam. */
  motor: MotorDaPartida;
  /** Vêm no mesmo pacote do `sincronizar`: o HUD lê todo quadro sem chamar o WASM de novo. */
  multiplicadorAtual: number;
  precisaoAtual: number;
}

const ACERTADA = 1;
const PERDIDA = 2;
const SEGURANDO = 4;
const SOLTA = 8;
const EVENTOS_SEM_VALOR: Evento["tipo"][] = ["acerto", "erro", "sequencia", "fraseCompleta", "estrelaPronta", "estrelaAtivada", "derrota", "virouFantasma", "toqueEmVazio"];

/** As velocidades da música que o jogo oferece. Vêm do motor, que recusa qualquer outra. */
export const velocidadesDaMusica = () => [...velocidades()];

/**
 * Como as teclas viram notas. No tapping cada aperto vale uma nota; no gamepad soltar a tecla também acerta a
 * próxima nota da pista; a palhetada é a guitarra do Clone Hero: palheta, HOPO e tap só no traste, e âncora.
 * A posição na lista é o código que vai para o motor e para o replay.
 */
export const JEITOS_DE_JOGAR = ["gamepad", "tapping", "palhetada"] as const;
export type JeitoDeJogar = (typeof JEITOS_DE_JOGAR)[number];

const CODIGO_DO_TIPO = { hopo: 1, tap: 2 } as const;

/**
 * `velocidade` é a da música: as notas chegam no tempo da música e a partida roda no tempo real.
 * `semAberta`: a nota aberta vira verde, decidido no motor para o app e a API darem o mesmo resultado.
 * `batidas`: a grade da música; o sustain rende por batida e o star power dura em compassos, como no Clone Hero.
 */
export function criarPartida(
  notas: Nota[],
  { semFalha = false, fantasma = false, velocidade = 1, semAberta = false, jeito = "gamepad" as JeitoDeJogar, batidas = [] as Batida[] } = {},
): Partida {
  const motor = new MotorDaPartida(
    Float64Array.from(notas, (n) => n.tempo),
    Uint8Array.from(notas, (n) => n.pista),
    Int32Array.from(notas, (n) => n.frase),
    Float64Array.from(notas, (n) => n.duracao),
    Uint8Array.from(notas, (n) => (n.tipo ? CODIGO_DO_TIPO[n.tipo] : 0)),
    Int32Array.from(notas, (n) => n.solo ?? -1),
    Float64Array.from(batidas, (b) => b.tempo),
    Float64Array.from(batidas.filter((b) => b.forte), (b) => b.tempo),
    semFalha,
    fantasma,
    velocidade,
    semAberta,
    JEITOS_DE_JOGAR.indexOf(jeito),
  );
  const grade = motor.grade_das_notas();
  const partida: Partida = {
    notas: notas.map((n, i) => ({ ...n, tempo: grade[i * 3], duracao: grade[i * 3 + 1], pista: grade[i * 3 + 2], acertada: false, perdida: false, segurando: false, solta: false, segurouAte: grade[i * 3] })),
    primeira: 0,
    multiplicadorAtual: 1,
    precisaoAtual: 0,
    tempo: null,
    pontos: 0,
    sequencia: 0,
    maiorSequencia: 0,
    acertos: 0,
    julgamentos: { perfeito: 0, otimo: 0, bom: 0 },
    valorDosAcertos: 0,
    erros: 0,
    vida: 0.5,
    estrela: 0,
    estrelaEmCompassos: 0,
    toquesEmVazio: 0,
    bonusDeSolo: 0,
    fullCombo: false,
    estrelaAtiva: false,
    derrota: false,
    semFalha,
    fantasma: false,
    frasesFalhas: new Set(),
    eventos: [],
    motor,
  };
  sincronizar(partida);
  return partida;
}

/** Traz para o espelho o que mudou no motor. O formato está descrito em `sincronizar` do crate do WASM. */
function sincronizar(partida: Partida) {
  const d = partida.motor.sincronizar();
  let i = 0;
  const proximo = () => d[i++];
  const tempo = proximo();
  partida.tempo = Number.isNaN(tempo) ? null : tempo;
  partida.pontos = proximo();
  partida.sequencia = proximo();
  partida.maiorSequencia = proximo();
  partida.acertos = proximo();
  partida.julgamentos = { perfeito: proximo(), otimo: proximo(), bom: proximo() };
  partida.valorDosAcertos = proximo();
  partida.erros = proximo();
  partida.vida = proximo();
  partida.estrelaEmCompassos = proximo();
  partida.estrela = proximo();
  partida.estrelaAtiva = proximo() === 1;
  partida.derrota = proximo() === 1;
  partida.fantasma = proximo() === 1;
  partida.primeira = proximo();
  partida.multiplicadorAtual = proximo();
  partida.precisaoAtual = proximo();
  partida.toquesEmVazio = proximo();
  partida.bonusDeSolo = proximo();
  partida.fullCombo = proximo() === 1;
  for (let n = proximo(); n > 0; n--) {
    const nota = partida.notas[proximo()];
    const bandeiras = proximo();
    nota.acertada = (bandeiras & ACERTADA) !== 0;
    nota.perdida = (bandeiras & PERDIDA) !== 0;
    nota.segurando = (bandeiras & SEGURANDO) !== 0;
    nota.solta = (bandeiras & SOLTA) !== 0;
    nota.segurouAte = proximo();
  }
  for (let n = proximo(); n > 0; n--) {
    const tipo = EVENTOS_SEM_VALOR[proximo()];
    const a = proximo();
    const b = proximo();
    if (tipo === "acerto") partida.eventos.push({ tipo, nota: partida.notas[a], julgamento: JULGAMENTOS[b] });
    else if (tipo === "erro") partida.eventos.push({ tipo, nota: partida.notas[a] });
    else if (tipo === "sequencia") partida.eventos.push({ tipo, valor: a });
    else if (tipo === "toqueEmVazio") partida.eventos.push({ tipo, pista: a < 0 ? null : a });
    else partida.eventos.push({ tipo });
  }
  for (let n = proximo(); n > 0; n--) partida.frasesFalhas.add(proximo());
}

/** Eventos acumulados desde a última chamada (para tocar sons e mostrar avisos). */
export function retirarEventos(partida: Partida) {
  return partida.eventos.splice(0);
}

export const multiplicador = (partida: Partida) => partida.multiplicadorAtual;

/** Notas acertadas sobre as que já passaram (0 a 1), como a porcentagem do Clone Hero. No fim da música, vale para o chart inteiro. */
export const precisao = (partida: Partida) => partida.precisaoAtual;

/** Marca a nota como acertada no instante `tempo`, sem olhar a janela de acerto (o bot usa). */
export function acertar(partida: Partida, nota: NotaEmJogo, tempo: number) {
  partida.motor.acertar(partida.notas.indexOf(nota), tempo);
  sincronizar(partida);
}

/** Apertou a tecla da pista no instante `tempo` da música. Devolve se acertou alguma nota. */
export function tocar(partida: Partida, pista: number, tempo: number) {
  const acertou = partida.motor.tocar(pista, tempo);
  sincronizar(partida);
  return acertou;
}

/**
 * Soltou a tecla da pista: larga o sustain que estava sendo segurado nela e, se o aperto
 * acertou, a soltura acerta a próxima nota da pista (facilita trechos de notas rápidas).
 */
export function soltar(partida: Partida, pista: number, tempo: number) {
  partida.motor.soltar(pista, tempo);
  sincronizar(partida);
}

/** Na palhetada, toca o acorde dos trastes apertados. Devolve se acertou. */
export function palhetar(partida: Partida, tempo: number) {
  const acertou = partida.motor.palhetar(tempo);
  sincronizar(partida);
  return acertou;
}

export function ativarEstrela(partida: Partida) {
  const ativou = partida.motor.ativar_estrela();
  sincronizar(partida);
  return ativou;
}

/** Avança a partida até `tempo`: notas perdidas, sustains e a barra de star power. */
export function avancar(partida: Partida, tempo: number) {
  partida.motor.avancar(tempo);
  sincronizar(partida);
}
