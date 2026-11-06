import { imagemDaHighway } from "./imagemDaHighway";
import { SKIN_PADRAO, SKINS_PRONTAS } from "./skins";

it("sem imagem, a pista desenha o braço do jogo", () => {
  expect(imagemDaHighway(SKIN_PADRAO)).toBeUndefined();
});

it("uma highway importada é usada como veio", () => {
  expect(imagemDaHighway({ ...SKIN_PADRAO, highway: "data:image/jpeg;base64,..." })).toBeInstanceOf(HTMLImageElement);
});

it("a pista de personagem fica vazia até a imagem carregar e ser recortada", () => {
  const imagem = imagemDaHighway(SKINS_PRONTAS.find((s) => s.recortar)!);
  expect(imagem).toBeInstanceOf(HTMLCanvasElement);
  expect(imagem!.width).toBe(0);
});
