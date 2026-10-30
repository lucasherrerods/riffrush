import { amigosPrimeiro, contarGrupos, filtrarLobby, grupoDoEstado, podeAssistir } from "./lobby";
import type { EstadoOnline, PessoaOnline } from "./protocolo";

const tocando = (transmitindo: boolean): EstadoOnline => ({ tipo: "tocando", musica: "x", titulo: "T", artista: "A", dificuldade: "expert", instrumento: "guitarra", transmitindo });
const pessoa = (id: string, nome: string, estado: EstadoOnline): PessoaOnline => ({ id, nome, avatar: null, estado });

const pessoas = [
  pessoa("1", "Ana", tocando(true)),
  pessoa("2", "Bruno", { tipo: "multiplayer", sala: { jogadores: 2, online: true } }),
  pessoa("3", "Caio", { tipo: "multiplayer" }),
  pessoa("4", "Duda", { tipo: "selecao" }),
  pessoa("5", "Élio", tocando(false)),
];

describe("lobby", () => {
  it("só dá para assistir quem está tocando e transmitindo", () => {
    expect(podeAssistir(tocando(true))).toBe(true);
    expect(podeAssistir(tocando(false))).toBe(false);
    expect(podeAssistir({ tipo: "menu" })).toBe(false);
  });

  it("separa quem toca, quem está numa sala e o resto", () => {
    expect(pessoas.map((p) => grupoDoEstado(p.estado))).toEqual(["tocando", "sala", "menu", "menu", "tocando"]);
  });

  it("conta cada grupo para os filtros", () => {
    expect(contarGrupos(pessoas)).toEqual({ todos: 5, tocando: 2, sala: 1, menu: 2 });
  });

  it("filtra pelo grupo e pelo nome, sem acento", () => {
    expect(filtrarLobby(pessoas, "tocando", "").map((p) => p.nome)).toEqual(["Ana", "Élio"]);
    expect(filtrarLobby(pessoas, "todos", "elio").map((p) => p.nome)).toEqual(["Élio"]);
    expect(filtrarLobby(pessoas, "sala", "ana")).toEqual([]);
  });

  it("amigos vêm primeiro, sem mudar a ordem dentro de cada parte", () => {
    expect(amigosPrimeiro(pessoas, new Set(["4", "2"])).map((p) => p.id)).toEqual(["2", "4", "1", "3", "5"]);
  });
});
