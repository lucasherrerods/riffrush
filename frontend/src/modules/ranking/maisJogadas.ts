import { apiDoRanking, type MusicaNoRanking } from "./api";

const ID_DO_ENCORE = /^encore:([a-f0-9]{32})$/i;

/** Os md5 dos charts do Encore entre as mais jogadas, da mais jogada para a menos. Arquivos importados ficam de fora. */
export function md5sDoEncore(top: MusicaNoRanking[]): string[] {
  return [...top].sort((a, b) => a.posicao - b.posicao).flatMap((m) => ID_DO_ENCORE.exec(m.musica_id)?.[1] ?? []);
}

export async function buscarMd5sMaisJogados({ sinal }: { sinal?: AbortSignal } = {}, buscar = apiDoRanking.musicas): Promise<string[]> {
  return md5sDoEncore(await buscar({ sinal }));
}
