import type { Musica } from "@/modules/songs";

/** Junta as músicas novas na lista: a que já existe é trocada no mesmo lugar, as outras vão para o fim. */
export function juntarMusicas(atuais: Musica[], novas: Musica[]): Musica[] {
  const porId = new Map(novas.map((m) => [m.id, m]));
  const trocadas = atuais.map((m) => porId.get(m.id) ?? m);
  return [...trocadas, ...novas.filter((m) => !atuais.some((a) => a.id === m.id))];
}

/** Música importada que ficou só no histórico: o áudio saiu da fila e precisa ser importado de novo. */
export const semAudio = (musica: Musica) => musica.id.startsWith("arquivo:") && !musica.arquivo && !musica.noAparelho;
