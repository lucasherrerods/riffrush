import type { Nota } from "@/modules/songs";

/** Até onde, em segundos de cada lado da batida, o toque ganha cada julgamento. */
export const JANELAS = { perfeito: 0.035, otimo: 0.07, bom: 0.11 } as const;
export type Julgamento = keyof typeof JANELAS;
/** Quanto cada julgamento vale na precisão, como no osu!. A nota perdida vale zero. */
export const VALOR_DO_JULGAMENTO: Record<Julgamento, number> = { perfeito: 300, otimo: 100, bom: 50 };
export const JANELA_DE_ACERTO = JANELAS.bom;
const VIDA_INICIAL = 0.5;
const VIDA_POR_ACERTO = 0.02;
const VIDA_POR_ERRO = 0.03;
export const PONTOS_POR_NOTA = 50;
const PONTOS_POR_SEGUNDO_DE_SUSTAIN = 40;
const AVISO_DE_SEQUENCIA = 50;
const ESTRELA_POR_FRASE = 0.25;
const ESTRELA_MINIMA = 0.5;
/** Segundos que a barra de star power cheia dura ativada. */
const DURACAO_DA_ESTRELA = 16;
/** Soltar o sustain até esse tempo antes do fim ainda conta como completo. */
const TOLERANCIA_DO_SUSTAIN = 0.1;
/**
 * Todo tempo que entra na partida é arredondado para esta grade (1 ms, como no osu!). Com sustain e
 * star power contados em ticks inteiros, a partida dá o mesmo resultado em qualquer taxa
 * de frames, e um replay com os mesmos tempos reproduz a pontuação exata.
 */
const TICKS_POR_SEGUNDO = 1000;
const ESTRELA_CHEIA = DURACAO_DA_ESTRELA * TICKS_POR_SEGUNDO;

export const quantizar = (tempo: number) => Math.round(tempo * TICKS_POR_SEGUNDO) / TICKS_POR_SEGUNDO;
const ticksEntre = (de: number, ate: number) => Math.round((ate - de) * TICKS_POR_SEGUNDO);

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
  | { tipo: "virouFantasma" };

export interface Partida {
  notas: NotaEmJogo[];
  /** Índice da primeira nota que ainda importa; as anteriores já passaram. */
  primeira: number;
  tempo: number | null;
  /** Derivado de `pontosDasNotas` e `sustainPonderado`. */
  pontos: number;
  pontosDasNotas: number;
  /** Ticks de sustain segurados, cada um vezes o multiplicador da hora. */
  sustainPonderado: number;
  sequencia: number;
  maiorSequencia: number;
  acertos: number;
  julgamentos: Record<Julgamento, number>;
  /** Soma do valor de cada acerto, para a precisão. */
  valorDosAcertos: number;
  /** Notas que passaram sem ser tocadas. */
  erros: number;
  vida: number;
  /** De 0 a 1, derivado de `estrelaEmTicks`. */
  estrela: number;
  /** Quantos ticks de star power ativado a barra ainda rende. */
  estrelaEmTicks: number;
  estrelaAtiva: boolean;
  derrota: boolean;
  semFalha: boolean;
  /** Multijogador: a vida zerada não tira da música, só deixa a marca de fantasma. */
  modoFantasma: boolean;
  /** A vida zerou em algum momento. Fica marcado até o fim, mesmo que a vida volte. */
  fantasma: boolean;
  tamanhoDasFrases: Map<number, number>;
  acertosPorFrase: Map<number, number>;
  frasesFalhas: Set<number>;
  /** Pistas cujo último aperto acertou uma nota: soltar a tecla pode acertar mais uma. */
  armadas: Set<number>;
  eventos: Evento[];
}

export function criarPartida(notas: Nota[], { semFalha = false, fantasma = false } = {}): Partida {
  const tamanhoDasFrases = new Map<number, number>();
  for (const nota of notas) if (nota.frase >= 0) tamanhoDasFrases.set(nota.frase, (tamanhoDasFrases.get(nota.frase) ?? 0) + 1);
  return {
    notas: notas.map((n) => {
      const tempo = quantizar(n.tempo);
      return { ...n, tempo, duracao: quantizar(n.tempo + n.duracao) - tempo, acertada: false, perdida: false, segurando: false, solta: false, segurouAte: tempo };
    }),
    primeira: 0,
    tempo: null,
    pontos: 0,
    pontosDasNotas: 0,
    sustainPonderado: 0,
    sequencia: 0,
    maiorSequencia: 0,
    acertos: 0,
    julgamentos: { perfeito: 0, otimo: 0, bom: 0 },
    valorDosAcertos: 0,
    erros: 0,
    vida: VIDA_INICIAL,
    estrela: 0,
    estrelaEmTicks: 0,
    estrelaAtiva: false,
    derrota: false,
    semFalha,
    modoFantasma: fantasma,
    fantasma: false,
    tamanhoDasFrases,
    acertosPorFrase: new Map(),
    frasesFalhas: new Set(),
    armadas: new Set(),
    eventos: [],
  };
}

