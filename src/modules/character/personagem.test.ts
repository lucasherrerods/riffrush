import { geradorAleatorio } from "@/shared/lib/aleatorio";
import { ACESSORIOS, BARBAS, CABELOS, CORES_DE_CABELO, CORES_DE_ROUPA, INSTRUMENTOS, ROUPAS, TONS_DE_PELE } from "./catalogo";
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

  it("converte o personagem chibi salvo antes da versão 3D", () => {
    localStorage.setItem(
      "riffrush.personagem",
      JSON.stringify({ nome: "Lucas", pele: "#a86b45", cabelo: "espetado", corDoCabelo: "#ef4444", olhos: "fofo", roupa: "#7c3aed", acessorio: "coroa", instrumento: "baixo" }),
    );
    expect(carregarPersonagem()).toMatchObject({ versao: 2, nome: "Lucas", instrumento: "baixo", cabelo: "rebelde", acessorio: "nenhum" });
  });
});

describe("migrarPersonagem", () => {
  const chibi = { nome: "Ana", pele: "#ffe0c7", cabelo: "coquinhos", corDoCabelo: "#3b82f6", olhos: "estrela", roupa: "#16a34a", acessorio: "oculos", instrumento: "vocal" };

  it("aproveita nome, instrumento, cores e acessório do chibi", () => {
    const personagem = migrarPersonagem(chibi);
    expect(personagem).toMatchObject({ nome: "Ana", instrumento: "vocal", acessorio: "oculos", cabelo: "rabo" });
    expect(personagem.cores).toMatchObject({ pele: "#ffe0c7", cabelo: "#3b82f6", roupa: "#16a34a" });
  });

  it("mapeia todos os cabelos antigos para cabelos novos", () => {
    for (const cabelo of ["espetado", "chanel", "longo", "moicano", "coquinhos"]) {
      expect(CABELOS.map((c) => c.id)).toContain(migrarPersonagem({ ...chibi, cabelo }).cabelo);
    }
  });

  it("completa campos que faltam e corrige valores inválidos", () => {
    const personagem = migrarPersonagem({ versao: 2, nome: "Bia", corpo: { altura: 7 }, cabelo: "inexistente", cores: { pele: "vermelho" } });
    expect(personagem.nome).toBe("Bia");
    expect(personagem.corpo.altura).toBe(1);
    expect(personagem.corpo.porte).toBe(PERSONAGEM_PADRAO.corpo.porte);
    expect(personagem.cabelo).toBe(PERSONAGEM_PADRAO.cabelo);
    expect(personagem.cores.pele).toBe(PERSONAGEM_PADRAO.cores.pele);
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
    expect(TONS_DE_PELE).toContain(personagem.cores.pele);
    expect(CORES_DE_CABELO).toContain(personagem.cores.cabelo);
    expect(CORES_DE_ROUPA).toContain(personagem.cores.roupa);
    expect(CABELOS.map((c) => c.id)).toContain(personagem.cabelo);
    expect(BARBAS.map((b) => b.id)).toContain(personagem.barba);
    expect(ROUPAS.map((r) => r.id)).toContain(personagem.roupa);
    expect(ACESSORIOS.map((a) => a.id)).toContain(personagem.acessorio);
    expect(INSTRUMENTOS.map((i) => i.id)).toContain(personagem.instrumento);
    for (const valor of [...Object.values(personagem.corpo), ...Object.values(personagem.rosto)]) {
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
