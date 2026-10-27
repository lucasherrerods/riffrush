import { ReplayLido } from "./motor";
import { VERSAO_DO_REPLAY_DO_MANIA, empacotarReplayDoMania, type ReplayDoMania } from "./replay";

const replay: ReplayDoMania = {
  mods: (1 << 3) | (1 << 11),
  semente: 0xdeadbeef,
  hash: "00112233445566778899aabbccddeeff",
  entradas: [
    [-300, 2, 1],
    [-250, 2, 0],
    [1000, 0, 1],
    [1000, 17, 1],
    [600000, 0, 0],
  ],
};

it("o replay empacotado no app é lido igual pelo motor da API", async () => {
  const bytes = await empacotarReplayDoMania(replay);
  expect(bytes[0]).toBe(VERSAO_DO_REPLAY_DO_MANIA);
  const lido = new ReplayLido(bytes);
  expect({ mods: lido.mods, semente: lido.semente, hash: lido.hash }).toEqual({ mods: replay.mods, semente: replay.semente, hash: replay.hash });
  const trios = [...lido.entradas()];
  expect(Array.from({ length: trios.length / 3 }, (_, i) => trios.slice(i * 3, i * 3 + 3))).toEqual(replay.entradas);
  lido.free();
});

it("um mapa denso inteiro fica com poucos KB", async () => {
  const entradas = Array.from({ length: 6000 }, (_, i): [number, number, number] => [1000 + i * 60 + ((i * 37) % 11), i % 7, i % 2 === 0 ? 1 : 0]);
  expect((await empacotarReplayDoMania({ ...replay, entradas })).length).toBeLessThan(16 * 1024);
});

it("o motor recusa replay quebrado", () => {
  expect(() => new ReplayLido(new Uint8Array([1, 2, 3]))).toThrow("Replay inválido");
});
