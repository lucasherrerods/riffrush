import { medidaEntre } from "./medida";

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
