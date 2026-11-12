import { render, screen, within } from "@testing-library/react";
import { PlacarDaSalaMania } from "./PlacarDaSalaMania";

const jogada = (pontos: number, precisao: number, terminou = true, derrota = false) => ({ pontos, precisao, combo: 0, terminou, derrota });

describe("PlacarDaSalaMania", () => {
  it("ordena pela pontuação, com a precisão de cada um, usando o meu resultado", () => {
    const sala = {
      meuId: 1,
      jogadores: [
        { id: 1, personagem: { nome: "Lu" } },
        { id: 2, personagem: { nome: "Ana" } },
      ],
      adversarios: { 2: jogada(900_000, 0.95) },
    };
    render(<PlacarDaSalaMania sala={sala} eu={jogada(950_000, 0.9812)} />);
    const linhas = screen.getAllByRole("listitem");
    expect(within(linhas[0]).getByText("Lu")).toBeInTheDocument();
    expect(within(linhas[0]).getByText("98,12%")).toBeInTheDocument();
    expect(within(linhas[1]).getByText("95,00%")).toBeInTheDocument();
  });

  it("quem falhou aparece como falhou", () => {
    const sala = { meuId: 1, jogadores: [{ id: 2, personagem: { nome: "Ana" } }], adversarios: { 2: jogada(10, 0.2, true, true) } };
    render(<PlacarDaSalaMania sala={sala} eu={jogada(0, 1)} />);
    expect(screen.getByText("Falhou")).toBeInTheDocument();
  });
});
