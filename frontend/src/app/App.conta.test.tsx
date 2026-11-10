import { act, render } from "@testing-library/react";
import { sessaoDaConta } from "@/modules/conta";
import { App } from "./App";
import { trocarModo } from "./modo";

vi.mock("@/modules/conta", async (original) => {
  const modulo = await original<typeof import("@/modules/conta")>();
  modulo.sessaoDaConta.iniciar = vi.fn(async () => {});
  return { ...modulo, contasLigadas: true };
});
vi.mock("./AppDoRock", () => ({ AppDoRock: () => <main>jogo do rock</main> }));
vi.mock("@/modules/mania", async (original) => ({
  ...(await original<typeof import("@/modules/mania")>()),
  TelaDoMania: () => <main>jogo do mania</main>,
}));

afterEach(() => act(() => trocarModo("rock")));

it("abrindo no Mania, termina o login que voltou do Google e retoma a sessão", () => {
  act(() => trocarModo("mania"));
  render(<App />);
  expect(sessaoDaConta.iniciar).toHaveBeenCalledTimes(1);
});
