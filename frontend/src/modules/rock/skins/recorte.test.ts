import { PROPORCAO_DA_HIGHWAY, moverRecorte, recorteInicial, redimensionarRecorte } from "./recorte";

describe("recorteInicial", () => {
  it("numa imagem larga, pega a faixa do meio na proporção da highway", () => {
    expect(recorteInicial(1920, 1080)).toEqual({ x: 690, y: 0, largura: 540, altura: 1080 });
  });

  it("numa imagem alta demais, pega o meio na altura", () => {
    expect(recorteInicial(500, 2000)).toEqual({ x: 0, y: 500, largura: 500, altura: 1000 });
  });

  it("numa imagem já em 512x1024, pega tudo", () => {
    expect(recorteInicial(512, 1024)).toEqual({ x: 0, y: 0, largura: 512, altura: 1024 });
  });

  it("sempre na proporção 1:2", () => {
    const r = recorteInicial(777, 333);
    expect(r.largura / r.altura).toBeCloseTo(PROPORCAO_DA_HIGHWAY);
  });
});

describe("moverRecorte", () => {
  const r = { x: 690, y: 0, largura: 540, altura: 1080 };

  it("anda junto com o arraste", () => {
    expect(moverRecorte(r, -100, 0, 1920, 1080)).toMatchObject({ x: 590, y: 0 });
  });

  it("não sai da imagem", () => {
    expect(moverRecorte(r, -5000, 50, 1920, 1080)).toMatchObject({ x: 0, y: 0 });
    expect(moverRecorte(r, 5000, 0, 1920, 1080)).toMatchObject({ x: 1380 });
  });
});

describe("redimensionarRecorte", () => {
  const r = { x: 690, y: 0, largura: 540, altura: 1080 };

  it("diminui em volta do centro, mantendo a proporção", () => {
    const menor = redimensionarRecorte(r, 0.5, 1920, 1080);
    expect(menor).toEqual({ x: 825, y: 270, largura: 270, altura: 540 });
  });

  it("não passa do tamanho da imagem nem fica menor que o mínimo", () => {
    expect(redimensionarRecorte(r, 4, 1920, 1080).altura).toBe(1080);
    expect(redimensionarRecorte(r, 0.001, 1920, 1080).altura).toBeGreaterThanOrEqual(64);
  });

  it("aumentar perto da borda empurra o recorte para dentro", () => {
    const naBorda = { x: 0, y: 540, largura: 270, altura: 540 };
    const maior = redimensionarRecorte(naBorda, 2, 1920, 1080);
    expect(maior.x).toBeGreaterThanOrEqual(0);
    expect(maior.y + maior.altura).toBeLessThanOrEqual(1080);
  });
});
