import { act, render, screen } from "@testing-library/react";
import { ProcurarSala } from "./ProcurarSala";

const acoes = (procurarSalasOnline: () => Promise<[]>) => ({
  ehClienteWebDaSala: () => false,
  temModoOnline: () => true,
  procurarSalasOnline,
  criarSalaOnline: vi.fn(),
  entrarNaSalaOnline: vi.fn(),
  entrarNaSalaDoCelular: vi.fn(),
});

afterEach(() => vi.useRealTimers());

describe("ProcurarSala", () => {
  it("a busca periódica não troca o texto da lista vazia", async () => {
    vi.useFakeTimers();
    let responder = () => {};
    const procurar = vi.fn(() => new Promise<[]>((r) => (responder = () => r([]))));
    render(<ProcurarSala retrato={null} volumeDosEfeitos={0} acoes={acoes(procurar)} />);
    expect(screen.getByText("Procurando salas...")).toBeInTheDocument();
    await act(async () => responder());
    expect(screen.getByText(/Nenhuma sala encontrada/)).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTime(60_000));
    expect(procurar.mock.calls.length).toBeGreaterThan(1);
    expect(screen.queryByText("Procurando salas...")).toBeNull();
    expect(screen.getByText(/Nenhuma sala encontrada/)).toBeInTheDocument();
  });
});
