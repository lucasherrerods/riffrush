import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lerTema } from "@/shared/styles/tema";
import { TEMAS } from "@/shared/styles/tokens";
import { AudioContextFalso } from "@/test/audioFalso";
import { App } from "./App";
import { trocarModo } from "./modo";

const montagens = vi.hoisted(() => ({ total: 0 }));

vi.mock("./AppDoRock", async () => {
  const { useEffect } = await import("react");
  return {
    AppDoRock: ({ modo, alavanca }: { modo: string; alavanca?: React.ReactNode }) => {
      useEffect(() => {
        montagens.total += 1;
      }, []);
      return (
        <main>
          <p>menu do {modo}</p>
          {alavanca}
        </main>
      );
    },
  };
});

beforeEach(() => vi.stubGlobal("AudioContext", AudioContextFalso));
afterEach(() => act(() => trocarModo("rock")));

it("mantém o mesmo menu montado ao trocar de modo", () => {
  montagens.total = 0;
  render(<App />);
  expect(screen.getByText("menu do rock")).toBeInTheDocument();
  act(() => trocarModo("mania"));
  expect(screen.getByText("menu do mania")).toBeInTheDocument();
  expect(montagens.total).toBe(1);
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

it("a alavanca gira na hora, e o tema só troca coberto pela transição, que depois some", async () => {
  render(<App maniaLigado />);
  await userEvent.click(screen.getByRole("switch", { name: "Modo de jogo: Rock" }));
  expect(screen.getByRole("switch", { name: "Modo de jogo: Mania" })).toBeInTheDocument();
  expect(screen.getByTestId("transicao-de-modo")).toBeInTheDocument();
  expect(lerTema()).toBe(TEMAS.riffRush);
  await screen.findByText("menu do mania", undefined, { timeout: 3000 });
  expect(lerTema()).toBe(TEMAS.mania);
  await waitFor(() => expect(screen.queryByTestId("transicao-de-modo")).not.toBeInTheDocument(), { timeout: 3000 });
});

it("sem o Mania ligado, não há alavanca", () => {
  render(<App maniaLigado={false} />);
  expect(screen.queryByRole("switch")).not.toBeInTheDocument();
});
