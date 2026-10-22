import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERSONAGEM_PADRAO } from "@/modules/character";
import { MUSICAS_EMBUTIDAS } from "@/modules/songs";
import { AudioContextFalso } from "@/test/audioFalso";
import { estadoInicial, type EstadoDaSala } from "./protocolo";
import * as sala from "./sala";
import { TelaDeMultijogador } from "./TelaDeMultijogador";

vi.mock("./sala", () => ({
  useConexao: vi.fn(),
  ehClienteWebDaSala: vi.fn(() => false),
  criarSala: vi.fn(),
  entrarNaSala: vi.fn(),
  sairDaSala: vi.fn(),
  escolher: vi.fn(),
  comecar: vi.fn(),
  procurarSalas: vi.fn(async () => []),
}));

vi.mock("qrcode", () => ({ default: { toDataURL: vi.fn(async () => "data:image/png;base64,qr") } }));

const lucas = { ...PERSONAGEM_PADRAO, nome: "Lucas" };
const vitor = { ...PERSONAGEM_PADRAO, nome: "Vitor" };

function naSala(souHost: boolean, extra: Partial<EstadoDaSala> = {}): EstadoDaSala {
  return {
    ...estadoInicial(souHost ? lucas : vitor, souHost),
    status: "naSala",
    meuId: souHost ? 1 : 2,
    hostId: 1,
    jogadores: [
      { id: 1, personagem: lucas },
      { id: 2, personagem: vitor },
    ],
    ...extra,
  };
}

function abrir(conexao: sala.Conexao) {
  vi.mocked(sala.useConexao).mockReturnValue(conexao);
  const aoVoltar = vi.fn();
  render(<TelaDeMultijogador personagem={lucas} musicas={MUSICAS_EMBUTIDAS} volumeDosEfeitos={0} aoVoltar={aoVoltar} aoEditarPersonagem={vi.fn()} />);
  return { aoVoltar, usuario: userEvent.setup() };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sala.procurarSalas).mockResolvedValue([]);
  vi.mocked(sala.ehClienteWebDaSala).mockReturnValue(false);
  vi.stubGlobal("AudioContext", AudioContextFalso);
});

describe("fora de uma sala", () => {
  it("cria uma sala com o personagem do jogador", async () => {
    const { usuario } = abrir({ sala: null, endereco: "" });
    await usuario.click(screen.getByRole("button", { name: /Criar sala/ }));
    expect(sala.criarSala).toHaveBeenCalledWith(lucas);
  });

  it("lista as salas da rede e entra numa delas", async () => {
    vi.mocked(sala.procurarSalas).mockResolvedValue([{ nome: "Vitor", ip: "192.168.0.9", porta: 7777, jogadores: 2 }]);
    const { usuario } = abrir({ sala: null, endereco: "" });
    await usuario.click(await screen.findByRole("button", { name: /Sala de Vitor/ }));
    expect(screen.getByText("2/4")).toBeInTheDocument();
    expect(sala.entrarNaSala).toHaveBeenCalledWith("http://192.168.0.9:7777", lucas);
  });

  it("entra pelo IP digitado", async () => {
    const { usuario } = abrir({ sala: null, endereco: "" });
    await usuario.type(screen.getByLabelText(/IP do host/), "192.168.0.20");
    await usuario.click(screen.getByRole("button", { name: "Entrar" }));
    expect(sala.entrarNaSala).toHaveBeenCalledWith("http://192.168.0.20:7777", lucas);
  });

  it("mostra o erro da última tentativa", () => {
    abrir({ sala: null, endereco: "", erro: "O host fechou a sala." });
    expect(screen.getByRole("alert")).toHaveTextContent("O host fechou a sala.");
  });

  it("no navegador do celular entra direto na sala de quem serviu a página", async () => {
    vi.mocked(sala.ehClienteWebDaSala).mockReturnValue(true);
    const { usuario } = abrir({ sala: null, endereco: "" });
    expect(screen.queryByRole("button", { name: /Criar sala/ })).toBeNull();
    await usuario.click(screen.getByRole("button", { name: /Entrar na sala/ }));
    expect(sala.entrarNaSala).toHaveBeenCalledWith(location.origin, lucas);
  });
});

describe("na sala", () => {
  it("mostra os jogadores e as vagas", () => {
    abrir({ sala: naSala(true), endereco: "http://127.0.0.1:7777" });
    expect(screen.getByRole("img", { name: "Personagem Lucas" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Personagem Vitor" })).toBeInTheDocument();
    expect(screen.getAllByText("Esperando...")).toHaveLength(2);
    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(screen.getByText("Você")).toBeInTheDocument();
  });

  it("o host vê o QR code e o endereço para o celular", async () => {
    abrir({ sala: naSala(true), endereco: "http://127.0.0.1:7777", info: { ip: "192.168.0.5", porta: 7777, endereco: "http://192.168.0.5:7777" } });
    expect(await screen.findByRole("img", { name: /QR code/ })).toHaveAttribute("src", "data:image/png;base64,qr");
    expect(screen.getByText("http://192.168.0.5:7777")).toBeInTheDocument();
  });

  it("o host escolhe a música e a dificuldade", async () => {
    const { usuario } = abrir({ sala: naSala(true), endereco: "" });
    await usuario.click(screen.getByRole("radio", { name: /Overdrive/ }));
    expect(sala.escolher).toHaveBeenCalledWith(MUSICAS_EMBUTIDAS[3], "medio");
    await usuario.click(screen.getByRole("radio", { name: "Expert" }));
    expect(sala.escolher).toHaveBeenCalledWith(MUSICAS_EMBUTIDAS[0], "expert");
  });

  it("o host começa a partida com a música escolhida", async () => {
    const { usuario } = abrir({ sala: naSala(true, { musica: { tipo: "embutida", id: "cosmic-riff" } }), endereco: "" });
    await usuario.click(screen.getByRole("button", { name: /Começar partida/ }));
    await waitFor(() => expect(sala.comecar).toHaveBeenCalledWith(MUSICAS_EMBUTIDAS[2]));
  });

  it("o convidado vê a música e espera o host", () => {
    abrir({ sala: naSala(false, { musica: { tipo: "embutida", id: "overdrive" } }), endereco: "" });
    expect(screen.getByText("Overdrive")).toBeInTheDocument();
    expect(screen.getByText(/Esperando o host começar/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Começar partida/ })).toBeNull();
  });

  it("sair da sala", async () => {
    const { usuario } = abrir({ sala: naSala(false), endereco: "" });
    await usuario.click(screen.getByRole("button", { name: /Sair da sala/ }));
    expect(sala.sairDaSala).toHaveBeenCalled();
  });
});
