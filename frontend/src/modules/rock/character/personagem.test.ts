import { geradorAleatorio } from "@/shared/lib/aleatorio";
import { BASES, EXPRESSOES, INSTRUMENTOS, PALETAS, tipoDoModelo } from "./catalogo";
import { PERSONAGEM_PADRAO, carregarPersonagem, migrarPersonagem, personagemAleatorio, salvarPersonagem } from "./personagem";

beforeEach(() => localStorage.clear());

describe("carregarPersonagem", () => {
  it("usa o padrão quando não há nada salvo", () => {
    expect(carregarPersonagem()).toEqual(PERSONAGEM_PADRAO);
  });

  it("devolve o personagem salvo", () => {
    salvarPersonagem({ ...PERSONAGEM_PADRAO, nome: "Vitor", instrumento: "bateria" });
    expect(carregarPersonagem()).toMatchObject({ nome: "Vitor", instrumento: "bateria" });
  });

  it("ignora dados corrompidos", () => {
    localStorage.setItem("riffrush.personagem", "{quebrado");
    expect(carregarPersonagem()).toEqual(PERSONAGEM_PADRAO);
  });
});

describe("migrarPersonagem", () => {
  it("aproveita nome, instrumento e pele do chibi (versão 1)", () => {
    const chibi = { nome: "Ana", pele: "#ffe0c7", cabelo: "coquinhos", corDoCabelo: "#3b82f6", olhos: "estrela", roupa: "#16a34a", acessorio: "oculos", instrumento: "vocal" };
    expect(migrarPersonagem(chibi)).toMatchObject({ versao: 3, nome: "Ana", instrumento: "vocal", cores: { pele: "#ffe0c7", cabelo: "#3b82f6" } });
  });

  it("aproveita nome, instrumento, corpo e cores do boneco procedural (versão 2)", () => {
    const v2 = {
      versao: 2,
      nome: "Bia",
      instrumento: "baixo",
      corpo: { altura: 0.8, porte: 0.2, ombros: 0.6 },
      cores: { pele: "#9a6644", cabelo: "#8f1d1d", olhos: "#2f6b3a", roupa: "#2d3a4f", detalhe: "#c9a227" },
    };
    expect(migrarPersonagem(v2)).toMatchObject({
      versao: 3,
      nome: "Bia",
      instrumento: "baixo",
      corpo: { altura: 0.8, porte: 0.2, ombros: 0.6 },
      cores: { pele: "#9a6644", cabelo: "#8f1d1d", olhos: "#2f6b3a", roupa: "#2d3a4f" },
    });
  });

  it("completa campos que faltam e corrige valores inválidos", () => {
    const personagem = migrarPersonagem({ versao: 3, nome: "Caio", base: "nao-existe", corpo: { altura: 7 }, expressao: "x", cores: { pele: "vermelho" }, pecas: ["nao-existe"] });
    expect(personagem.base).toBe(PERSONAGEM_PADRAO.base);
    expect(personagem.corpo.altura).toBe(1);
    expect(personagem.corpo.porte).toBe(0.5);
    expect(personagem.expressao).toBe(PERSONAGEM_PADRAO.expressao);
    expect(personagem.cores.pele).toBeNull();
    expect(personagem.pecas).toEqual([]);
  });

  it("devolve o padrão para o que não é um objeto", () => {
    expect(migrarPersonagem(null)).toEqual(PERSONAGEM_PADRAO);
    expect(migrarPersonagem("oi")).toEqual(PERSONAGEM_PADRAO);
  });

  it("não altera um personagem que já está na versão atual", () => {
    expect(migrarPersonagem(PERSONAGEM_PADRAO)).toEqual(PERSONAGEM_PADRAO);
  });
});

describe("personagemAleatorio", () => {
  it("mantém o nome e sorteia só opções que existem", () => {
    const personagem = personagemAleatorio("Lucas", geradorAleatorio(3));
    expect(personagem.nome).toBe("Lucas");
    expect(BASES.map((b) => b.id)).toContain(personagem.base);
    expect(INSTRUMENTOS.map((i) => i.id)).toContain(personagem.instrumento);
    expect(EXPRESSOES.map((e) => e.id)).toContain(personagem.expressao);
    for (const [parte, cor] of Object.entries(personagem.cores)) {
      if (cor) expect(PALETAS[parte as keyof typeof PALETAS]).toContain(cor);
    }
    for (const valor of Object.values(personagem.corpo)) {
      expect(valor).toBeGreaterThanOrEqual(0);
      expect(valor).toBeLessThanOrEqual(1);
    }
  });

  it("varia entre sorteios", () => {
    const aleatorio = geradorAleatorio(7);
    const sorteios = new Set(Array.from({ length: 10 }, () => JSON.stringify(personagemAleatorio("x", aleatorio))));
    expect(sorteios.size).toBeGreaterThan(1);
  });
});

describe("modelo removido", () => {
  it("quem tinha o Recruta salvo passa para o modelo padrão, sem perder o resto", () => {
    const salvo = migrarPersonagem({ ...PERSONAGEM_PADRAO, nome: "Lucas", base: "recruta", instrumento: "baixo" });
    expect(salvo.base).toBe("roqueiro");
    expect(salvo.nome).toBe("Lucas");
    expect(salvo.instrumento).toBe("baixo");
  });
});

describe("tipoDoModelo", () => {
  it("o ator filmado é vídeo; os personagens gerados são VRM", () => {
    expect(tipoDoModelo("sorriso")).toBe("video");
    expect(tipoDoModelo("torcida")).toBe("video");
    expect(tipoDoModelo("roqueiro")).toBe("vrm");
    expect(tipoDoModelo("nao-existe")).toBe("vrm");
  });
});
