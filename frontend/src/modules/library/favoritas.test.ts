import { alternarFavorita, carregarFavoritas, salvarFavoritas } from "./favoritas";

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
});
