import { POSTS, emOrdem, formatarData, type Post } from "./posts";

const post = (id: string, data: string): Post => ({ id, data, titulo: id, resumo: "", itens: [] });

describe("emOrdem", () => {
  it("põe o post mais novo primeiro sem mexer na lista original", () => {
    const lista = [post("a", "2026-11-01"), post("c", "2026-11-12"), post("b", "2026-11-05")];
    expect(emOrdem(lista).map((p) => p.id)).toEqual(["c", "b", "a"]);
    expect(lista[0].id).toBe("a");
  });
});

describe("formatarData", () => {
  it("escreve a data por extenso, sem cair no dia anterior pelo fuso", () => {
    expect(formatarData("2026-11-01")).toBe("1 de novembro de 2026");
  });
});

describe("POSTS", () => {
  it("tem ids únicos, que viram âncoras da página", () => {
    expect(new Set(POSTS.map((p) => p.id)).size).toBe(POSTS.length);
    POSTS.forEach((p) => expect(p.id).toMatch(/^[a-z0-9-]+$/));
  });

  it("tem datas válidas e algo para contar", () => {
    POSTS.forEach((p) => {
      expect(p.data).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.itens.length).toBeGreaterThan(0);
    });
  });
});
