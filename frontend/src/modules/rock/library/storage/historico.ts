import type { Musica } from "@/modules/rock/songs";

/** Junta as músicas novas na lista: a que já existe é trocada no mesmo lugar, as outras vão para o fim. */
export function juntarMusicas(atuais: Musica[], novas: Musica[]): Musica[] {
  const porId = new Map(novas.map((m) => [m.id, m]));
  const trocadas = atuais.map((m) => porId.get(m.id) ?? m);
  return [...trocadas, ...novas.filter((m) => !atuais.some((a) => a.id === m.id))];
}

/** Trazida pelo jogador (arquivo ou .sng), ao contrário das embutidas no jogo. */
export const ehImportada = (musica: Musica) => musica.id.startsWith("arquivo:");

/** Música importada que ficou só no histórico: o navegador apagou o áudio e ele precisa ser importado de novo. */
export const semAudio = (musica: Musica) => ehImportada(musica) && !musica.arquivo && !musica.noAparelho;
