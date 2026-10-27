import { render, screen } from "@testing-library/react";
import { GanhoDeXp } from "./GanhoDeXp";

const nivel = { nivel: 1, xp_no_nivel: 0, xp_para_o_proximo: 100 };

describe("GanhoDeXp", () => {
  it("mostra o XP ganho", () => {
    render(<GanhoDeXp xp={{ xp_ganho: 150, antes: nivel, depois: { ...nivel, nivel: 2 } }} />);
    expect(screen.getByText("+150 XP")).toBeInTheDocument();
    expect(screen.getByText("Subiu para o nível 2!")).toBeInTheDocument();
  });

  it("enquanto o servidor confere a partida, mostra que o XP está em validação", () => {
    render(<GanhoDeXp xp={{ pendente: true, id: "p1" }} />);
    expect(screen.getByText("XP em validação")).toBeInTheDocument();
  });

  it("partida recusada pelo servidor avisa que não valeu XP", () => {
    render(<GanhoDeXp xp={{ recusada: true }} />);
    expect(screen.getByText("Esta partida não valeu XP")).toBeInTheDocument();
  });
});
