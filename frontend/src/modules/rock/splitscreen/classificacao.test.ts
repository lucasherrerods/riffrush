import type { Resultado } from "@/modules/rock/gameplay";
import { classificar } from "./classificacao";

const resultado = (pontos: number): Resultado => ({ musicaId: "m", dificuldade: "medio", pontos, acertos: 0, total: 10, maiorSequencia: 0, derrota: false });

describe("classificar", () => {
  it("ordena pelos pontos e numera as posições", () => {
    const tabela = classificar([
      { nome: "P1", resultado: resultado(100) },
      { nome: "P2", resultado: resultado(300) },
      { nome: "P3", resultado: resultado(200) },
    ]);
    expect(tabela.map((l) => [l.posicao, l.nome])).toEqual([
      [1, "P2"],
      [2, "P3"],
      [3, "P1"],
    ]);
  });

  it("empate divide a posição, e quem vem depois pula a dividida", () => {
    const tabela = classificar([
      { nome: "P1", resultado: resultado(200) },
      { nome: "P2", resultado: resultado(200) },
      { nome: "P3", resultado: resultado(100) },
    ]);
    expect(tabela.map((l) => l.posicao)).toEqual([1, 1, 3]);
  });
});
