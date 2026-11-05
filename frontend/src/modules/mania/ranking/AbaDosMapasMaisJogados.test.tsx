import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("AbaDosMapasMaisJogados", () => {
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
