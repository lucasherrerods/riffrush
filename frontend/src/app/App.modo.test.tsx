import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lerTema } from "@/shared/styles/tema";
import { TEMAS } from "@/shared/styles/tokens";
import { App } from "./App";
import { trocarModo } from "./modo";

vi.mock("./AppDoRock", () => ({ AppDoRock: ({ alavanca }: { alavanca?: React.ReactNode }) => <main>jogo do rock{alavanca}</main> }));

afterEach(() => act(() => trocarModo("rock")));

it("monta o jogo do modo ativo", async () => {
  render(<App />);
  expect(screen.getByText("jogo do rock")).toBeInTheDocument();
  act(() => trocarModo("mania"));
  // O Mania é baixado só quando aparece.
  expect(await screen.findByRole("heading", { name: "Riff Rush Mania" }, { timeout: 5000 })).toBeInTheDocument();
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

it("com o Mania ligado, girar a alavanca troca o jogo inteiro e girar de novo volta", async () => {
  render(<App maniaLigado />);
  await userEvent.click(screen.getByRole("switch", { name: "Modo de jogo: Rock" }));
  expect(await screen.findByRole("heading", { name: "Riff Rush Mania" }, { timeout: 5000 })).toBeInTheDocument();
  expect(lerTema()).toBe(TEMAS.mania);
  await userEvent.click(screen.getByRole("switch", { name: "Modo de jogo: Mania" }));
  expect(screen.getByText("jogo do rock")).toBeInTheDocument();
  expect(lerTema()).toBe(TEMAS.riffRush);
});

it("sem o Mania ligado, não há alavanca", () => {
  render(<App maniaLigado={false} />);
  expect(screen.queryByRole("switch")).not.toBeInTheDocument();
});
