import { MEDIDAS_DA_IMAGEM, corteCentral, ehFotoPropria } from "./imagemDoPerfil";

describe("corteCentral", () => {
  it("corta as sobras dos lados de uma foto deitada para virar quadrada", () => {
    expect(corteCentral(400, 200, 1)).toEqual({ x: 100, y: 0, largura: 200, altura: 200 });
  });

  it("corta em cima e embaixo uma foto em pé para virar capa 3:1", () => {
    expect(corteCentral(300, 600, 3)).toEqual({ x: 0, y: 250, largura: 300, altura: 100 });
  });

  it("a capa sai três vezes mais larga que alta e a foto quadrada", () => {
    expect(MEDIDAS_DA_IMAGEM.capa.largura / MEDIDAS_DA_IMAGEM.capa.altura).toBe(3);
    expect(MEDIDAS_DA_IMAGEM.foto.largura).toBe(MEDIDAS_DA_IMAGEM.foto.altura);
  });
});

describe("ehFotoPropria", () => {
  it("só a foto enviada para a API conta como própria; a do Google não", () => {
    expect(ehFotoPropria("https://api.exemplo.com/contas/1/imagens/foto?v=2")).toBe(true);
    expect(ehFotoPropria("https://lh3.googleusercontent.com/a/x")).toBe(false);
    expect(ehFotoPropria(null)).toBe(false);
  });
});
