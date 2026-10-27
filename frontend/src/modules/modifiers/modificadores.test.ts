import { multiplicadorDePontos, proximaVelocidade } from "./modificadores";

const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5];

describe("modificadores", () => {
  it("cada clique sobe um nível de velocidade e, depois do mais rápido, passa pelos lentos até voltar ao normal", () => {
    const vistas = [1];
    for (let i = 0; i < VELOCIDADES.length; i++) vistas.push(proximaVelocidade(VELOCIDADES, vistas.at(-1)!));
    expect(vistas).toEqual([1, 1.25, 1.5, 0.5, 0.75, 1]);
  });

  it("o passo negativo volta um nível, e uma velocidade fora da lista recomeça do normal", () => {
    expect(proximaVelocidade(VELOCIDADES, 1, -1)).toBe(0.75);
    expect(proximaVelocidade(VELOCIDADES, 0.5, -1)).toBe(1.5);
    expect(proximaVelocidade(VELOCIDADES, 3)).toBe(1);
  });

  it("o multiplicador de pontos é o da velocidade da música", () => {
    expect(multiplicadorDePontos({ velocidadeDaMusica: 1 })).toBe(1);
    expect(multiplicadorDePontos({ velocidadeDaMusica: 1.25 })).toBe(1.25);
    expect(multiplicadorDePontos({ velocidadeDaMusica: 0.5 })).toBe(0.5);
  });
});
