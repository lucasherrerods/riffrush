import { colunaDaGrade, medidaEntre, posicaoNaGrade } from "./medida";

describe("medidaEntre", () => {
  const cheio = { porcento: 100, px: 0 };
  const terco = { porcento: 33.333, px: -16 };

  it("fica na medida de partida no começo", () => {
    expect(medidaEntre(cheio, terco, 0)).toBe("calc(100% + 0px)");
  });

  it("chega na medida final no fim", () => {
    expect(medidaEntre(cheio, terco, 1)).toBe("calc(33.333% + -16px)");
  });

  it("anda junto a parte em porcentagem e a parte em pixels", () => {
    expect(medidaEntre(cheio, terco, 0.5)).toBe("calc(66.667% + -8px)");
  });

  it("não passa dos limites quando o progresso sai de 0 a 1", () => {
    expect(medidaEntre(cheio, terco, 2)).toBe(medidaEntre(cheio, terco, 1));
    expect(medidaEntre(cheio, terco, -1)).toBe(medidaEntre(cheio, terco, 0));
  });
});

describe("colunaDaGrade e posicaoNaGrade", () => {
  it("divide a largura em colunas iguais descontando os espaços", () => {
    expect(colunaDaGrade(3, 24)).toEqual({ porcento: 100 / 3, px: -16 });
    expect(colunaDaGrade(4, 24)).toEqual({ porcento: 25, px: -18 });
  });

  it("posiciona cada coluna logo depois da anterior e do espaço", () => {
    expect(posicaoNaGrade(0, 4, 24)).toEqual({ porcento: 0, px: 0 });
    expect(posicaoNaGrade(2, 4, 24)).toEqual({ porcento: 50, px: 12 });
  });

  it("encosta a última coluna na borda direita", () => {
    const coluna = colunaDaGrade(4, 24);
    const ultima = posicaoNaGrade(3, 4, 24);
    expect(ultima.porcento + coluna.porcento).toBe(100);
    expect(ultima.px + coluna.px).toBe(0);
  });
});
