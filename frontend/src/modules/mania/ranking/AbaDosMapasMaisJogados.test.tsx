import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MapaDaBusca } from "../busca/api";
import type { MapaMaisJogado } from "./api";
import { AbaDosMapasMaisJogados } from "./AbaDosMapasMaisJogados";

const mapa = (beatmap_id: number, extra: Partial<MapaMaisJogado> = {}): MapaMaisJogado => ({
  posicao: 1,
  beatmap_id,
  beatmapset_id: 7,
  partidas: 12,
  jogadores: 3,
  titulo: "Música",
  artista: "Banda",
  dificuldade: "Hard",
  recorde: { nome: "Ana", pontuacao: 990_000, precisao: 0.99 },
  ...extra,
});

const conjunto: MapaDaBusca = {
  beatmapsetId: 7,
  titulo: "Musica",
  tituloUnicode: "Música",
  artista: "Banda",
  artistaUnicode: "Banda",
  mapper: "Mapper",
  status: "ranked",
  dificuldades: [
    { beatmapId: 1, nome: "Hard", teclas: 4, estrelas: 3.25, hash: "a", duracaoS: 125, bpm: 180, od: 8, hp: 7.5, notas: 1234 },
    { beatmapId: 2, nome: "Easy", teclas: 4, estrelas: 1.5, hash: "b", duracaoS: 125 },
  ],
};

describe("AbaDosMapasMaisJogados", () => {
  it("vem ordenada por jogadores, mesmo que a API mande em outra ordem", async () => {
    render(<AbaDosMapasMaisJogados carregar={async () => [mapa(1, { titulo: "Muitas partidas", jogadores: 1, partidas: 50 }), mapa(2, { titulo: "Mais gente", jogadores: 4, partidas: 5 })]} />);
    const nomes = (await screen.findAllByRole("button", { name: /Ver o ranking de/ })).map((b) => b.getAttribute("aria-label"));
    expect(nomes).toEqual(["Ver o ranking de Mais gente [Hard]", "Ver o ranking de Muitas partidas [Hard]"]);
  });

  it("abrir um mapa mostra os números da dificuldade e deixa baixar o conjunto", async () => {
    const osz = new Blob(["x"]);
    const baixar = vi.fn(async () => osz);
    const aoBaixar = vi.fn(async () => {});
    render(<AbaDosMapasMaisJogados carregar={async () => [mapa(1)]} buscarConjunto={async () => conjunto} baixados={new Set()} aoBaixar={aoBaixar} baixar={baixar} />);
    await userEvent.click(await screen.findByRole("button", { name: "Ver o ranking de Música [Hard]" }));
    const detalhes = await screen.findByRole("list", { name: "Sobre o mapa" });
    for (const texto of ["4K", "3,25★", "2:05", "180 BPM", "OD 8", "HP 7,5", "1.234 notas"]) expect(detalhes).toHaveTextContent(texto);
    expect(screen.getByText(/mapa de Mapper/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Baixar Musica" }));
    expect(baixar).toHaveBeenCalledWith(7, expect.anything());
    expect(aoBaixar).toHaveBeenCalledWith(osz, conjunto);
  });

  it("com o conjunto já na biblioteca, o botão é Jogar", async () => {
    const aoJogar = vi.fn();
    render(<AbaDosMapasMaisJogados carregar={async () => [mapa(1)]} buscarConjunto={async () => conjunto} baixados={new Set([7])} aoJogar={aoJogar} />);
    await userEvent.click(await screen.findByRole("button", { name: "Ver o ranking de Música [Hard]" }));
    await userEvent.click(await screen.findByRole("button", { name: "Jogar Musica" }));
    expect(aoJogar).toHaveBeenCalledWith(7);
  });

  it("lista os mapas com o nome do .osu, partidas e jogadores", async () => {
    render(<AbaDosMapasMaisJogados carregar={async () => [mapa(1)]} />);
    expect(await screen.findByText("Música [Hard]")).toBeInTheDocument();
    expect(screen.getByText("12 partidas")).toBeInTheDocument();
    expect(screen.getByText(/3 jogadores · Ana/)).toBeInTheDocument();
  });

  it("sem o .osu no servidor, usa o nome da biblioteca, ou o id do mapa", async () => {
    const semNome = { titulo: null, dificuldade: null };
    render(<AbaDosMapasMaisJogados nomeNaBiblioteca={(id) => (id === 1 ? "Da biblioteca" : undefined)} carregar={async () => [mapa(1, semNome), mapa(2, { ...semNome, posicao: 2 })]} />);
    expect(await screen.findByText("Da biblioteca")).toBeInTheDocument();
    expect(screen.getByText("Mapa 2")).toBeInTheDocument();
  });

  it("abrir um mapa mostra o ranking dele, e dá para voltar", async () => {
    render(<AbaDosMapasMaisJogados carregar={async () => [mapa(1)]} />);
    await userEvent.click(await screen.findByRole("button", { name: "Ver o ranking de Música [Hard]" }));
    expect(screen.getByRole("region", { name: "Ranking da dificuldade" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Voltar aos mapas" }));
    expect(await screen.findByText("Música [Hard]")).toBeInTheDocument();
  });
});
