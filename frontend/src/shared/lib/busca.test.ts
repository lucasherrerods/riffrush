import { filtrarPorNome, semAcento } from "./busca";

describe("busca por nome", () => {
  it("ignora acento, maiúscula e espaço nas pontas", () => {
    expect(semAcento("  João ")).toBe("joao");
    expect(filtrarPorNome([{ nome: "João" }, { nome: "Bia" }], " joa").map((p) => p.nome)).toEqual(["João"]);
  });

  it("sem busca devolve a lista inteira", () => {
    expect(filtrarPorNome([{ nome: "Bia" }], "  ")).toHaveLength(1);
  });
});
