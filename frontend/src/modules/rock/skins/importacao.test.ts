import { LIMITE_DE_HIGHWAYS, TAMANHO_MAXIMO_DO_ARQUIVO, adicionarHighway, medidasDaHighway, nomeDaHighway, removerHighway, validarArquivoDeHighway } from "./importacao";
import { SKIN_PADRAO, type SkinDaPista } from "./skins";

const arquivo = (name: string, type: string, size = 1000) => ({ name, type, size });

describe("validarArquivoDeHighway", () => {
  it("aceita PNG e JPG, como o Clone Hero", () => {
    expect(validarArquivoDeHighway(arquivo("Rosa.png", "image/png"))).toBeNull();
    expect(validarArquivoDeHighway(arquivo("Madeira.JPG", ""))).toBeNull();
    expect(validarArquivoDeHighway(arquivo("x.jpeg", "image/jpeg"))).toBeNull();
  });

  it("recusa vídeo e outros formatos", () => {
    expect(validarArquivoDeHighway(arquivo("anim.webm", "video/webm"))).toMatch(/PNG ou JPG/);
    expect(validarArquivoDeHighway(arquivo("pacote.rar", ""))).toMatch(/PNG ou JPG/);
  });

  it("recusa arquivo grande demais", () => {
    expect(validarArquivoDeHighway(arquivo("g.png", "image/png", TAMANHO_MAXIMO_DO_ARQUIVO + 1))).toMatch(/MB/);
  });
});

describe("nomeDaHighway", () => {
  it("tira a extensão e troca _ e - por espaço", () => {
    expect(nomeDaHighway("Dark_Wood-v2.png")).toBe("Dark Wood v2");
  });

  it("dá um nome quando sobra nada", () => {
    expect(nomeDaHighway(".png")).toBe("Highway");
  });
});

describe("medidasDaHighway", () => {
  it("leva para 512x1024, o tamanho que o Clone Hero usa", () => {
    expect(medidasDaHighway(1024, 2048)).toEqual({ largura: 512, altura: 1024 });
    expect(medidasDaHighway(1000, 1000)).toEqual({ largura: 512, altura: 1024 });
  });
});

describe("adicionarHighway e removerHighway", () => {
  const nova = (id: string): SkinDaPista => ({ ...SKIN_PADRAO, id, nome: id, highway: "data:..." });

  it("põe a nova na frente", () => {
    expect(adicionarHighway([nova("highway:a")], nova("highway:b")).map((s) => s.id)).toEqual(["highway:b", "highway:a"]);
  });

  it("substitui a de mesmo id", () => {
    expect(adicionarHighway([nova("highway:a")], nova("highway:a"))).toHaveLength(1);
  });

  it("guarda no máximo o limite, apagando a mais antiga", () => {
    let lista: SkinDaPista[] = [];
    for (let i = 0; i <= LIMITE_DE_HIGHWAYS; i++) lista = adicionarHighway(lista, nova(`highway:${i}`));
    expect(lista).toHaveLength(LIMITE_DE_HIGHWAYS);
    expect(lista.some((s) => s.id === "highway:0")).toBe(false);
  });

  it("remove pelo id", () => {
    expect(removerHighway([nova("highway:a"), nova("highway:b")], "highway:a").map((s) => s.id)).toEqual(["highway:b"]);
  });
});
