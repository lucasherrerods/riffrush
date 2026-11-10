import type { Musica } from "@/modules/rock/songs";
import { musicaDeAbertura } from "./musicaDeAbertura";

const musica = (id: string) => ({ id }) as Musica;
const doJogo = musica("do-jogo");

describe("musicaDeAbertura", () => {
  it("sorteia entre as músicas baixadas pela pessoa", () => {
    const baixadas = [musica("a"), musica("b"), musica("c")];
    expect(musicaDeAbertura([doJogo, ...baixadas], baixadas, () => 0.5)?.id).toBe("b");
    expect(musicaDeAbertura([doJogo, ...baixadas], baixadas, () => 0.99)?.id).toBe("c");
  });

  it("sem música baixada, toca a do jogo, que não tem direitos autorais", () => {
    expect(musicaDeAbertura([doJogo], [], () => 0.5)?.id).toBe("do-jogo");
  });

  it("baixada sem áudio (fora da fila) não entra no sorteio", () => {
    expect(musicaDeAbertura([doJogo], [musica("sem-audio")], () => 0)?.id).toBe("do-jogo");
  });

  it("com a fila vazia, não toca nada", () => {
    expect(musicaDeAbertura([], [], () => 0)).toBeUndefined();
  });
});
