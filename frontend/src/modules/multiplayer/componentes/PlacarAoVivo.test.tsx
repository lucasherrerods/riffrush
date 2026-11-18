import { render, screen, within } from "@testing-library/react";
import { PlacarAoVivo, type LinhaAoVivo } from "./PlacarAoVivo";

const linha = (id: number, nome: string, pontos: number, meu = false): LinhaAoVivo => ({ id, nome, pontos, meu, derrota: false });

const ordem = () => within(screen.getByRole("list", { name: "Placar ao vivo" })).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"));

describe("PlacarAoVivo", () => {
  it("ordena por pontos, com a posição de cada um, e me inclui", () => {
    render(<PlacarAoVivo linhas={[linha(1, "Ana", 100), linha(2, "Eu", 300, true), linha(3, "Lu", 200)]} />);
    expect(ordem()).toEqual(["1º Eu", "2º Lu", "3º Ana"]);
  });

  it("reordena quando alguém ultrapassa e marca quem subiu", () => {
    const { rerender } = render(<PlacarAoVivo linhas={[linha(1, "Ana", 100), linha(2, "Lu", 200)]} />);
    rerender(<PlacarAoVivo linhas={[linha(1, "Ana", 300), linha(2, "Lu", 200)]} />);
    expect(ordem()).toEqual(["1º Ana", "2º Lu"]);
    expect(screen.getByRole("listitem", { name: "1º Ana" })).toHaveAttribute("data-subiu", "true");
    expect(screen.getByRole("listitem", { name: "2º Lu" })).not.toHaveAttribute("data-subiu");
  });

  it("sozinho na sala não mostra nada", () => {
    const { container } = render(<PlacarAoVivo linhas={[linha(1, "Eu", 10, true)]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
