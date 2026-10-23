import { cenaDoAtor, quadroDaCena, recorteDoQuadro, type CenaDoAtor } from "./video";

const base = { tocando: false, triste: false, reacao: null, desdeReacao: 0 };

describe("cenaDoAtor", () => {
  it("parado antes da música e tocando durante", () => {
    expect(cenaDoAtor(base)).toEqual({ cena: "parado", repetir: true });
    expect(cenaDoAtor({ ...base, tocando: true })).toEqual({ cena: "tocando", repetir: true });
  });

  it("com a vida baixa, fica de cabeça baixa", () => {
    expect(cenaDoAtor({ ...base, tocando: true, triste: true })).toEqual({ cena: "vaiado", repetir: true });
  });

  it("uma reação passa na frente de tudo e toca uma vez", () => {
    expect(cenaDoAtor({ ...base, tocando: true, reacao: "errou", desdeReacao: 0.1 })).toEqual({ cena: "errou", repetir: false });
    expect(cenaDoAtor({ ...base, tocando: true, reacao: "nitro", desdeReacao: 0.5 })).toEqual({ cena: "nitro", repetir: false });
  });

  it("errou e nitro passam e voltam para a cena de antes", () => {
    expect(cenaDoAtor({ ...base, tocando: true, reacao: "errou", desdeReacao: 5 }).cena).toBe("tocando");
  });

  it("vitória e derrota ficam até o fim; a derrota usa a cabeça baixa", () => {
    expect(cenaDoAtor({ ...base, reacao: "vitoria", desdeReacao: 30 })).toEqual({ cena: "vitoria", repetir: false });
    expect(cenaDoAtor({ ...base, reacao: "derrota", desdeReacao: 30 })).toEqual({ cena: "vaiado", repetir: false });
  });
});

describe("quadroDaCena", () => {
  const cena: CenaDoAtor = { arquivo: "tocando.png", quadros: 10, colunas: 4, linhas: 3, largura: 100, altura: 200 };

  it("avança no ritmo do fps do vídeo", () => {
    expect(quadroDaCena(cena, 0, 12, true)).toBe(0);
    expect(quadroDaCena(cena, 0.25, 12, true)).toBe(3);
  });

  it("em loop, volta para o começo", () => {
    expect(quadroDaCena(cena, 1, 12, true)).toBe(2);
  });

  it("sem loop, para no último quadro", () => {
    expect(quadroDaCena(cena, 5, 12, false)).toBe(9);
  });
});

describe("recorteDoQuadro", () => {
  it("acha o quadro na grade da folha, contando de cima para baixo", () => {
    const cena: CenaDoAtor = { arquivo: "x.png", quadros: 10, colunas: 4, linhas: 3, largura: 100, altura: 200 };
    // A textura tem a origem embaixo: a primeira linha da folha é a de cima.
    expect(recorteDoQuadro(cena, 0)).toEqual({ x: 0, y: 2 / 3, largura: 1 / 4, altura: 1 / 3 });
    expect(recorteDoQuadro(cena, 5)).toEqual({ x: 1 / 4, y: 1 / 3, largura: 1 / 4, altura: 1 / 3 });
  });
});
