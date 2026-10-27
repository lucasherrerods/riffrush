import { act, render, screen } from "@testing-library/react";
import { App } from "./App";
import { trocarModo } from "./modo";

vi.mock("./AppDoRock", () => ({ AppDoRock: () => <p>jogo do rock</p> }));

it("monta o jogo do modo ativo", () => {
  render(<App />);
  expect(screen.getByText("jogo do rock")).toBeInTheDocument();
  act(() => trocarModo("mania"));
  expect(screen.getByRole("heading", { name: "Riff Rush Mania" })).toBeInTheDocument();
  act(() => trocarModo("rock"));
  expect(screen.getByText("jogo do rock")).toBeInTheDocument();
});
