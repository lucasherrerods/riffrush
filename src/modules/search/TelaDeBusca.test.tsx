import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FiltrosDaBusca, RespostaDaBusca, ResultadoDaBusca } from "./encore";
import { TelaDeBusca } from "./TelaDeBusca";

function resultado(titulo: string, extra: Partial<ResultadoDaBusca> = {}): ResultadoDaBusca {
  return { md5: titulo.padEnd(32, "0"), titulo, artista: "Banda", album: "", genero: "Rock", ano: "", charter: "Fulano", duracaoMs: 125000, instrumentos: ["guitarra"], ...extra };
}

function abrir(buscar = vi.fn(async (): Promise<RespostaDaBusca> => ({ total: 1, resultados: [resultado("Hit")] }))) {
  const aoVoltar = vi.fn();
  render(<TelaDeBusca buscar={buscar} atrasoMs={0} aoVoltar={aoVoltar} />);
  return { buscar, aoVoltar, usuario: userEvent.setup() };
}

const ultimaChamada = (buscar: ReturnType<typeof vi.fn>) => buscar.mock.lastCall as unknown as [FiltrosDaBusca, number];

describe("TelaDeBusca", () => {
  it("abre com o título e já lista músicas", async () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Busca música" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Hit" })).toBeInTheDocument();
    expect(screen.getByText(/Fulano/)).toBeInTheDocument();
    expect(screen.getByText("2:05")).toBeInTheDocument();
  });

  it("busca pelo texto digitado", async () => {
    const { buscar, usuario } = abrir();
    await usuario.type(screen.getByRole("searchbox", { name: "Buscar música" }), "sandman");
    await waitFor(() => expect(ultimaChamada(buscar)[0].texto).toBe("sandman"));
  });

  it("os filtros de instrumento e dificuldade entram na busca", async () => {
    const { buscar, usuario } = abrir();
    await usuario.click(screen.getByRole("radio", { name: "Bateria" }));
    await usuario.click(screen.getByRole("radio", { name: "Expert" }));
    await waitFor(() => expect(ultimaChamada(buscar)[0]).toMatchObject({ instrumento: "bateria", dificuldade: "expert" }));
  });

  it("pagina os resultados", async () => {
    const buscar = vi.fn(async (): Promise<RespostaDaBusca> => ({ total: 25, resultados: [resultado("Hit")] }));
    const { usuario } = abrir(buscar);
    expect(await screen.findByText("Página 1 de 3")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Próxima página" }));
    await waitFor(() => expect(ultimaChamada(buscar)[1]).toBe(2));
    expect(await screen.findByText("Página 2 de 3")).toBeInTheDocument();
  });

  it("avisa quando não encontra nada", async () => {
    abrir(vi.fn(async () => ({ total: 0, resultados: [] })));
    expect(await screen.findByText(/Nenhuma música encontrada/)).toBeInTheDocument();
  });

  it("mostra o erro da busca", async () => {
    abrir(vi.fn(async () => Promise.reject(new Error("O Encore está indisponível agora."))));
    expect(await screen.findByRole("alert")).toHaveTextContent("indisponível");
  });

  it("Esc volta ao menu", async () => {
    const { aoVoltar, usuario } = abrir();
    await screen.findByRole("heading", { name: "Hit" });
    await usuario.keyboard("{Escape}");
    expect(aoVoltar).toHaveBeenCalled();
  });
});
