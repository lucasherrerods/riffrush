import { MAXIMO_DE_FAIXAS, adicionarOuTirar, alternarPublica, apagarPlaylist, carregarPlaylists, contem, criarPlaylist, renomearPlaylist, salvarPlaylists, type Playlist } from "./playlists";

const faixa = (musica: string, versao = "expert") => ({ musica, versao, titulo: musica });

describe("playlists", () => {
  beforeEach(() => localStorage.clear());

  it("cria uma playlist vazia com o nome sem espaços nas pontas", () => {
    const [nova] = criarPlaylist([], "  Treino  ", () => "p1");
    expect(nova).toEqual({ id: "p1", nome: "Treino", publica: true, faixas: [] });
  });

  it("nome vazio vira um nome padrão", () => {
    expect(criarPlaylist([], "   ", () => "p1")[0].nome).toBe("Playlist 1");
  });

  it("adicionar de novo a mesma música e versão tira ela", () => {
    let lista: Playlist[] = criarPlaylist([], "A", () => "p1");
    lista = adicionarOuTirar(lista, "p1", faixa("x"));
    lista = adicionarOuTirar(lista, "p1", faixa("y"));
    expect(lista[0].faixas.map((f) => f.musica)).toEqual(["x", "y"]);
    expect(contem(lista[0], faixa("x"))).toBe(true);
    lista = adicionarOuTirar(lista, "p1", faixa("x"));
    expect(lista[0].faixas.map((f) => f.musica)).toEqual(["y"]);
  });

  it("a mesma música em outra versão é outra faixa", () => {
    let lista: Playlist[] = criarPlaylist([], "A", () => "p1");
    lista = adicionarOuTirar(lista, "p1", faixa("x", "facil"));
    lista = adicionarOuTirar(lista, "p1", faixa("x", "expert"));
    expect(lista[0].faixas).toHaveLength(2);
  });

  it("playlist cheia não ganha mais música, mas ainda dá para tirar", () => {
    let lista: Playlist[] = criarPlaylist([], "A", () => "p1");
    for (let i = 0; i < MAXIMO_DE_FAIXAS; i++) lista = adicionarOuTirar(lista, "p1", faixa(String(i)));
    expect(adicionarOuTirar(lista, "p1", faixa("nova"))[0].faixas).toHaveLength(MAXIMO_DE_FAIXAS);
    expect(adicionarOuTirar(lista, "p1", faixa("0"))[0].faixas).toHaveLength(MAXIMO_DE_FAIXAS - 1);
  });

  it("alterna se aparece para os amigos", () => {
    const lista = criarPlaylist([], "A", () => "p1");
    expect(alternarPublica(lista, "p1")[0].publica).toBe(false);
  });

  it("renomeia e apaga sem mexer na lista recebida", () => {
    const lista = criarPlaylist(criarPlaylist([], "A", () => "p1"), "B", () => "p2");
    expect(renomearPlaylist(lista, "p2", "C")[1].nome).toBe("C");
    expect(apagarPlaylist(lista, "p1").map((p) => p.id)).toEqual(["p2"]);
    expect(lista).toHaveLength(2);
  });

  it("guarda e lê de volta, cada modo na sua chave, e ignora lixo", () => {
    const lista = adicionarOuTirar(criarPlaylist([], "A", () => "p1"), "p1", faixa("x"));
    salvarPlaylists("chave", lista);
    expect(carregarPlaylists("chave")).toEqual(lista);
    expect(carregarPlaylists("outra")).toEqual([]);
    localStorage.setItem("chave", "{quebrado");
    expect(carregarPlaylists("chave")).toEqual([]);
    localStorage.setItem("chave", JSON.stringify([{ id: 1 }, { id: "ok", nome: "B", faixas: [{ musica: "m", versao: "v", titulo: "T" }, { musica: 2 }] }]));
    expect(carregarPlaylists("chave")).toEqual([{ id: "ok", nome: "B", publica: true, faixas: [{ musica: "m", versao: "v", titulo: "T" }] }]);
  });
});
