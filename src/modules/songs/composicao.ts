import { geradorAleatorio } from "@/shared/lib/aleatorio";
import type { EstiloMusical } from "./tipos";

export type Secao = "intro" | "verso" | "refrao" | "solo" | "final";

export const ESTRUTURA: [Secao, number][] = [
  ["intro", 2],
  ["verso", 8],
  ["refrao", 8],
  ["verso", 8],
  ["refrao", 8],
  ["solo", 8],
  ["refrao", 8],
  ["final", 2],
];

export interface NotaDaMelodia {
  tempo: number;
  /** Semicolcheia dentro do compasso (0 a 15). */
  passo: number;
  /** Posição na escala, de 0 a 9 (duas oitavas). */
  grau: number;
  acorde: boolean;
  frase: number;
}

export interface Compasso {
  tempo: number;
  secao: Secao;
  acorde: number;
}

export interface Composicao {
  melodia: NotaDaMelodia[];
  compassos: Compasso[];
  duracao: number;
}

const BATIDAS_DE_ENTRADA = 2;
const SILENCIO_NO_FIM = 2;

export function compor(estilo: EstiloMusical, semente: number): Composicao {
  const aleatorio = geradorAleatorio(semente);
  const batida = 60 / estilo.bpm;
  const semicolcheia = batida / 4;
  const melodia: NotaDaMelodia[] = [];
  const compassos: Compasso[] = [];
  let indice = 0;
  let frase = 0;

  for (const [secao, quantidade] of ESTRUTURA) {
    const densidade =
      secao === "solo" ? Math.min(0.95, estilo.densidade + 0.3) : secao === "refrao" ? estilo.densidade + 0.1 : estilo.densidade;

    // Um motivo de 2 compassos que se repete, com variações, por toda a seção.
    const motivo: { passo: number; grau: number }[] = [];
    let grau = 3 + Math.floor(aleatorio() * 4);
    for (let passo = 0; passo < 32; passo++) {
      const chance =
        passo % 4 === 0
          ? 0.35 + densidade * 0.8
          : passo % 2 === 0
            ? 0.1 + densidade * 0.9
            : densidade * (secao === "solo" ? 0.8 : 0.45);
      if (aleatorio() < chance) {
        grau = Math.max(0, Math.min(9, grau + [-2, -1, -1, 0, 1, 1, 2][Math.floor(aleatorio() * 7)]));
        motivo.push({ passo, grau });
      }
    }

    for (let c = 0; c < quantidade; c++) {
      const tempo = BATIDAS_DE_ENTRADA * batida + indice * batida * 4;
      compassos.push({ tempo, secao, acorde: estilo.progressao[indice % estilo.progressao.length] });

      if (secao !== "intro" && secao !== "final") {
        const ehEstrela = c % 4 === 2 && aleatorio() < 0.6;
        if (ehEstrela) frase++;
        const metade = c % 2;
        const transposicao = c >= 4 && aleatorio() < 0.5 ? (aleatorio() < 0.5 ? -1 : 1) : 0;
        for (const m of motivo) {
          if (Math.floor(m.passo / 16) !== metade) continue;
          if (c >= 2 && aleatorio() < 0.12) continue;
          const passo = m.passo % 16;
          melodia.push({
            tempo: tempo + passo * semicolcheia,
            passo,
            grau: Math.max(0, Math.min(9, m.grau + transposicao)),
            acorde: passo % 4 === 0 && secao === "refrao" && aleatorio() < 0.25,
            frase: ehEstrela ? frase : -1,
          });
        }
      }
      indice++;
    }
  }

  return { melodia, compassos, duracao: BATIDAS_DE_ENTRADA * batida + indice * batida * 4 + SILENCIO_NO_FIM };
}
