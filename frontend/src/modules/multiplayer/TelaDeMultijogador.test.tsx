import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERSONAGEM_PADRAO } from "@/modules/rock/character";
import { AudioContextFalso } from "@/test/audioFalso";
import { estadoInicial, type EstadoDaSala } from "./protocolo";
import { resolverMusica } from "./musicaNaRede";
import * as sala from "./sala";
import { avisar } from "@/shared/ui/avisos";
import { TelaDeMultijogador } from "./TelaDeMultijogador";
import { MUSICAS_DE_TESTE } from "@/test/musicas";
import { MUSICAS_EMBUTIDAS } from "@/modules/rock/songs";

vi.mock("./sala", () => ({
  PORTA_DA_SALA: 7777,
  useConexao: vi.fn(),
  ehClienteWebDaSala: vi.fn(() => false),
  criarSala: vi.fn(),
  entrarNaSala: vi.fn(),
  sairDaSala: vi.fn(),
  // Como o de verdade, devolve uma Promise: o Lobby trata a falha com .catch.
  escolher: vi.fn(async () => {}),
  comecar: vi.fn(),
  procurarSalas: vi.fn(async () => []),
  temModoOnline: vi.fn(() => true),
  criarSalaOnline: vi.fn(),
  entrarNaSalaOnline: vi.fn(),
  procurarSalasOnline: vi.fn(async () => []),
  marcarPronto: vi.fn(),
  enviarChat: vi.fn(() => true),
}));

vi.mock("./musicaNaRede", () => ({ resolverMusica: vi.fn(async () => ({})) }));

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
    // Os testes de tela usam a lista de músicas de teste, não o catálogo de verdade.
    musica: { tipo: "embutida", id: MUSICAS_DE_TESTE[0].id },
    ...extra,
  };
}

