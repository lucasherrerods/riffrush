import { act, fireEvent, render, screen } from "@testing-library/react";
import { AudioContextFalso } from "@/test/audioFalso";
import { ENTRADA } from "../entrada";
import { EntradaDaPartida } from "./EntradaDaPartida";

beforeEach(() => {
  vi.stubGlobal("AudioContext", AudioContextFalso);
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

function abrir() {
  const aoAbrir = vi.fn();
  const aoTerminar = vi.fn();
  render(<EntradaDaPartida titulo="Tom Sawyer" artista="Rush" detalhe="Expert · Guitarra" volumeDosEfeitos={0.5} aoAbrir={aoAbrir} aoTerminar={aoTerminar} />);
  return { aoAbrir, aoTerminar };
}

describe("EntradaDaPartida", () => {
  it("mostra a música, abre para a partida e depois sai", () => {
    const { aoAbrir, aoTerminar } = abrir();
    expect(screen.getByRole("heading", { name: "Tom Sawyer" })).toBeInTheDocument();
    expect(screen.getByText("Rush")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(ENTRADA.saida * 1000));
    expect(aoAbrir).toHaveBeenCalledTimes(1);
    expect(aoTerminar).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime((ENTRADA.total - ENTRADA.saida) * 1000));
    expect(aoTerminar).toHaveBeenCalledTimes(1);
    expect(aoAbrir).toHaveBeenCalledTimes(1);
  });

  it("qualquer tecla pula direto para a partida", () => {
    const { aoAbrir, aoTerminar } = abrir();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(aoAbrir).toHaveBeenCalledTimes(1);
    expect(aoTerminar).toHaveBeenCalledTimes(1);
  });
});
