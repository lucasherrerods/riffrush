import { alternarFavorita, carregarFavoritas, indicesVisiveis, salvarFavoritas, selecaoNoFiltro } from "./favoritas";

beforeEach(() => localStorage.clear());

describe("favoritas", () => {
  it("alternar marca e desmarca, sem mexer no conjunto antigo", () => {
    const vazia = new Set<string>();
    const com = alternarFavorita(vazia, "shine");
    expect([...com]).toEqual(["shine"]);
    expect(vazia.size).toBe(0);
    expect(alternarFavorita(com, "shine").size).toBe(0);
  });

  it("guarda e lê de volta, e ignora o que não for lista de ids", () => {
    salvarFavoritas(new Set(["a", "b"]));
    expect([...carregarFavoritas()]).toEqual(["a", "b"]);
    localStorage.setItem("riffrush:favoritas", '{"quebrado":');
    expect(carregarFavoritas().size).toBe(0);
    localStorage.setItem("riffrush:favoritas", '["a", 3]');
    expect([...carregarFavoritas()]).toEqual(["a"]);
  });

  it("o filtro desligado mostra todas; ligado, só as favoritas, na ordem da lista", () => {
    const musicas = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(indicesVisiveis(musicas, new Set(["c", "a"]), false)).toEqual([0, 1, 2]);
    expect(indicesVisiveis(musicas, new Set(["c", "a"]), true)).toEqual([0, 2]);
    expect(indicesVisiveis(musicas, new Set(), true)).toEqual([]);
  });

  it("a seleção fica onde está se segue visível, senão vai para a próxima visível dando a volta", () => {
    expect(selecaoNoFiltro([0, 2, 4], 2)).toBe(2);
    expect(selecaoNoFiltro([0, 2, 4], 3)).toBe(4);
    expect(selecaoNoFiltro([0, 2], 3)).toBe(0);
    expect(selecaoNoFiltro([], 1)).toBeUndefined();
  });
});
