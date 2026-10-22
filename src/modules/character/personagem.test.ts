import { geradorAleatorioDeTeste } from "@/test/aleatorio";
import {
  ACESSORIOS,
  CABELOS,
  CORES_DE_CABELO,
  CORES_DE_ROUPA,
  INSTRUMENTOS,
  OLHOS,
  PERSONAGEM_PADRAO,
  TONS_DE_PELE,
  carregarPersonagem,
  personagemAleatorio,
  salvarPersonagem,
} from "./personagem";

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

describe("personagemAleatorio", () => {
  it("mantém o nome e sorteia só opções que existem", () => {
    const personagem = personagemAleatorio("Lucas", geradorAleatorioDeTeste(3));
    expect(personagem.nome).toBe("Lucas");
    expect(TONS_DE_PELE).toContain(personagem.pele);
    expect(CABELOS.map((c) => c.id)).toContain(personagem.cabelo);
    expect(CORES_DE_CABELO).toContain(personagem.corDoCabelo);
    expect(OLHOS.map((o) => o.id)).toContain(personagem.olhos);
    expect(CORES_DE_ROUPA).toContain(personagem.roupa);
    expect(ACESSORIOS.map((a) => a.id)).toContain(personagem.acessorio);
    expect(INSTRUMENTOS.map((i) => i.id)).toContain(personagem.instrumento);
  });

  it("varia entre sorteios", () => {
    const aleatorio = geradorAleatorioDeTeste(7);
    const sorteios = new Set(Array.from({ length: 10 }, () => JSON.stringify(personagemAleatorio("x", aleatorio))));
    expect(sorteios.size).toBeGreaterThan(1);
  });
});

describe("opções", () => {
  it("as cores de roupa não usam preto nem branco puros", () => {
    for (const cor of CORES_DE_ROUPA) expect(cor).not.toMatch(/^#(000000|ffffff)$/i);
  });
});
