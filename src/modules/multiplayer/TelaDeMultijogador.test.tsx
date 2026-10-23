import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERSONAGEM_PADRAO } from "@/modules/character";
import { MUSICAS_EMBUTIDAS } from "@/modules/songs";
import { AudioContextFalso } from "@/test/audioFalso";
import { estadoInicial, type EstadoDaSala } from "./protocolo";
import * as sala from "./sala";
import { avisar } from "@/shared/ui/avisos";
import { TelaDeMultijogador } from "./TelaDeMultijogador";

vi.mock("./sala", () => ({
  PORTA_DA_SALA: 7777,
  useConexao: vi.fn(),
  ehClienteWebDaSala: vi.fn(() => false),
  criarSala: vi.fn(),
  entrarNaSala: vi.fn(),
  sairDaSala: vi.fn(),
  escolher: vi.fn(),
  comecar: vi.fn(),
  procurarSalas: vi.fn(async () => []),
  temModoOnline: vi.fn(() => true),
  criarSalaOnline: vi.fn(),
  entrarNaSalaOnline: vi.fn(),
  procurarSalasOnline: vi.fn(async () => []),
}));

vi.mock("@/shared/ui/avisos", () => ({ avisar: { error: vi.fn() } }));

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

function abrir(conexao: sala.Conexao, musicas = MUSICAS_EMBUTIDAS) {
  vi.mocked(sala.useConexao).mockReturnValue(conexao);
  const aoVoltar = vi.fn();
  render(<TelaDeMultijogador personagem={lucas} musicas={musicas} volumeDosEfeitos={0} aoVoltar={aoVoltar} aoEditarPersonagem={vi.fn()} />);
  return { aoVoltar, usuario: userEvent.setup() };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(sala.procurarSalas).mockResolvedValue([]);
  vi.mocked(sala.ehClienteWebDaSala).mockReturnValue(false);
  vi.mocked(sala.temModoOnline).mockReturnValue(true);
  vi.mocked(sala.procurarSalasOnline).mockResolvedValue([]);
  vi.stubGlobal("AudioContext", AudioContextFalso);
});

describe("fora de uma sala", () => {
  it("cria uma sala com o personagem do jogador", async () => {
    const { usuario } = abrir({ sala: null, endereco: "" });
    await usuario.click(screen.getByRole("button", { name: /Criar sala na rede/ }));
    expect(sala.criarSala).toHaveBeenCalledWith(lucas);
  });

  it("cria uma sala online", async () => {
    const { usuario } = abrir({ sala: null, endereco: "" });
    await usuario.click(screen.getByRole("button", { name: /Criar sala online/ }));
    expect(sala.criarSalaOnline).toHaveBeenCalledWith(lucas);
  });

  it("entra numa sala online pelo código", async () => {
    const { usuario } = abrir({ sala: null, endereco: "" });
    await usuario.type(screen.getByLabelText("Código da sala online"), "k7qxm");
    await usuario.click(screen.getByRole("button", { name: "Entrar online" }));
    expect(sala.entrarNaSalaOnline).toHaveBeenCalledWith("k7qxm", lucas);
  });

  it("lista as salas online abertas e entra numa delas pelo clique", async () => {
    vi.mocked(sala.procurarSalasOnline).mockResolvedValue([{ codigo: "K7QXM", nome: "Ana", jogadores: 2 }]);
    const { usuario } = abrir({ sala: null, endereco: "" });
    await usuario.click(await screen.findByRole("button", { name: /Sala de Ana/ }));
    expect(sala.entrarNaSalaOnline).toHaveBeenCalledWith("K7QXM", lucas);
  });

  it("sala online cheia aparece, mas não dá para entrar", async () => {
    vi.mocked(sala.procurarSalasOnline).mockResolvedValue([{ codigo: "K7QXM", nome: "Ana", jogadores: 4 }]);
    abrir({ sala: null, endereco: "" });
    expect(await screen.findByRole("button", { name: /Sala de Ana/ })).toBeDisabled();
  });

  it("sem servidor online configurado, o online não aparece", () => {
    vi.mocked(sala.temModoOnline).mockReturnValue(false);
    abrir({ sala: null, endereco: "" });
    expect(screen.queryByRole("button", { name: /Criar sala online/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Código da sala online")).not.toBeInTheDocument();
    expect(sala.procurarSalasOnline).not.toHaveBeenCalled();
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
    await usuario.click(screen.getByRole("radio", { name: /Cosmic Riff/ }));
    expect(sala.escolher).toHaveBeenCalledWith(MUSICAS_EMBUTIDAS[2], "medio");
    await usuario.click(screen.getByRole("radio", { name: "Expert" }));
    expect(sala.escolher).toHaveBeenCalledWith(MUSICAS_EMBUTIDAS[0], "expert");
  });

  it("com muitas músicas, mostra só as próximas da escolhida, sem rolagem, e as setas trocam", async () => {
    const muitas = Array.from({ length: 12 }, (_, i) => ({ ...MUSICAS_EMBUTIDAS[0], id: `m${i}`, titulo: `Faixa ${i}` }));
    vi.mocked(sala.useConexao).mockReturnValue({ sala: naSala(true, { musica: { tipo: "embutida", id: "m6" } }), endereco: "" });
    render(<TelaDeMultijogador personagem={lucas} musicas={muitas} volumeDosEfeitos={0} aoVoltar={vi.fn()} aoEditarPersonagem={vi.fn()} />);
    const usuario = userEvent.setup();
    const lista = screen.getByRole("radiogroup", { name: "Música" });
    expect(within(lista).getAllByRole("radio")).toHaveLength(3);
    expect(lista.className).not.toMatch(/overflow/);
    await usuario.click(screen.getByRole("button", { name: "Próxima música" }));
    expect(sala.escolher).toHaveBeenCalledWith(muitas[7], "medio");
    await usuario.click(screen.getByRole("button", { name: "Música anterior" }));
    expect(sala.escolher).toHaveBeenCalledWith(muitas[5], "medio");
  });

  it("o host online vê o código para os amigos, sem QR code", () => {
    abrir({ sala: naSala(true), endereco: "", online: true, codigo: "K7QXM" });
    expect(screen.getByText("K7QXM")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /QR code/ })).not.toBeInTheDocument();
  });

  it("no online, a lista só tem músicas que todo mundo consegue tocar", () => {
    const importada = { ...MUSICAS_EMBUTIDAS[0], id: "arquivo:gravacao.wav:1", titulo: "Minha Gravação", arquivo: new File(["x"], "gravacao.wav") };
    abrir({ sala: naSala(true), endereco: "", online: true, codigo: "K7QXM" }, [importada, ...MUSICAS_EMBUTIDAS]);
    expect(screen.queryByText("Minha Gravação")).not.toBeInTheDocument();
  });

  it("avisa quando a partida não pode começar", async () => {
    vi.mocked(sala.comecar).mockRejectedValueOnce(new Error("No modo online só dá para tocar músicas do jogo."));
    const { usuario } = abrir({ sala: naSala(true), endereco: "", online: true, codigo: "K7QXM" });
    await usuario.click(screen.getByRole("button", { name: /Começar partida/ }));
    await waitFor(() => expect(avisar.error).toHaveBeenCalledWith("No modo online só dá para tocar músicas do jogo."));
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
