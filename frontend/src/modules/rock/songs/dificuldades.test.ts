import { dificuldadeMaisProxima, dificuldadesDaMusica, instrumentosDaMusica } from "./dificuldades";

describe("dificuldadesDaMusica", () => {
  it("o chart importado mostra só as dificuldades que tem", () => {
    expect(dificuldadesDaMusica({ dificuldades: ["expert", "facil"] }).map((d) => d.id)).toEqual(["facil", "expert"]);
  });

  it("sem a lista (chart automático ou importada antes), mostra as quatro", () => {
    expect(dificuldadesDaMusica({}).map((d) => d.id)).toEqual(["facil", "medio", "dificil", "expert"]);
  });
});

describe("instrumentos da música", () => {
  const musica = { trilhas: { baixo: ["medio" as const], guitarra: ["expert" as const, "facil" as const] } };

  it("lista, na ordem da seleção, os instrumentos que o chart tem", () => {
    expect(instrumentosDaMusica(musica).map((i) => i.id)).toEqual(["guitarra", "baixo"]);
  });

  it("mostra as dificuldades do instrumento escolhido", () => {
    expect(dificuldadesDaMusica(musica, "baixo").map((d) => d.id)).toEqual(["medio"]);
    expect(dificuldadesDaMusica(musica, "guitarra").map((d) => d.id)).toEqual(["facil", "expert"]);
  });

  it("sem o instrumento, usa o primeiro que a música tem", () => {
    expect(dificuldadesDaMusica({ trilhas: { baixo: ["medio"] } }, "guitarra").map((d) => d.id)).toEqual(["medio"]);
  });

  it("chart automático ou pacote guardado antes dos instrumentos tem só a guitarra", () => {
    expect(instrumentosDaMusica({}).map((i) => i.id)).toEqual(["guitarra"]);
    expect(instrumentosDaMusica({ dificuldades: ["expert"] }).map((i) => i.id)).toEqual(["guitarra"]);
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
