import { sortearMaisJogada } from "./aleatoria";
import type { MusicaNoRanking } from "./api";

const noRanking = (posicao: number, musica_id: string): MusicaNoRanking => ({ posicao, musica_id, partidas: 100 - posicao, jogadores: 1 });
const musica = (id: string, md5DoEncore?: string) => ({ id, md5DoEncore });

describe("sortearMaisJogada", () => {
  it("sorteia só entre as do top que o jogador tem na biblioteca", () => {
    const top = [noRanking(1, "a"), noRanking(2, "fora"), noRanking(3, "b")];
    const musicas = [musica("a"), musica("b"), musica("c")];
    expect(sortearMaisJogada(top, musicas, () => 0)?.id).toBe("a");
    expect(sortearMaisJogada(top, musicas, () => 0.99)?.id).toBe("b");
  });

  it("reconhece as baixadas do Encore pelo md5", () => {
    expect(sortearMaisJogada([noRanking(1, "encore:x")], [musica("local-1", "x")], () => 0)?.id).toBe("local-1");
  });

  it("fica nas 50 primeiras posições", () => {
    const top = Array.from({ length: 60 }, (_, i) => noRanking(i + 1, `m${i + 1}`));
    expect(sortearMaisJogada(top, [musica("m51"), musica("m60")], () => 0)).toBeUndefined();
  });

  it("sem nenhuma do top na biblioteca, não sorteia", () => {
    expect(sortearMaisJogada([noRanking(1, "a")], [musica("z")], () => 0)).toBeUndefined();
  });
});
