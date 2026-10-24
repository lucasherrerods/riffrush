import { dificuldadeMaisProxima, dificuldadesDaMusica } from "./dificuldades";

describe("dificuldadesDaMusica", () => {
  it("o chart importado mostra só as dificuldades que tem", () => {
    expect(dificuldadesDaMusica({ dificuldades: ["expert", "facil"] }).map((d) => d.id)).toEqual(["facil", "expert"]);
  });

  it("sem a lista (chart automático ou importada antes), mostra as quatro", () => {
    expect(dificuldadesDaMusica({}).map((d) => d.id)).toEqual(["facil", "medio", "dificil", "expert"]);
  });
});

describe("dificuldadeMaisProxima", () => {
  it("devolve a pedida quando ela existe", () => {
    expect(dificuldadeMaisProxima(["facil", "expert"], "expert")).toBe("expert");
  });

  it("senão, a mais próxima, e no empate a mais fácil", () => {
    expect(dificuldadeMaisProxima(["facil", "expert"], "dificil")).toBe("expert");
    expect(dificuldadeMaisProxima(["facil", "dificil"], "medio")).toBe("facil");
  });

  it("sem nenhuma, não devolve nada", () => {
    expect(dificuldadeMaisProxima([], "medio")).toBeUndefined();
  });
});
