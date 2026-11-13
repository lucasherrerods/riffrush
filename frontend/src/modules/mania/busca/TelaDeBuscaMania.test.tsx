import { rolarAteOFim } from "@/test/intersecao";
import { render, screen, waitFor, within } from "@testing-library/react";
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

  await screen.findByText("Música");
  rolarAteOFim();

  expect(await screen.findByText("Outra")).toBeInTheDocument();
  expect(buscar).toHaveBeenLastCalledWith({ texto: "", status: "ranked", teclas: [], pagina: 1 });
  expect(screen.getAllByText("Música")).toHaveLength(1);
  expect(document.querySelector("[data-parte='fim-da-lista']")).toBeNull();
});

it("mudar o filtro volta para a primeira página", async () => {
  const buscar = vi.fn(async ({ pagina = 0 }: { pagina?: number }) => ({ mapas: [{ ...mapa, beatmapsetId: pagina + 1 }], temMais: true }));
  render(<TelaDeBuscaMania baixados={new Set()} aoBaixar={vi.fn()} buscar={buscar} />);
  await screen.findByText("Música");
  rolarAteOFim();
  await waitFor(() => expect(screen.getAllByText("Música")).toHaveLength(2));

  await userEvent.click(screen.getByRole("radio", { name: "Loved" }));

  await waitFor(() => expect(buscar).toHaveBeenLastCalledWith({ texto: "", status: "loved", teclas: [] }));
  await waitFor(() => expect(screen.getAllByText("Música")).toHaveLength(1));
});

describe("no celular", () => {
  beforeEach(() => Object.defineProperty(window, "innerWidth", { value: 375, configurable: true }));
  afterEach(() => Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true }));

  // No celular só se joga até 5K: nem o filtro nem os resultados oferecem 6K para cima.
  it("só oferece 4K e 5K, pede só eles e não mostra para baixar o conjunto que só tem 6K+", async () => {
    const so7k = { ...mapa, beatmapsetId: 8, titulo: "Sete", dificuldades: [{ ...mapa.dificuldades[0], teclas: 7 }] };
    const buscar = vi.fn(async () => ({ mapas: [mapa, so7k], temMais: false }));
    render(<TelaDeBuscaMania baixados={new Set()} aoBaixar={vi.fn()} buscar={buscar} />);
    const grupo = screen.getByRole("group", { name: "Teclas" });
    expect(within(grupo).getAllByRole("button").map((b) => b.textContent)).toEqual(["4K", "5K"]);
    await waitFor(() => expect(buscar).toHaveBeenLastCalledWith({ texto: "", status: "ranked", teclas: [4, 5] }));
    expect(await screen.findByRole("button", { name: "Baixar Musica" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Baixar Sete" })).not.toBeInTheDocument();
  });
});

describe("prévia na busca do Mania", () => {
  beforeEach(() => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  it("toca a prévia que o osu! manda e cala a música de fundo", async () => {
    const aoMudarPrevia = vi.fn();
    const buscar = vi.fn(async () => ({ mapas: [{ ...mapa, previa: "https://b.ppy.sh/preview/7.mp3" }], temMais: false }));
    render(<TelaDeBuscaMania baixados={new Set()} aoBaixar={vi.fn()} buscar={buscar} aoMudarPrevia={aoMudarPrevia} />);
    await userEvent.click(await screen.findByRole("button", { name: "Ouvir prévia de Música" }));
    expect(await screen.findByRole("button", { name: "Parar prévia de Música" })).toHaveAttribute("aria-pressed", "true");
    expect(aoMudarPrevia).toHaveBeenLastCalledWith(true);
  });

  it("sem prévia no mapa, a capa não toca nada", async () => {
    render(<TelaDeBuscaMania baixados={new Set()} aoBaixar={vi.fn()} buscar={async () => ({ mapas: [mapa], temMais: false })} />);
    await screen.findByText("Música");
    expect(screen.queryByRole("button", { name: /prévia/ })).not.toBeInTheDocument();
  });
});
