/*
 * Regras do chat, iguais para o do lobby e o global: o texto é limpo dos dois lados
 * (quem manda e quem recebe), e cada um só fala dentro do limite do balde.
 */

export const TAMANHO_MAXIMO_DO_TEXTO = 200;
/** Quantas mensagens a tela guarda. */
export const MENSAGENS_GUARDADAS = 50;
const RAJADA = 5;
const RECARGA_MS = 1000;

// Controle, e os invisíveis que invertem a direção do texto ou escondem letras (truques de golpe).
const INVISIVEIS = /[\p{Cc}​-‏‪-‮⁠-⁩﻿]/gu;

/** O texto como pode aparecer no chat, ou null quando não sobra nada. */
export function limparTexto(texto: unknown): string | null {
  if (typeof texto !== "string") return null;
  const limpo = texto
    .replace(/[\t\n\r]/g, " ")
    .replace(INVISIVEIS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAMANHO_MAXIMO_DO_TEXTO)
    .trim();
  return limpo || null;
}

export interface Balde {
  fichas: number;
  em: number;
}

export const BALDE_CHEIO: Balde = { fichas: RAJADA, em: -Infinity };

/** Rajada de 5 mensagens, depois uma por segundo. */
export function gastarDoBalde(balde: Balde, agora: number): { passa: boolean; balde: Balde } {
  const recarregadas = balde.em === -Infinity ? RAJADA : Math.floor((agora - balde.em) / RECARGA_MS);
  const fichas = Math.min(RAJADA, balde.fichas + recarregadas);
  // Guarda o resto do tempo para a próxima ficha não atrasar.
  const em = balde.em === -Infinity || fichas === RAJADA ? agora : balde.em + recarregadas * RECARGA_MS;
  if (fichas < 1) return { passa: false, balde: { fichas, em } };
  return { passa: true, balde: { fichas: fichas - 1, em } };
}

export const adicionarMensagem = <T>(lista: T[], mensagem: T, maximo = MENSAGENS_GUARDADAS) => [...lista, mensagem].slice(-maximo);
