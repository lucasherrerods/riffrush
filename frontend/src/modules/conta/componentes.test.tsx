import { render, screen } from "@testing-library/react";
import { GanhoDeXp } from "./GanhoDeXp";

const nivel = (n: number, no: number, proximo: number) => ({ nivel: n, xp_no_nivel: no, xp_para_o_proximo: proximo });

describe("GanhoDeXp", () => {
  it("mostra o XP ganho e o progresso no nível", () => {
    render(<GanhoDeXp xp={{ xp_ganho: 40, antes: nivel(3, 10, 520), depois: nivel(3, 50, 520) }} />);
    expect(screen.getByText("+40 XP")).toBeInTheDocument();
    expect(screen.getByText("Nível 3")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "10");
  });

  it("comemora quando sobe de nível", () => {
    render(<GanhoDeXp xp={{ xp_ganho: 150, antes: nivel(1, 0, 100), depois: nivel(2, 50, 283) }} />);
    expect(screen.getByText("Subiu para o nível 2!")).toBeInTheDocument();
  });
});