function abrir(conexao: sala.Conexao, musicas = MUSICAS_DE_TESTE) {
  vi.mocked(sala.useConexao).mockReturnValue(conexao);
  const aoVoltar = vi.fn();
  const aoBuscarMusicas = vi.fn();
  render(
    <TelaDeMultijogador
      personagem={lucas}
      musicas={musicas}
      volumeDosEfeitos={0}
      aoVoltar={aoVoltar}
      aoEditarPersonagem={vi.fn()}
      aoBuscarMusicas={aoBuscarMusicas}
    />,
  );
  return { aoVoltar, aoBuscarMusicas, usuario: userEvent.setup() };
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
    expect(sala.criarSalaOnline).toHaveBeenCalledWith(lucas, true);
  });

  it("cria uma sala online privada, que não aparece na lista", async () => {
    const { usuario } = abrir({ sala: null, endereco: "" });
    expect(screen.getByRole("switch", { name: "Aparecer na lista" })).toBeChecked();
    await usuario.click(screen.getByRole("switch", { name: "Aparecer na lista" }));
    await usuario.click(screen.getByRole("button", { name: /Criar sala online/ }));
    expect(sala.criarSalaOnline).toHaveBeenCalledWith(lucas, false);
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
    expect(sala.escolher).toHaveBeenCalledWith(MUSICAS_DE_TESTE[2], "medio", "guitarra");
    await usuario.click(screen.getByRole("radio", { name: "Expert" }));
    expect(sala.escolher).toHaveBeenCalledWith(MUSICAS_DE_TESTE[0], "expert", "guitarra");
  });

  it("o host só vê as dificuldades que o chart da música tem", () => {
    const soExpert = [{ ...MUSICAS_DE_TESTE[0], dificuldades: ["expert" as const] }];
    abrir({ sala: naSala(true), endereco: "" }, soExpert);
    const grupo = screen.getByRole("radiogroup", { name: "Dificuldade" });
    expect(within(grupo).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Expert"]);
  });

  describe("música com mais de um instrumento", () => {
    const banda = [{ ...MUSICAS_DE_TESTE[0], trilhas: { guitarra: ["expert" as const], baixo: ["facil" as const, "medio" as const] } }];

    it("só o host escolhe o instrumento, que vale para a sala toda", async () => {
      const { usuario } = abrir({ sala: naSala(true), endereco: "" }, banda);
      const grupo = screen.getByRole("radiogroup", { name: "Instrumento" });
      expect(within(grupo).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Guitarra", "Baixo"]);
      await usuario.click(within(grupo).getByRole("radio", { name: "Baixo" }));
      expect(sala.escolher).toHaveBeenCalledWith(banda[0], "medio", "baixo");
    });

    it("o host vê as dificuldades do instrumento da sala", () => {
      abrir({ sala: naSala(true, { instrumento: "baixo" }), endereco: "" }, banda);
      const grupo = screen.getByRole("radiogroup", { name: "Dificuldade" });
      expect(within(grupo).getAllByRole("radio").map((r) => r.textContent)).toEqual(["Fácil", "Médio"]);
    });

    it("o convidado só vê o instrumento escolhido pelo host", () => {
      abrir({ sala: naSala(false, { instrumento: "baixo" }), endereco: "" }, banda);
      expect(screen.queryByRole("radiogroup", { name: "Instrumento" })).not.toBeInTheDocument();
      expect(screen.getByText(/Instrumento: Baixo/)).toBeInTheDocument();
    });
  });

  it("música só com guitarra não mostra a escolha de instrumento", () => {
    abrir({ sala: naSala(true), endereco: "" });
    expect(screen.queryByRole("radiogroup", { name: "Instrumento" })).not.toBeInTheDocument();
  });

  // Antes só 3 músicas apareciam por vez: pouco para escolher numa biblioteca grande.
  it("com muitas músicas, lista todas numa lista rolável, e as setas trocam", async () => {
    const muitas = Array.from({ length: 12 }, (_, i) => ({ ...MUSICAS_DE_TESTE[0], id: `m${i}`, titulo: `Faixa ${i}` }));
    vi.mocked(sala.useConexao).mockReturnValue({ sala: naSala(true, { musica: { tipo: "embutida", id: "m6" } }), endereco: "" });
    render(<TelaDeMultijogador personagem={lucas} musicas={muitas} volumeDosEfeitos={0} aoVoltar={vi.fn()} aoEditarPersonagem={vi.fn()} aoBuscarMusicas={vi.fn()} />);
    const usuario = userEvent.setup();
    const lista = screen.getByRole("radiogroup", { name: "Música" });
    expect(within(lista).getAllByRole("radio")).toHaveLength(12);
    expect(lista).toHaveClass("rolagem-de-toque");
    await usuario.click(screen.getByRole("button", { name: "Próxima música" }));
    expect(sala.escolher).toHaveBeenCalledWith(muitas[7], "medio", "guitarra");
    await usuario.click(screen.getByRole("button", { name: "Música anterior" }));
    expect(sala.escolher).toHaveBeenCalledWith(muitas[5], "medio", "guitarra");
  });

  it("o host online vê o código para os amigos, sem QR code", () => {
    abrir({ sala: naSala(true), endereco: "", online: true, codigo: "K7QXM" });
    expect(screen.getByText("K7QXM")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /QR code/ })).not.toBeInTheDocument();
  });

  it("no online, a lista só tem músicas que todo mundo consegue tocar", () => {
    const importada = { ...MUSICAS_DE_TESTE[0], id: "arquivo:gravacao.wav:1", titulo: "Minha Gravação", arquivo: new File(["x"], "gravacao.wav") };
    abrir({ sala: naSala(true), endereco: "", online: true, codigo: "K7QXM" }, [importada, ...MUSICAS_DE_TESTE]);
    expect(screen.queryByText("Minha Gravação")).not.toBeInTheDocument();
  });

  it("avisa quando a partida não pode começar", async () => {
    vi.mocked(sala.comecar).mockRejectedValueOnce(new Error("No modo online só dá para tocar músicas do jogo."));
    // No modo online só começa com música do catálogo de verdade.
    const [doJogo] = MUSICAS_EMBUTIDAS;
    const { usuario } = abrir(
      { sala: naSala(true, { prontos: [2], musica: { tipo: "embutida", id: doJogo.id } }), endereco: "", online: true, codigo: "K7QXM" },
      [doJogo, ...MUSICAS_DE_TESTE],
    );
    await usuario.click(screen.getByRole("button", { name: /Começar partida/ }));
    await waitFor(() => expect(avisar.error).toHaveBeenCalledWith("No modo online só dá para tocar músicas do jogo."));
  });

  it("o host começa a partida com a música escolhida", async () => {
    const { usuario } = abrir({ sala: naSala(true, { musica: { tipo: "embutida", id: "cosmic-riff" }, prontos: [2] }), endereco: "" });
    await usuario.click(screen.getByRole("button", { name: /Começar partida/ }));
    await waitFor(() => expect(sala.comecar).toHaveBeenCalledWith(MUSICAS_DE_TESTE[2]));
  });

  describe("pronto", () => {
    it("o host só começa quando todos os convidados estão prontos", () => {
      abrir({ sala: naSala(true), endereco: "" });
      expect(screen.getByRole("button", { name: /Começar partida/ })).toBeDisabled();
      expect(screen.getByText("Esperando todos ficarem prontos (0 de 1)")).toBeInTheDocument();
    });

    it("mostra quem está pronto no cartão do jogador", () => {
      abrir({ sala: naSala(true, { prontos: [2] }), endereco: "" });
      const cartao = screen.getByText("Vitor").closest("li")!;
      expect(within(cartao).getByText("Pronto")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Começar partida/ })).toBeEnabled();
    });

    it("o convidado baixa a música antes de poder dar pronto", async () => {
      let terminar = () => {};
      vi.mocked(resolverMusica).mockReturnValueOnce(new Promise((resolve) => (terminar = () => resolve(MUSICAS_DE_TESTE[0]))));
      const { usuario } = abrir({ sala: naSala(false), endereco: "http://h:7777" });
      expect(screen.getByText(/Baixando a música/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Estou pronto" })).toBeNull();
      terminar();
      await usuario.click(await screen.findByRole("button", { name: "Estou pronto" }));
      expect(sala.marcarPronto).toHaveBeenCalledWith(true);
      expect(resolverMusica).toHaveBeenCalledWith(naSala(false).musica, MUSICAS_DE_TESTE, "http://h:7777");
    });

    it("o convidado pronto pode desmarcar", async () => {
      const { usuario } = abrir({ sala: naSala(false, { prontos: [2] }), endereco: "" });
      await usuario.click(await screen.findByRole("button", { name: "Cancelar pronto" }));
      expect(sala.marcarPronto).toHaveBeenCalledWith(false);
    });

    it("avisa quando não consegue baixar a música", async () => {
      vi.mocked(resolverMusica).mockRejectedValueOnce(new Error("O host ainda não compartilhou a música."));
      abrir({ sala: naSala(false), endereco: "" });
      expect(await screen.findByText("O host ainda não compartilhou a música.")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Estou pronto" })).toBeNull();
    });
  });

  it("o convidado vê a música e espera o host", () => {
    abrir({ sala: naSala(false, { musica: { tipo: "embutida", id: "overdrive" } }), endereco: "" });
    expect(screen.getByText("Overdrive")).toBeInTheDocument();
    expect(screen.getByText(/Baixando a música|Estou pronto/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Começar partida/ })).toBeNull();
  });

  it("dá para baixar músicas sem sair da sala", async () => {
    const { aoBuscarMusicas, usuario } = abrir({ sala: naSala(true), endereco: "" });
    await usuario.click(screen.getByRole("button", { name: /Baixar músicas/ }));
    expect(aoBuscarMusicas).toHaveBeenCalled();
    expect(sala.sairDaSala).not.toHaveBeenCalled();
  });

  it("sair da sala", async () => {
    const { usuario } = abrir({ sala: naSala(false), endereco: "" });
    await usuario.click(screen.getByRole("button", { name: /Sair da sala/ }));
    expect(sala.sairDaSala).toHaveBeenCalled();
  });
});
