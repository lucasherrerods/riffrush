import { PERSONAGENS, instrumentoDoPersonagem, skinDoPersonagem } from "./catalogo";
import { PERSONAGEM_PADRAO, carregarPersonagem, migrarPersonagem, salvarPersonagem } from "./personagem";

beforeEach(() => localStorage.clear());

describe("catálogo", () => {
  it("o Faísca, guitarrista filmado, é o personagem padrão", () => {
    expect(PERSONAGEM_PADRAO).toEqual({ versao: 4, nome: "Rockstar", personagem: "faisca", skin: "classico" });
    expect(instrumentoDoPersonagem(PERSONAGEM_PADRAO)).toBe("guitarra");
    expect(skinDoPersonagem(PERSONAGEM_PADRAO)).toMatchObject({ arquivo: "/modelos/atores/faisca", tipo: "video" });
  });

  it("todo personagem tem um instrumento e ao menos uma skin", () => {
    for (const p of PERSONAGENS) expect(p.skins.length).toBeGreaterThan(0);
  });
});

describe("carregarPersonagem", () => {
  it("usa o padrão quando não há nada salvo", () => {
    expect(carregarPersonagem()).toEqual(PERSONAGEM_PADRAO);
  });

  it("devolve o personagem salvo", () => {
    salvarPersonagem({ ...PERSONAGEM_PADRAO, nome: "Vitor" });
    expect(carregarPersonagem()).toEqual({ ...PERSONAGEM_PADRAO, nome: "Vitor" });
  });

  it("ignora dados corrompidos", () => {
    localStorage.setItem("riffrush.personagem", "{quebrado");
    expect(carregarPersonagem()).toEqual(PERSONAGEM_PADRAO);
  });
});

describe("migrarPersonagem", () => {
  it("a customização antiga (cores, corpo, peças) some; o nome fica e o personagem passa a ser o Faísca", () => {
    const v3 = { versao: 3, nome: "Bia", base: "roqueiro", instrumento: "baixo", corpo: { altura: 0.8 }, expressao: "alegre", cores: { pele: "#9a6644" }, pecas: [] };
    expect(migrarPersonagem(v3)).toEqual({ ...PERSONAGEM_PADRAO, nome: "Bia" });
  });

  it("troca personagem ou skin que não existem pelo padrão", () => {
    expect(migrarPersonagem({ versao: 4, nome: "Caio", personagem: "nao-existe", skin: "x" })).toEqual({ ...PERSONAGEM_PADRAO, nome: "Caio" });
    expect(migrarPersonagem({ versao: 4, nome: "Caio", personagem: "faisca", skin: "x" })).toMatchObject({ personagem: "faisca", skin: "classico" });
  });

  it("devolve o padrão para o que não é um objeto", () => {
    expect(migrarPersonagem(null)).toEqual(PERSONAGEM_PADRAO);
    expect(migrarPersonagem("oi")).toEqual(PERSONAGEM_PADRAO);
  });

  it("não altera um personagem que já está na versão atual", () => {
    expect(migrarPersonagem(PERSONAGEM_PADRAO)).toEqual(PERSONAGEM_PADRAO);
  });
});
