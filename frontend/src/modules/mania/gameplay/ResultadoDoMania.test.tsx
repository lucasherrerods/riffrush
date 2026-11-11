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
  estatisticas: { julgamentos: [0, 0, 5, 0], desvios: [-6, -2, 4] },
  janelaMs: 100,
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

it("Enter volta e R joga de novo, como no Rock", async () => {
  const aoVoltar = vi.fn();
  const aoJogarDeNovo = vi.fn();
  render(<ResultadoDoMania titulo="Música" dificuldade="Hard" resultado={resultado} aoJogarDeNovo={aoJogarDeNovo} aoVoltar={aoVoltar} />);
  await userEvent.keyboard("{Enter}");
  expect(aoVoltar).toHaveBeenCalled();
  await userEvent.keyboard("r");
  expect(aoJogarDeNovo).toHaveBeenCalled();
});

it("mostra a precisão ao longo da música e o desvio dos toques", () => {
  render(<ResultadoDoMania titulo="Música" dificuldade="Hard" resultado={resultado} aoJogarDeNovo={vi.fn()} aoVoltar={vi.fn()} />);
  expect(screen.getByRole("img", { name: "Precisão ao longo da música" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Desvio dos toques" })).toBeInTheDocument();
  expect(screen.getByText("1,3 ms cedo")).toBeInTheDocument();
});
