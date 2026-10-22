import { montarPersonagem } from "./montagem";
import { PERSONAGEM_PADRAO } from "./personagem";

const com = (parcial: Partial<typeof PERSONAGEM_PADRAO>) => ({ ...PERSONAGEM_PADRAO, ...parcial });

describe("montarPersonagem", () => {
  it("usa proporção heroica de cerca de 7 cabeças, não de chibi", () => {
    const { medidas } = montarPersonagem(PERSONAGEM_PADRAO);
    const cabecas = medidas.altura / medidas.cabeca;
    expect(cabecas).toBeGreaterThanOrEqual(6.5);
    expect(cabecas).toBeLessThanOrEqual(7.5);
  });

  it("pernas, tronco e cabeça somam a altura", () => {
    const { medidas } = montarPersonagem(PERSONAGEM_PADRAO);
    expect(medidas.perna + medidas.tronco + medidas.pescoco + medidas.cabeca).toBeCloseTo(medidas.altura, 5);
  });

  it("a altura escala o corpo inteiro", () => {
    const baixo = montarPersonagem(com({ corpo: { ...PERSONAGEM_PADRAO.corpo, altura: 0 } })).medidas;
    const alto = montarPersonagem(com({ corpo: { ...PERSONAGEM_PADRAO.corpo, altura: 1 } })).medidas;
    expect(alto.altura).toBeGreaterThan(baixo.altura);
    expect(alto.perna).toBeGreaterThan(baixo.perna);
    expect(alto.braco).toBeGreaterThan(baixo.braco);
  });

  it("os ombros ficam sempre mais largos que o quadril", () => {
    for (const ombros of [0, 0.5, 1]) {
      for (const porte of [0, 1]) {
        const { medidas } = montarPersonagem(com({ corpo: { altura: 0.5, ombros, porte } }));
        expect(medidas.ombros).toBeGreaterThan(medidas.quadril);
      }
    }
  });

  it("o porte físico engrossa os membros", () => {
    const magro = montarPersonagem(com({ corpo: { ...PERSONAGEM_PADRAO.corpo, porte: 0 } })).medidas;
    const forte = montarPersonagem(com({ corpo: { ...PERSONAGEM_PADRAO.corpo, porte: 1 } })).medidas;
    expect(forte.espessura).toBeGreaterThan(magro.espessura);
  });

  it("só monta barba e acessório quando escolhidos", () => {
    expect(montarPersonagem(PERSONAGEM_PADRAO).pecas).toMatchObject({ barba: null, acessorio: null });
    expect(montarPersonagem(com({ barba: "cheia", acessorio: "fone" })).pecas).toMatchObject({ barba: "cheia", acessorio: "fone" });
  });

  it("o rosto vira escalas em torno de 1", () => {
    const { rosto } = montarPersonagem(com({ rosto: { mandibula: 0, olhos: 1, sobrancelhas: 0.5 } }));
    expect(rosto.mandibula).toBeLessThan(1);
    expect(rosto.olhos).toBeGreaterThan(1);
    expect(rosto.sobrancelhas).toBeCloseTo(1);
  });

  it("aceita um personagem chibi antigo vindo da rede", () => {
    const antigo = { nome: "X", pele: "#ffe0c7", cabelo: "moicano", corDoCabelo: "#ef4444", olhos: "fofo", roupa: "#1a1722", acessorio: "nenhum", instrumento: "bateria" };
    expect(montarPersonagem(antigo as never).pecas).toMatchObject({ cabelo: "moicano", instrumento: "bateria" });
  });
});
