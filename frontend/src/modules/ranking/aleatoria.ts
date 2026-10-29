import { idDoRanking, type Musica } from "@/modules/rock/songs";
import { apiDoRanking, type MusicaNoRanking } from "./api";

const TAMANHO_DO_TOP = 50;

/** Uma música qualquer entre as 50 mais jogadas que o jogador tem na biblioteca. */
export function sortearMaisJogada<M extends Pick<Musica, "id" | "md5DoEncore">>(top: MusicaNoRanking[], musicas: M[], aleatorio = Math.random): M | undefined {
  const doTop = new Set(top.filter((m) => m.posicao <= TAMANHO_DO_TOP).map((m) => m.musica_id));
  const candidatas = musicas.filter((m) => doTop.has(idDoRanking(m)));
  return candidatas[Math.floor(aleatorio() * candidatas.length)];
}

/** Busca as mais jogadas na API e sorteia. Sem nenhuma na biblioteca, avisa com um erro. */
export async function buscarMaisJogadaAleatoria<M extends Pick<Musica, "id" | "md5DoEncore">>(musicas: M[], buscar = apiDoRanking.musicas): Promise<M> {
  const sorteada = sortearMaisJogada(await buscar(), musicas);
  if (!sorteada) throw new Error("Nenhuma das 50 músicas mais jogadas está na sua biblioteca. Baixe algumas pela busca de músicas.");
  return sorteada;
}
