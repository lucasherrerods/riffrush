import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MapaDaBusca } from "./api";
import { TelaDeBuscaMania } from "./TelaDeBuscaMania";

const mapa: MapaDaBusca = {
  beatmapsetId: 7,
  titulo: "Musica",
  tituloUnicode: "Música",
  artista: "Banda",
  artistaUnicode: "Banda",
  mapper: "Mapper",
  status: "ranked",
  dificuldades: [{ beatmapId: 1, nome: "Hard", teclas: 4, estrelas: 3.25, hash: "a", duracaoS: 100 }],
};

it("busca com os filtros, mostra os mapas e baixa", async () => {
  const buscar = vi.fn(async () => [mapa]);
  const osz = new Blob(["x"]);
  const baixar = vi.fn(async (_id: number, { aoProgredir }: { aoProgredir?: (p: number) => void } = {}) => {
    aoProgredir?.(0.5);
    return osz;
  });
  const aoBaixar = vi.fn(async () => {});
  render(<TelaDeBuscaMania baixados={new Set()} aoBaixar={aoBaixar} buscar={buscar} baixar={baixar} />);
  expect(await screen.findByText("Música")).toBeInTheDocument();
  expect(buscar).toHaveBeenLastCalledWith({ texto: "", status: "ranked", teclas: [] });
  expect(screen.getByText(/4K 3,3★ Hard/)).toBeInTheDocument();

  await userEvent.type(screen.getByLabelText("Buscar mapas"), "camellia");
  await userEvent.click(screen.getByRole("radio", { name: "Loved" }));
  await userEvent.click(screen.getByRole("button", { name: "7K" }));
  await waitFor(() => expect(buscar).toHaveBeenLastCalledWith({ texto: "camellia", status: "loved", teclas: [7] }));

  await userEvent.click(screen.getByRole("button", { name: "Baixar Musica" }));
  await waitFor(() => expect(aoBaixar).toHaveBeenCalledWith(osz, mapa));
  expect(baixar).toHaveBeenCalledWith(7, expect.anything());
});

it("marca o que já está na biblioteca", async () => {
  render(<TelaDeBuscaMania baixados={new Set([7])} aoBaixar={vi.fn()} buscar={async () => [mapa]} />);
  expect(await screen.findByText("Baixado")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Baixar Musica" })).not.toBeInTheDocument();
});

it("avisa quando os espelhos não respondem", async () => {
  render(<TelaDeBuscaMania baixados={new Set()} aoBaixar={vi.fn()} buscar={async () => Promise.reject(new Error("Os espelhos do osu! não responderam."))} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("não responderam");
});
