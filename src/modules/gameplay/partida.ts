import type { Nota } from "@/modules/songs";

export const JANELA_DE_ACERTO = 0.1;
const VIDA_INICIAL = 0.5;
const VIDA_POR_ACERTO = 0.02;
const VIDA_POR_ERRO = 0.03;
const PONTOS_POR_NOTA = 50;
const AVISO_DE_SEQUENCIA = 50;

export interface NotaEmJogo extends Nota {
  acertada: boolean;
  perdida: boolean;
}

export type Evento =
  | { tipo: "acerto"; nota: NotaEmJogo }
  | { tipo: "erro"; nota: NotaEmJogo }
  | { tipo: "sequencia"; valor: number }
  | { tipo: "derrota" };

export interface Partida {
  notas: NotaEmJogo[];
  /** Índice da primeira nota que ainda importa; as anteriores já passaram. */
  primeira: number;
  pontos: number;
  sequencia: number;
  maiorSequencia: number;
  acertos: number;
  vida: number;
  derrota: boolean;
  semFalha: boolean;
  eventos: Evento[];
}

export function criarPartida(notas: Nota[], { semFalha = false } = {}): Partida {
  return {
    notas: notas.map((n) => ({ ...n, acertada: false, perdida: false })),
    primeira: 0,
    pontos: 0,
    sequencia: 0,
    maiorSequencia: 0,
    acertos: 0,
    vida: VIDA_INICIAL,
    derrota: false,
    semFalha,
    eventos: [],
  };
}

/** Eventos acumulados desde a última chamada (para tocar sons e mostrar avisos). */
export function retirarEventos(partida: Partida) {
  return partida.eventos.splice(0);
}

export function multiplicador(partida: Partida) {
  return Math.min(4, 1 + Math.floor(partida.sequencia / 10));
}

function acertar(partida: Partida, nota: NotaEmJogo) {
  nota.acertada = true;
  partida.acertos++;
  partida.sequencia++;
  partida.maiorSequencia = Math.max(partida.maiorSequencia, partida.sequencia);
  partida.pontos += PONTOS_POR_NOTA * multiplicador(partida);
  partida.vida = Math.min(1, partida.vida + VIDA_POR_ACERTO);
  partida.eventos.push({ tipo: "acerto", nota });
  if (partida.sequencia % AVISO_DE_SEQUENCIA === 0) partida.eventos.push({ tipo: "sequencia", valor: partida.sequencia });
}

function errar(partida: Partida, nota: NotaEmJogo) {
  nota.perdida = true;
  partida.sequencia = 0;
  partida.vida = Math.max(0, partida.vida - VIDA_POR_ERRO);
  partida.eventos.push({ tipo: "erro", nota });
  if (partida.vida === 0 && !partida.semFalha) {
    partida.derrota = true;
    partida.eventos.push({ tipo: "derrota" });
  }
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
  acertar(partida, melhor);
  return true;
}

/** Avança a partida até `tempo`: marca as notas que passaram sem ser tocadas. */
export function avancar(partida: Partida, tempo: number) {
  if (partida.derrota) return;
  for (let i = partida.primeira; i < partida.notas.length && partida.notas[i].tempo < tempo - JANELA_DE_ACERTO; i++) {
    const nota = partida.notas[i];
    if (!nota.acertada && !nota.perdida) errar(partida, nota);
    if (partida.derrota) return;
  }
  while (partida.primeira < partida.notas.length && partida.notas[partida.primeira].tempo < tempo - 0.3) partida.primeira++;
}
