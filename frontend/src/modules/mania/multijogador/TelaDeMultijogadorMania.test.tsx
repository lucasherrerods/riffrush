import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ConexaoDaSala } from "@/modules/multiplayer";
import type { ConjuntoSalvo, DificuldadeSalva } from "../beatmaps/biblioteca";
import { protocoloDoMania, type EstadoDaSalaDoMania } from "./protocolo";
import * as sala from "./sala";
import { TelaDeMultijogadorMania } from "./TelaDeMultijogadorMania";

vi.mock("./sala", async (original) => ({
  ...(await original<typeof import("./sala")>()),
  useConexao: vi.fn(),
  escolherMapa: vi.fn(async () => {}),
  marcarPronto: vi.fn(),
  procurarSalasOnline: vi.fn(async () => []),
  temModoOnline: vi.fn(() => true),
}));
vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,qr") } }));

const dificuldade = { hash: "h1", dificuldade: "Hard", teclas: 4 } as DificuldadeSalva;
const conjunto = { id: "osu:7", origem: "osu", beatmapsetId: 7, titulo: "Musica", tituloUnicode: "", artista: "Banda", artistaUnicode: "", mapper: "", mapas: [dificuldade], usadoEm: 0 } as ConjuntoSalvo;
const importado = { ...conjunto, id: "arquivo:h2", origem: "importado", beatmapsetId: undefined, titulo: "Caseira", mapas: [{ ...dificuldade, hash: "h2" }] } as ConjuntoSalvo;

function naSala(extra: Partial<EstadoDaSalaDoMania> = {}, conexao: Partial<ConexaoDaSala<EstadoDaSalaDoMania>> = {}) {
  const estado = { ...protocoloDoMania.estadoInicial({ nome: "Lu" }, true), status: "naSala" as const, meuId: 1, hostId: 1, jogadores: [{ id: 1, personagem: { nome: "Lu" } }], ...extra };
  vi.mocked(sala.useConexao).mockReturnValue({ sala: estado, endereco: "", ...conexao });
}

const dependencias = { baixarOsz: vi.fn(), guardarDoOsu: vi.fn(), importar: vi.fn() };
const abrir = () =>
  render(<TelaDeMultijogadorMania perfil={{ nome: "Lu" }} conjuntos={[conjunto, importado]} volumeDosEfeitos={0} dependencias={dependencias} lerOsz={vi.fn()} aoVoltar={vi.fn()} aoBuscarMapas={vi.fn()} />);

beforeEach(() => vi.clearAllMocks());

const outra = { ...dificuldade, hash: "h3", dificuldade: "Easy", duracaoMs: 203_000 } as DificuldadeSalva;
const comDuas = { ...conjunto, estrelas: { h3: 2.5 }, mapas: [dificuldade, outra] } as ConjuntoSalvo;

describe("TelaDeMultijogadorMania", () => {
  it("as dificuldades da mesma música ficam juntas, sob o nome dela", () => {
    naSala();
    render(<TelaDeMultijogadorMania perfil={{ nome: "Lu" }} conjuntos={[comDuas]} volumeDosEfeitos={0} dependencias={dependencias} lerOsz={vi.fn()} aoVoltar={vi.fn()} aoBuscarMapas={vi.fn()} />);
    const grupo = screen.getByRole("group", { name: "Musica" });
    expect(within(grupo).getAllByRole("radio").map((r) => r.textContent)).toEqual([expect.stringContaining("Hard"), expect.stringContaining("Easy")]);
    expect(within(grupo).getByText("3:23")).toBeInTheDocument();
    expect(within(grupo).getByText("2,50★")).toBeInTheDocument();
  });

  it("os mods do host ficam guardados num botão, não soltos no lobby", async () => {
    naSala();
    abrir();
    expect(screen.queryByRole("group", { name: "Mods" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Modificadores/ }));
    expect(screen.getByRole("group", { name: "Mods" })).toBeInTheDocument();
  });

  it("o convidado vê se o mapa da sala já está instalado", () => {
    const mapa = { tipo: "osu" as const, beatmapsetId: 7, hash: "h1", titulo: "Musica", artista: "Banda", dificuldade: "Hard", teclas: 4 };
    naSala({ souHost: false, meuId: 2, mapa });
    abrir();
    expect(screen.getByText("Instalado")).toBeInTheDocument();
  });

  it("fora da sala, mostra quem vai entrar e a busca das salas online", () => {
    vi.mocked(sala.useConexao).mockReturnValue({ sala: null, endereco: "" });
    abrir();
    expect(screen.getByText("Lu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Criar sala online/ })).toBeInTheDocument();
  });

  it("o host escolhe um mapa da biblioteca para a sala", async () => {
    naSala();
    abrir();
    await userEvent.click(screen.getByRole("radio", { name: "Musica [Hard]" }));
    expect(sala.escolherMapa).toHaveBeenCalledWith(conjunto, dificuldade, 0, expect.any(Function));
  });

  it("no online, a lista só tem os mapas do osu!", () => {
    naSala({}, { online: true, codigo: "ABCDE" });
    abrir();
    expect(screen.getByRole("radio", { name: "Musica [Hard]" })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Caseira [Hard]" })).toBeNull();
  });

  it("o convidado que já tem o mapa vê o nome e dá pronto", async () => {
    naSala({ souHost: false, meuId: 2, jogadores: [{ id: 1, personagem: { nome: "Ana" } }, { id: 2, personagem: { nome: "Lu" } }], mapa: { tipo: "osu", beatmapsetId: 7, hash: "h1", titulo: "Musica", artista: "Banda", dificuldade: "Hard", teclas: 4 } });
    abrir();
    expect(screen.getByText("Musica [Hard]")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: /Estou pronto/ }));
    await waitFor(() => expect(sala.marcarPronto).toHaveBeenCalledWith(true));
    expect(dependencias.baixarOsz).not.toHaveBeenCalled();
  });
});
