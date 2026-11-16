import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Atividade } from "./api";
import { TelaDeAtividades } from "./TelaDeAtividades";

const atividade = (nome: string, quando: string, titulo: string): Atividade => ({
  conta_id: nome,
  nome,
  avatar: null,
  quando,
  evento: { tipo: "partida_do_mania", beatmap_id: 1, beatmapset_id: 7, titulo, artista: null, dificuldade: "Hard", precisao: 0.9, derrota: false },
});

const ana = atividade("Ana", "2026-11-12T15:00:00Z", "Mapa da Ana");
const bia = atividade("Bia", "2026-11-12T14:00:00Z", "Mapa da Bia");

describe("TelaDeAtividades", () => {
  it("lista quem fez o quê, com o modo e a hora", async () => {
    render(<TelaDeAtividades aoVoltar={() => {}} carregar={async () => [ana, bia]} />);
    const linhas = await screen.findAllByRole("listitem");
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent("Ana");
    expect(linhas[0]).toHaveTextContent("jogou");
    expect(linhas[0]).toHaveTextContent("Mapa da Ana");
    expect(linhas[0]).toHaveTextContent("Mania");
    expect(within(linhas[0]).getByRole("time")).toHaveAttribute("datetime", ana.quando);
  });

  it("sem nada ainda, avisa", async () => {
    render(<TelaDeAtividades aoVoltar={() => {}} carregar={async () => []} />);
    expect(await screen.findByText("Ninguém jogou nada ainda.")).toBeInTheDocument();
  });

  it("carregar mais pede as anteriores à última da lista", async () => {
    const carregar = vi.fn(async (antes?: string) => (antes ? [atividade("Caio", "2026-11-12T13:00:00Z", "Mapa do Caio")] : [ana, bia]));
    render(<TelaDeAtividades aoVoltar={() => {}} carregar={carregar} porPagina={2} />);
    await userEvent.click(await screen.findByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByText("Mapa do Caio")).toBeInTheDocument();
    expect(carregar).toHaveBeenLastCalledWith(bia.quando, expect.anything());
  });

  it("de tempos em tempos, as novas entram no topo", async () => {
    let resposta = [bia];
    render(<TelaDeAtividades aoVoltar={() => {}} carregar={async () => resposta} intervaloMs={20} />);
    await screen.findByText("Mapa da Bia");
    resposta = [ana, bia];
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(2));
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Mapa da Ana");
  });
});
