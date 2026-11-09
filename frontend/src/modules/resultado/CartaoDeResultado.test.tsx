import { render, screen, within } from "@testing-library/react";
import { CartaoDeResultado } from ".";

it("mostra o título, a nota, os números, os julgamentos e os botões", () => {
  render(
    <CartaoDeResultado
      titulo="Música"
      subtitulo="Expert"
      precisao={0.99}
      numeros={[{ rotulo: "Pontuação", valor: "1.000", rotuloDoValor: "1.000 pontos" }]}
      julgamentos={[{ rotulo: "Perfeito", valor: 10 }]}
      botoes={<button>Voltar</button>}
    />,
  );
  expect(screen.getByRole("heading", { name: "Música" })).toBeInTheDocument();
  expect(screen.getByText("Expert")).toBeInTheDocument();
  expect(screen.getByLabelText(/^Nota /)).toBeInTheDocument();
  expect(screen.getByLabelText("1.000 pontos")).toHaveTextContent("1.000");
  expect(within(screen.getByLabelText("Julgamentos")).getByText("Perfeito").nextSibling).toHaveTextContent("10");
  expect(screen.getByRole("button", { name: "Voltar" }).closest(".sticky")).not.toBeNull();
});
