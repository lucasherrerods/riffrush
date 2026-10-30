import {
  lerAvisoDeEspectadores, lerConvite, aplicarMensagem, entradasDoLote, entradasParaOLote, ordenarPessoas, urlDaPresenca, urlDaTransmissao, type PessoaOnline } from "./protocolo";

const pessoa = (id: string, nome: string, estado: PessoaOnline["estado"] = { tipo: "menu" }): PessoaOnline => ({ id, nome, avatar: null, estado });
const tocando = (transmitindo: boolean): PessoaOnline["estado"] => ({
  tipo: "tocando",
  musica: "encore:abc",
  titulo: "Paint It Black",
  artista: "The Rolling Stones",
  dificuldade: "expert",
  instrumento: "guitarra",
  transmitindo,
});

describe("aplicarMensagem", () => {
  it("a lista substitui tudo, a pessoa entra ou é atualizada, e quem sai some", () => {
    let pessoas = aplicarMensagem([], JSON.stringify({ tipo: "lista", pessoas: [pessoa("a", "Ana")] }));
    pessoas = aplicarMensagem(pessoas, JSON.stringify({ tipo: "pessoa", pessoa: pessoa("b", "Bia") }));
    pessoas = aplicarMensagem(pessoas, JSON.stringify({ tipo: "pessoa", pessoa: pessoa("a", "Ana", tocando(true)) }));
    expect(pessoas.map((p) => [p.id, p.estado.tipo])).toEqual([
      ["b", "menu"],
      ["a", "tocando"],
    ]);
    expect(aplicarMensagem(pessoas, JSON.stringify({ tipo: "saiu", id: "b" })).map((p) => p.id)).toEqual(["a"]);
  });

  it("mensagem estranha não mexe na lista", () => {
    const pessoas = [pessoa("a", "Ana")];
    expect(aplicarMensagem(pessoas, "{quebrado")).toBe(pessoas);
    expect(aplicarMensagem(pessoas, '{"tipo":"outra"}')).toBe(pessoas);
  });
});

describe("ordenarPessoas", () => {
  it("quem dá para assistir vem primeiro, depois quem toca, depois o menu, e eu não apareço", () => {
    const pessoas = [pessoa("1", "Zé"), pessoa("2", "Bia", tocando(false)), pessoa("3", "Caio", tocando(true)), pessoa("4", "Ana"), pessoa("eu", "Eu")];
    expect(ordenarPessoas(pessoas, "eu").map((p) => p.nome)).toEqual(["Caio", "Bia", "Ana", "Zé"]);
  });
});

describe("lotes", () => {
  it("ida e volta das entradas em [ms, código]", () => {
    const entradas = [
      { tempo: 1.234, tipo: "tocar" as const, pista: 3 },
      { tempo: 1.3, tipo: "soltar" as const, pista: 3 },
      { tempo: 2, tipo: "estrela" as const, pista: 0 },
    ];
    expect(entradasParaOLote(entradas)).toEqual([
      [1234, 3],
      [1300, 8],
      [2000, 10],
    ]);
    expect(entradasDoLote(entradasParaOLote(entradas))).toEqual(entradas);
  });
});

describe("urls", () => {
  it("monta as rotas do relay, com a ficha só para quem transmite", () => {
    expect(urlDaPresenca("wss://relay/")).toBe("wss://relay/presenca");
    expect(urlDaTransmissao("wss://relay", "id-1")).toBe("wss://relay/transmissao/id-1");
  });
});

describe("lerAvisoDeEspectadores", () => {
  it("lê quantas pessoas estão assistindo", () => {
    expect(lerAvisoDeEspectadores(JSON.stringify({ tipo: "espectadores", quantos: 2 }))).toBe(2);
  });

  it("ignora outras mensagens e números estranhos", () => {
    expect(lerAvisoDeEspectadores(JSON.stringify({ tipo: "fim" }))).toBeNull();
    expect(lerAvisoDeEspectadores(JSON.stringify({ tipo: "espectadores", quantos: -1 }))).toBeNull();
    expect(lerAvisoDeEspectadores("{quebrado")).toBeNull();
  });
});

describe("lerConvite", () => {
  it("lê o convite do relay e ignora o resto", () => {
    expect(lerConvite(JSON.stringify({ tipo: "convite", de: { id: "a", nome: "Ana", avatar: null }, codigo: "ABCDE" }))).toEqual({
      de: { id: "a", nome: "Ana", avatar: null },
      codigo: "ABCDE",
    });
    expect(lerConvite(JSON.stringify({ tipo: "lista", pessoas: [] }))).toBeNull();
    expect(lerConvite(JSON.stringify({ tipo: "convite", de: { id: 3 }, codigo: "ABCDE" }))).toBeNull();
    expect(lerConvite("{")).toBeNull();
  });
});
