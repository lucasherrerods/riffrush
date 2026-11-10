import { render, screen } from "@testing-library/react";
import { GrupoDeOpcoes } from "./GrupoDeOpcoes";

it("com tituloEscondido, o título some da tela mas continua nomeando o grupo", () => {
  render(<GrupoDeOpcoes titulo="Instrumento" tituloEscondido opcoes={[{ id: "a", rotulo: "A" }]} valor="a" aoEscolher={vi.fn()} />);
  expect(screen.getByRole("radiogroup", { name: "Instrumento" })).toBeInTheDocument();
  expect(screen.getByText("Instrumento")).toHaveClass("sr-only");
});
