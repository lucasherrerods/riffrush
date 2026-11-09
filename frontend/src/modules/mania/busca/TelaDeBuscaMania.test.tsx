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
  const buscar = vi.fn(async () => ({ mapas: [mapa], temMais: false }));
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
  render(<TelaDeBuscaMania baixados={new Set([7])} aoBaixar={vi.fn()} buscar={async () => ({ mapas: [mapa], temMais: false })} />);
  expect(await screen.findByText("Baixado")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Baixar Musica" })).not.toBeInTheDocument();
});

it("avisa quando os espelhos não respondem", async () => {
  render(<TelaDeBuscaMania baixados={new Set()} aoBaixar={vi.fn()} buscar={async () => Promise.reject(new Error("Os espelhos do osu! não responderam."))} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("não responderam");
});

it("um mapa já baixado pode ser jogado dali mesmo", async () => {
  const aoJogar = vi.fn();
  render(<TelaDeBuscaMania baixados={new Set([7])} aoBaixar={vi.fn()} aoJogar={aoJogar} buscar={async () => ({ mapas: [mapa], temMais: false })} />);
  await userEvent.click(await screen.findByRole("button", { name: "Jogar Musica" }));
  expect(aoJogar).toHaveBeenCalledWith(7);
});

it("carrega a próxima página no fim da lista, sem repetir mapas, até acabar", async () => {
  const outro = { ...mapa, beatmapsetId: 8, titulo: "Outra", tituloUnicode: "Outra" };
  const buscar = vi.fn(async ({ pagina = 0 }: { pagina?: number }) => (pagina === 0 ? { mapas: [mapa], temMais: true } : { mapas: [mapa, outro], temMais: false }));
  render(<TelaDeBuscaMania baixados={new Set()} aoBaixar={vi.fn()} buscar={buscar} />);

  await userEvent.click(await screen.findByRole("button", { name: "Carregar mais" }));

  expect(await screen.findByText("Outra")).toBeInTheDocument();
  expect(buscar).toHaveBeenLastCalledWith({ texto: "", status: "ranked", teclas: [], pagina: 1 });
  expect(screen.getAllByText("Música")).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Carregar mais" })).not.toBeInTheDocument();
});

it("mudar o filtro volta para a primeira página", async () => {
  const buscar = vi.fn(async ({ pagina = 0 }: { pagina?: number }) => ({ mapas: [{ ...mapa, beatmapsetId: pagina + 1 }], temMais: true }));
  render(<TelaDeBuscaMania baixados={new Set()} aoBaixar={vi.fn()} buscar={buscar} />);
  await userEvent.click(await screen.findByRole("button", { name: "Carregar mais" }));
  await waitFor(() => expect(screen.getAllByText("Música")).toHaveLength(2));

  await userEvent.click(screen.getByRole("radio", { name: "Loved" }));

  await waitFor(() => expect(buscar).toHaveBeenLastCalledWith({ texto: "", status: "loved", teclas: [] }));
  await waitFor(() => expect(screen.getAllByText("Música")).toHaveLength(1));
});
