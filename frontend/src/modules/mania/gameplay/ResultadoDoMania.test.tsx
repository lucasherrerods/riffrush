import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ResultadoDoMania } from "./ResultadoDoMania";
import type { ResultadoDoMania as Resultado } from "./TelaDeJogoMania";

const resultado: Resultado = {
  pontuacao: 987654,
  precisao: 0.9876,
  classificacao: "S",
  contagem: [100, 20, 3, 2, 1, 0],
  maiorCombo: 126,
  derrota: false,
  mods: 16 | 512,
  semente: 0,
  hash: "abc",
  entradas: [],
};

it("mostra nota, pontuação, precisão, combo, julgamentos e mods", async () => {
  const aoJogarDeNovo = vi.fn();
  const aoVoltar = vi.fn();
  render(<ResultadoDoMania titulo="Musica" dificuldade="Hard" resultado={resultado} aoJogarDeNovo={aoJogarDeNovo} aoVoltar={aoVoltar} />);
  expect(screen.getByLabelText("Nota S")).toBeInTheDocument();
  expect(screen.getByText("987.654")).toBeInTheDocument();
  expect(screen.getByText("98,76%")).toBeInTheDocument();
  expect(screen.getByText("126")).toBeInTheDocument();
  expect(screen.getByText("Hard · DT HD")).toBeInTheDocument();
  expect(within(screen.getByLabelText("Julgamentos")).getByText("MAX").nextSibling).toHaveTextContent("100");
  await userEvent.click(screen.getByRole("button", { name: "Jogar de novo" }));
  await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
  expect(aoJogarDeNovo).toHaveBeenCalled();
  expect(aoVoltar).toHaveBeenCalled();
});

it("avisa quando a música foi perdida", () => {
  render(<ResultadoDoMania titulo="Musica" dificuldade="Hard" resultado={{ ...resultado, derrota: true }} aoJogarDeNovo={vi.fn()} aoVoltar={vi.fn()} />);
  expect(screen.getByText("Você perdeu a música.")).toBeInTheDocument();
});
