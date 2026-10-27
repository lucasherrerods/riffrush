import { useSyncExternalStore } from "react";
import { estrelasPorPontos, type Resultado } from "@/modules/gameplay";
import type { Dificuldade, Instrumento } from "@/modules/songs";

export interface Recorde {
  pontos: number;
  estrelas: number;
  fullCombo: boolean;
  /** De 0 a 1; partidas antigas não têm. */
  precisao?: number;
}

export type Recordes = Record<string, Recorde>;

/** A mesma escala da barra da partida. Quem termina a música sem derrota leva pelo menos 1 estrela. */
export function estrelasDoResultado(resultado: Pick<Resultado, "derrota" | "total" | "pontos">) {
  if (resultado.derrota || resultado.total === 0) return 0;
  return Math.max(1, estrelasPorPontos(resultado.pontos, resultado.total));
}

/** A guitarra fica com a chave de antes dos instrumentos, para os recordes antigos continuarem valendo. */
const chaveDoRecorde = (musicaId: string, dificuldade: Dificuldade, instrumento: Instrumento = "guitarra") =>
  instrumento === "guitarra" ? `${musicaId}:${dificuldade}` : `${musicaId}:${instrumento}:${dificuldade}`;

/** Um recorde como a API devolve: a melhor partida terminada da conta. */
export interface RecordeDaApi {
  musica_id: string;
  dificuldade: Dificuldade;
  instrumento: Instrumento;
  pontos: number;
  acertos: number;
  total: number;
  precisao: number | null;
}

export function recordesDaApi(lista: RecordeDaApi[]): Recordes {
  const recordes: Recordes = {};
  for (const r of lista) {
    recordes[chaveDoRecorde(r.musica_id, r.dificuldade, r.instrumento)] = {
      pontos: r.pontos,
      estrelas: estrelasDoResultado({ derrota: false, pontos: r.pontos, total: r.total }),
      fullCombo: r.total > 0 && r.acertos === r.total,
      precisao: r.precisao ?? undefined,
    };
  }
  return recordes;
}

/**
 * Os recordes ficam na conta (a API tira da melhor partida de cada música): aqui só a cópia da sessão.
 * Sem conta, não há recordes.
 */
let atuais: Recordes = {};
const ouvintes = new Set<() => void>();

function mudar(novos: Recordes) {
  atuais = novos;
  for (const ouvir of ouvintes) ouvir();
}

export const definirRecordes = (lista: RecordeDaApi[]) => mudar(recordesDaApi(lista));
export const recordesAtuais = () => atuais;

export function useRecordes() {
  return useSyncExternalStore(
    (ouvir) => {
      ouvintes.add(ouvir);
      return () => ouvintes.delete(ouvir);
    },
    recordesAtuais,
  );
}

export function recordeDe(recordes: Recordes, musicaId: string, dificuldade: Dificuldade, instrumento?: Instrumento): Recorde | undefined {
  return recordes[chaveDoRecorde(musicaId, dificuldade, instrumento)];
}

/**
 * Anota na sessão o resultado que bate o recorde, sem esperar a API recarregar. Devolve true quando é recorde novo.
 * `musicaId` é o id do ranking, o mesmo que vai para a API.
 */
export function anotarRecorde(resultado: Resultado) {
  // Fantasma conta no placar da sala, mas não é recorde: no solo a mesma partida teria acabado.
  if (resultado.derrota || resultado.fantasma) return false;
  const chave = chaveDoRecorde(resultado.musicaId, resultado.dificuldade, resultado.instrumento);
  const anterior = atuais[chave];
  if (anterior && anterior.pontos >= resultado.pontos) return false;
  mudar({
    ...atuais,
    [chave]: { pontos: resultado.pontos, estrelas: estrelasDoResultado(resultado), fullCombo: resultado.acertos === resultado.total, precisao: resultado.precisao },
  });
  return true;
}
