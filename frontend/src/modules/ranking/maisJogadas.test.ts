import { md5sDoEncore } from "./maisJogadas";
import type { MusicaNoRanking } from "./api";

const musica = (posicao: number, musica_id: string): MusicaNoRanking => ({ posicao, musica_id, partidas: 10 - posicao, jogadores: 1 });
const md5 = (n: number) => String(n).padStart(32, "a");

describe("md5sDoEncore", () => {
  it("fica só com os charts do Encore, na ordem de partidas", () => {
    const top = [musica(2, `encore:${md5(2)}`), musica(1, `encore:${md5(1)}`), musica(3, "arquivo:minha.mp3:123")];
    expect(md5sDoEncore(top)).toEqual([md5(1), md5(2)]);
  });

  it("ignora ids do Encore que não são md5", () => {
    expect(md5sDoEncore([musica(1, "encore:../x")])).toEqual([]);
  });
});
