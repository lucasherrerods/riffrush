import { act, render, screen } from "@testing-library/react";
import { lerTema } from "@/shared/styles/tema";
import { TEMAS } from "@/shared/styles/tokens";
import { App } from "./App";
import { trocarModo } from "./modo";

vi.mock("./AppDoRock", () => ({ AppDoRock: () => <p>jogo do rock</p> }));

afterEach(() => act(() => trocarModo("rock")));

it("monta o jogo do modo ativo", () => {
  render(<App />);
  expect(screen.getByText("jogo do rock")).toBeInTheDocument();
  act(() => trocarModo("mania"));
  expect(screen.getByRole("heading", { name: "Riff Rush Mania" })).toBeInTheDocument();
  act(() => trocarModo("rock"));
  expect(screen.getByText("jogo do rock")).toBeInTheDocument();
});

it("troca o tema e o nome da janela junto com o modo", () => {
  render(<App />);
  expect(lerTema()).toBe(TEMAS.riffRush);
  expect(document.title).toBe("Riff Rush Rock");
  act(() => trocarModo("mania"));
  expect(lerTema()).toBe(TEMAS.mania);
  expect(document.title).toBe("Riff Rush Mania");
  expect(document.documentElement.style.getPropertyValue("--cor-fundo")).toBe(TEMAS.mania.cores.fundo);
});
