import { VOLUME_AO_DESMUTAR, volumeAoAlternarMudo } from "./volume";

describe("volumeAoAlternarMudo", () => {
  it("com som, muta", () => {
    expect(volumeAoAlternarMudo(0.4, 0.4)).toBe(0);
  });

  it("mutado, volta para o último volume audível", () => {
    expect(volumeAoAlternarMudo(0, 0.6)).toBe(0.6);
  });

  it("mutado desde o começo, volta para um volume baixo", () => {
    expect(volumeAoAlternarMudo(0, 0)).toBe(VOLUME_AO_DESMUTAR);
  });
});
