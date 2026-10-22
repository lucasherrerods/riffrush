import type { Nota } from "@/modules/songs";

export const JANELA_DE_ACERTO = 0.1;
const VIDA_INICIAL = 0.5;
const VIDA_POR_ACERTO = 0.02;
const VIDA_POR_ERRO = 0.03;
const PONTOS_POR_NOTA = 50;
const PONTOS_POR_SEGUNDO_DE_SUSTAIN = 40;
const AVISO_DE_SEQUENCIA = 50;
const ESTRELA_POR_FRASE = 0.25;
const ESTRELA_MINIMA = 0.5;
/** Segundos que a barra de star power cheia dura ativada. */
const DURACAO_DA_ESTRELA = 16;
/** Soltar o sustain até esse tempo antes do fim ainda conta como completo. */
const TOLERANCIA_DO_SUSTAIN = 0.1;

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
  | { tipo: "acerto"; nota: NotaEmJogo }
  | { tipo: "erro"; nota: NotaEmJogo }
  | { tipo: "sequencia"; valor: number }
  | { tipo: "fraseCompleta" }
  | { tipo: "estrelaPronta" }
  | { tipo: "estrelaAtivada" }
  | { tipo: "derrota" };

export interface Partida {
  notas: NotaEmJogo[];
  /** Índice da primeira nota que ainda importa; as anteriores já passaram. */
  primeira: number;
  tempo: number | null;
  pontos: number;
  sequencia: number;
  maiorSequencia: number;
  acertos: number;
  vida: number;
  estrela: number;
  estrelaAtiva: boolean;
  derrota: boolean;
  semFalha: boolean;
  tamanhoDasFrases: Map<number, number>;
  acertosPorFrase: Map<number, number>;
  frasesFalhas: Set<number>;
  eventos: Evento[];
}

export function criarPartida(notas: Nota[], { semFalha = false } = {}): Partida {
  const tamanhoDasFrases = new Map<number, number>();
  for (const nota of notas) if (nota.frase >= 0) tamanhoDasFrases.set(nota.frase, (tamanhoDasFrases.get(nota.frase) ?? 0) + 1);
  return {
    notas: notas.map((n) => ({ ...n, acertada: false, perdida: false, segurando: false, solta: false, segurouAte: n.tempo })),
    primeira: 0,
    tempo: null,
    pontos: 0,
    sequencia: 0,
    maiorSequencia: 0,
    acertos: 0,
    vida: VIDA_INICIAL,
    estrela: 0,
    estrelaAtiva: false,
    derrota: false,
    semFalha,
    tamanhoDasFrases,
    acertosPorFrase: new Map(),
    frasesFalhas: new Set(),
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

function contarFrase(partida: Partida, nota: NotaEmJogo) {
  if (nota.frase < 0 || partida.frasesFalhas.has(nota.frase)) return;
  const acertos = (partida.acertosPorFrase.get(nota.frase) ?? 0) + 1;
  partida.acertosPorFrase.set(nota.frase, acertos);
  if (acertos < partida.tamanhoDasFrases.get(nota.frase)!) return;
  const antes = partida.estrela;
  partida.estrela = Math.min(1, partida.estrela + ESTRELA_POR_FRASE);
  partida.eventos.push({ tipo: "fraseCompleta" });
  if (!partida.estrelaAtiva && antes < ESTRELA_MINIMA && partida.estrela >= ESTRELA_MINIMA) partida.eventos.push({ tipo: "estrelaPronta" });
}

/** Marca a nota como acertada e aplica pontos, vida, sequência e star power. */
export function acertar(partida: Partida, nota: NotaEmJogo, tempo: number) {
  nota.acertada = true;
  nota.segurando = nota.duracao > 0;
  nota.segurouAte = Math.max(nota.tempo, tempo);
  partida.acertos++;
  partida.sequencia++;
  partida.maiorSequencia = Math.max(partida.maiorSequencia, partida.sequencia);
  partida.pontos += PONTOS_POR_NOTA * multiplicador(partida);
  partida.vida = Math.min(1, partida.vida + VIDA_POR_ACERTO);
  partida.eventos.push({ tipo: "acerto", nota });
  if (partida.sequencia % AVISO_DE_SEQUENCIA === 0) partida.eventos.push({ tipo: "sequencia", valor: partida.sequencia });
  contarFrase(partida, nota);
}

function errar(partida: Partida, nota: NotaEmJogo) {
  nota.perdida = true;
  partida.sequencia = 0;
  partida.vida = Math.max(0, partida.vida - VIDA_POR_ERRO);
  if (nota.frase >= 0) partida.frasesFalhas.add(nota.frase);
  partida.eventos.push({ tipo: "erro", nota });
  if (partida.vida === 0 && !partida.semFalha) {
    partida.derrota = true;
    partida.eventos.push({ tipo: "derrota" });
  }
}

function pontuarSustain(partida: Partida, nota: NotaEmJogo, tempo: number) {
  const ate = Math.min(tempo, nota.tempo + nota.duracao);
  if (ate <= nota.segurouAte) return;
  partida.pontos += (ate - nota.segurouAte) * PONTOS_POR_SEGUNDO_DE_SUSTAIN * multiplicador(partida);
  nota.segurouAte = ate;
}

/** Apertou a tecla da pista no instante `tempo` da música. Devolve se acertou alguma nota. */
export function tocar(partida: Partida, pista: number, tempo: number) {
  if (partida.derrota) return false;
  let melhor: NotaEmJogo | undefined;
  let menorDistancia = JANELA_DE_ACERTO;
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

/** Soltou a tecla da pista: larga o sustain que estava sendo segurado nela. */
export function soltar(partida: Partida, pista: number, tempo: number) {
  for (let i = partida.primeira; i < partida.notas.length && partida.notas[i].tempo <= tempo; i++) {
    const nota = partida.notas[i];
    if (!nota.segurando || nota.pista !== pista) continue;
    pontuarSustain(partida, nota, tempo);
    nota.segurando = false;
    if (tempo < nota.tempo + nota.duracao - TOLERANCIA_DO_SUSTAIN) nota.solta = true;
  }
}

export function ativarEstrela(partida: Partida) {
  if (partida.estrelaAtiva || partida.estrela < ESTRELA_MINIMA || partida.derrota) return false;
  partida.estrelaAtiva = true;
  partida.eventos.push({ tipo: "estrelaAtivada" });
  return true;
}

/** Avança a partida até `tempo`: notas perdidas, sustains e a barra de star power. */
export function avancar(partida: Partida, tempo: number) {
  if (partida.derrota) return;
  const passou = partida.tempo === null ? 0 : Math.max(0, tempo - partida.tempo);
  partida.tempo = tempo;

  for (let i = partida.primeira; i < partida.notas.length && partida.notas[i].tempo <= tempo; i++) {
    const nota = partida.notas[i];
    if (!nota.acertada && !nota.perdida && nota.tempo < tempo - JANELA_DE_ACERTO) errar(partida, nota);
    if (partida.derrota) return;
    if (nota.segurando) {
      pontuarSustain(partida, nota, tempo);
      if (tempo >= nota.tempo + nota.duracao) nota.segurando = false;
    }
  }

  while (partida.primeira < partida.notas.length) {
    const nota = partida.notas[partida.primeira];
    if (nota.segurando || nota.tempo + nota.duracao >= tempo - 0.3) break;
    partida.primeira++;
  }

  if (partida.estrelaAtiva) {
    partida.estrela -= passou / DURACAO_DA_ESTRELA;
    if (partida.estrela <= 0) {
      partida.estrela = 0;
      partida.estrelaAtiva = false;
    }
  }
}
