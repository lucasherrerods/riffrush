import type { EstadoDoJogador } from "@/modules/gameplay";
import { MUSICAS_EMBUTIDAS, type Musica } from "@/modules/songs";

/** Endereço do relay (relay/ neste repositório). Sem ele, o modo online fica escondido. */
export const URL_DO_RELAY: string = import.meta.env.VITE_URL_DO_RELAY ?? "";

/** O jogo manda o placar 8x por segundo; pela internet uma vez basta e poupa a cota do relay. */
export const INTERVALO_DO_ESTADO_ONLINE_MS = 1000;

/** Mesmo alfabeto do relay (relay/src/regras.ts), que é publicado à parte. */
const FORMATO_DO_CODIGO = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

const semBarraNoFim = (url: string) => url.replace(/\/+$/, "");

export const urlParaCriarSala = (base: string) => `${semBarraNoFim(base)}/criar`;
export const urlParaEntrarNaSala = (base: string, codigo: string) => `${semBarraNoFim(base)}/sala/${codigo}`;

export function normalizarCodigo(texto: string): string | null {
  const codigo = texto.toUpperCase().replace(/[\s-]/g, "");
  return FORMATO_DO_CODIGO.test(codigo) ? codigo : null;
}

export function deveEnviarEstado(ultimoEnvio: number, agora: number, estado: EstadoDoJogador): boolean {
  return estado.terminou || estado.derrota || agora - ultimoEnvio >= INTERVALO_DO_ESTADO_ONLINE_MS;
}

/** Pela internet só vão músicas que cada jogador consegue sozinho: as do jogo e as do Encore. */
export const podeTocarOnline = (musica: Musica) => MUSICAS_EMBUTIDAS.some((m) => m.id === musica.id) || !!musica.urlDoEncore;