/** Eventos acumulados desde a última chamada (para tocar sons e mostrar avisos). */
export function retirarEventos(partida: Partida) {
  return partida.eventos.splice(0);
}

export function multiplicador(partida: Partida) {
  return Math.min(4, 1 + Math.floor(partida.sequencia / 10)) * (partida.estrelaAtiva ? 2 : 1);
}

/** O julgamento de um toque a `distancia` segundos da batida, para qualquer lado. Compara em ticks, sem erro de ponto flutuante. */
export function julgar(distancia: number): Julgamento {
  const ticks = Math.abs(Math.round(distancia * TICKS_POR_SEGUNDO));
  if (ticks <= JANELAS.perfeito * TICKS_POR_SEGUNDO) return "perfeito";
  return ticks <= JANELAS.otimo * TICKS_POR_SEGUNDO ? "otimo" : "bom";
}

/** Valor dos acertos sobre o máximo das notas que já passaram (0 a 1). No fim da música, vale para o chart inteiro. */
export function precisao(partida: Partida) {
  const tocadas = partida.acertos + partida.erros;
  return tocadas ? partida.valorDosAcertos / (tocadas * VALOR_DO_JULGAMENTO.perfeito) : 1;
}

function contarFrase(partida: Partida, nota: NotaEmJogo) {
  if (nota.frase < 0 || partida.frasesFalhas.has(nota.frase)) return;
  const acertos = (partida.acertosPorFrase.get(nota.frase) ?? 0) + 1;
  partida.acertosPorFrase.set(nota.frase, acertos);
  if (acertos < partida.tamanhoDasFrases.get(nota.frase)!) return;
  const antes = partida.estrela;
  definirEstrela(partida, Math.min(ESTRELA_CHEIA, partida.estrelaEmTicks + ESTRELA_POR_FRASE * ESTRELA_CHEIA));
  partida.eventos.push({ tipo: "fraseCompleta" });
  if (!partida.estrelaAtiva && antes < ESTRELA_MINIMA && partida.estrela >= ESTRELA_MINIMA) partida.eventos.push({ tipo: "estrelaPronta" });
}

/** Marca a nota como acertada e aplica pontos, vida, sequência e star power. */
export function acertar(partida: Partida, nota: NotaEmJogo, tempo: number) {
  nota.acertada = true;
  nota.segurando = nota.duracao > 0;
  nota.segurouAte = Math.max(nota.tempo, tempo);
  const julgamento = julgar(tempo - nota.tempo);
  partida.acertos++;
  partida.julgamentos[julgamento]++;
  partida.valorDosAcertos += VALOR_DO_JULGAMENTO[julgamento];
  partida.sequencia++;
  partida.maiorSequencia = Math.max(partida.maiorSequencia, partida.sequencia);
  partida.pontosDasNotas += PONTOS_POR_NOTA * multiplicador(partida);
  atualizarPontos(partida);
  partida.vida = Math.min(1, partida.vida + VIDA_POR_ACERTO);
  partida.eventos.push({ tipo: "acerto", nota, julgamento });
  if (partida.sequencia % AVISO_DE_SEQUENCIA === 0) partida.eventos.push({ tipo: "sequencia", valor: partida.sequencia });
  contarFrase(partida, nota);
}

function errar(partida: Partida, nota: NotaEmJogo) {
  nota.perdida = true;
  partida.erros++;
  partida.sequencia = 0;
  partida.vida = Math.max(0, partida.vida - VIDA_POR_ERRO);
  if (nota.frase >= 0) partida.frasesFalhas.add(nota.frase);
  partida.eventos.push({ tipo: "erro", nota });
  if (partida.vida > 0 || partida.semFalha) return;
  if (!partida.modoFantasma) {
    partida.derrota = true;
    partida.eventos.push({ tipo: "derrota" });
  } else if (!partida.fantasma) {
    partida.fantasma = true;
    partida.eventos.push({ tipo: "virouFantasma" });
  }
}

function atualizarPontos(partida: Partida) {
  partida.pontos = partida.pontosDasNotas + (partida.sustainPonderado * PONTOS_POR_SEGUNDO_DE_SUSTAIN) / TICKS_POR_SEGUNDO;
}

function definirEstrela(partida: Partida, ticks: number) {
  partida.estrelaEmTicks = ticks;
  partida.estrela = ticks / ESTRELA_CHEIA;
}

function pontuarSustain(partida: Partida, nota: NotaEmJogo, tempo: number) {
  const ate = Math.min(tempo, nota.tempo + nota.duracao);
  const ticks = ticksEntre(nota.segurouAte, ate);
  if (ticks <= 0) return;
  partida.sustainPonderado += ticks * multiplicador(partida);
  atualizarPontos(partida);
  nota.segurouAte = ate;
}

/** Apertou a tecla da pista no instante `tempo` da música. Devolve se acertou alguma nota. */
export function tocar(partida: Partida, pista: number, tempo: number) {
  tempo = trazerAte(partida, tempo);
  if (partida.derrota) return false;
  if (!acertarMaisProxima(partida, pista, tempo)) {
    partida.armadas.delete(pista);
    return false;
  }
  partida.armadas.add(pista);
  return true;
}

function acertarMaisProxima(partida: Partida, pista: number, tempo: number) {
  let melhor: NotaEmJogo | undefined;
  let menorDistancia: number = JANELA_DE_ACERTO;
  for (let i = partida.primeira; i < partida.notas.length && partida.notas[i].tempo < tempo + JANELA_DE_ACERTO; i++) {
    const nota = partida.notas[i];
    if (nota.acertada || nota.perdida || nota.pista !== pista) continue;
    const distancia = Math.abs(nota.tempo - tempo);
    if (distancia <= menorDistancia) {
      melhor = nota;
      menorDistancia = distancia;
    }
  }
  if (!melhor) return false;
  acertar(partida, melhor, tempo);
  return true;
}

/**
 * Soltou a tecla da pista: larga o sustain que estava sendo segurado nela e, se o aperto
 * acertou, a soltura acerta a próxima nota da pista (facilita trechos de notas rápidas).
 */
export function soltar(partida: Partida, pista: number, tempo: number) {
  tempo = trazerAte(partida, tempo);
  const armada = partida.armadas.delete(pista);
  let largouCedo = false;
  for (let i = partida.primeira; i < partida.notas.length && partida.notas[i].tempo <= tempo; i++) {
    const nota = partida.notas[i];
    if (!nota.segurando || nota.pista !== pista) continue;
    nota.segurando = false;
    if (tempo < nota.tempo + nota.duracao - TOLERANCIA_DO_SUSTAIN) nota.solta = largouCedo = true;
  }
  if (armada && !largouCedo && !partida.derrota) acertarMaisProxima(partida, pista, tempo);
}

export function ativarEstrela(partida: Partida) {
  if (partida.estrelaAtiva || partida.estrelaEmTicks < ESTRELA_MINIMA * ESTRELA_CHEIA || partida.derrota) return false;
  partida.estrelaAtiva = true;
  partida.eventos.push({ tipo: "estrelaAtivada" });
  return true;
}

/** Avança a partida até o tempo da entrada; ela nunca volta para antes do que já passou. */
function trazerAte(partida: Partida, tempo: number) {
  const ate = Math.max(quantizar(tempo), partida.tempo ?? -Infinity);
  avancar(partida, ate);
  return ate;
}

/** Leva sustains e star power de `partida.tempo` até `tempo`, sem nada mudando no meio. */
function assentar(partida: Partida, tempo: number) {
  const ticks = partida.tempo === null ? 0 : ticksEntre(partida.tempo, tempo);
  for (let i = partida.primeira; i < partida.notas.length && partida.notas[i].tempo <= tempo; i++) {
    const nota = partida.notas[i];
    if (!nota.segurando) continue;
    pontuarSustain(partida, nota, tempo);
    if (tempo >= nota.tempo + nota.duracao) nota.segurando = false;
  }
  if (partida.estrelaAtiva && ticks > 0) definirEstrela(partida, Math.max(0, partida.estrelaEmTicks - ticks));
  partida.tempo = tempo;
}

/** O próximo acontecimento que muda o multiplicador até `tempo`: uma nota perdida ou o fim do star power. */
function proximoAcontecimento(partida: Partida, tempo: number) {
  let perdida: NotaEmJogo | undefined;
  for (let i = partida.primeira; i < partida.notas.length && partida.notas[i].tempo < tempo; i++) {
    const nota = partida.notas[i];
    if (!nota.acertada && !nota.perdida) {
      perdida = nota;
      break;
    }
  }
  const prazo = perdida ? quantizar(perdida.tempo + JANELA_DE_ACERTO) : Infinity;
  const fimDaEstrela = partida.estrelaAtiva && partida.tempo !== null ? quantizar(partida.tempo + partida.estrelaEmTicks / TICKS_POR_SEGUNDO) : Infinity;
  if (perdida && prazo < tempo && prazo <= fimDaEstrela) return { tempo: prazo, nota: perdida };
  if (fimDaEstrela <= tempo) return { tempo: fimDaEstrela };
  return null;
}

/**
 * Avança a partida até `tempo`: notas perdidas, sustains e a barra de star power.
 * Cada acontecimento é aplicado no seu próprio tempo, então o resultado não depende dos frames.
 */
export function avancar(partida: Partida, tempo: number) {
  if (partida.derrota) return;
  tempo = Math.max(quantizar(tempo), partida.tempo ?? -Infinity);

  for (let proximo = proximoAcontecimento(partida, tempo); proximo; proximo = proximoAcontecimento(partida, tempo)) {
    assentar(partida, Math.max(proximo.tempo, partida.tempo ?? proximo.tempo));
    if (proximo.nota) errar(partida, proximo.nota);
    else {
      definirEstrela(partida, 0);
      partida.estrelaAtiva = false;
    }
    if (partida.derrota) return;
  }
  assentar(partida, tempo);

  while (partida.primeira < partida.notas.length) {
    const nota = partida.notas[partida.primeira];
    if (nota.segurando || nota.tempo + nota.duracao >= tempo - 0.3) break;
    partida.primeira++;
  }
}
