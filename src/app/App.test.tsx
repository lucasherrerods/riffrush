import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { definirTelaCheia } from "@/modules/platform";
import { carregarRecordes } from "@/modules/results";
import { useConexao, voltarParaASala } from "@/modules/multiplayer";
import { PERSONAGEM_PADRAO } from "@/modules/character";
import { AudioContextFalso } from "@/test/audioFalso";
import { iniciarControle } from "@/modules/gamepad";
import { App } from "./App";

vi.mock("@/modules/platform", () => ({
  estaEmTelaCheia: vi.fn(async () => false),
  definirTelaCheia: vi.fn(async () => {}),
  fecharJanela: vi.fn(),
}));

// A partida de verdade é testada no módulo de gameplay; aqui só importa a ligação entre as telas.
vi.mock("@/modules/gameplay", async (original) => ({
  ...(await original<typeof import("@/modules/gameplay")>()),
  TelaDeJogo: ({ musica, dificuldade, rede, aoTerminar, aoSair }: { musica: { id: string; titulo: string }; dificuldade: string; rede?: { adversarios?: React.ReactNode }; aoTerminar: (r: unknown) => void; aoSair: () => void }) => (
    <div>
      <h1>Jogando {musica.titulo}{rede ? " em rede" : ""}</h1>
      {rede?.adversarios}
      <button onClick={() => aoTerminar({ musicaId: musica.id, dificuldade, pontos: 777, acertos: 9, total: 10, maiorSequencia: 9, derrota: false })}>terminar</button>
      <button onClick={aoSair}>sair</button>
    </div>
  ),
}));

vi.mock("@/modules/gamepad", async (original) => ({ ...(await original<typeof import("@/modules/gamepad")>()), iniciarControle: vi.fn(() => () => {}) }));

vi.mock("@/modules/multiplayer", async (original) => ({
  ...(await original<typeof import("@/modules/multiplayer")>()),
  useConexao: vi.fn(() => ({ sala: null, endereco: "" })),
  voltarParaASala: vi.fn(),
}));

vi.stubGlobal("AudioContext", AudioContextFalso);

function abrir() {
  render(<App />);
  return userEvent.setup();
}

beforeEach(() => {
  localStorage.clear();
});

describe("App", () => {
  it("começa no menu principal", () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Riff Rush" })).toBeInTheDocument();
  });

  it("Jogar abre a seleção e Esc volta ao menu", async () => {
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    expect(await screen.findByRole("heading", { name: "Selecione a música" })).toBeInTheDocument();
    await usuario.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { name: "Riff Rush" })).toBeInTheDocument();
  });

  it("Busca música abre a tela de busca e Esc volta ao menu", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ found: 0, data: [] }))));
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Busca música" }));
    expect(await screen.findByRole("heading", { name: "Busca música" })).toBeInTheDocument();
    await usuario.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { name: "Riff Rush" })).toBeInTheDocument();
  });

  it("toca a música escolhida e mostra o resultado, salvando o recorde", async () => {
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await usuario.click(await screen.findByRole("button", { name: /TOCAR/ }));
    await usuario.click(await screen.findByRole("button", { name: "terminar" }));
    expect(await screen.findByLabelText("777 pontos")).toBeInTheDocument();
    expect(carregarRecordes()["neon-highway:medio"].pontos).toBe(777);
  });

  it("com o bot ligado, o recorde não é salvo", async () => {
    localStorage.setItem("riffrush.configuracoes", JSON.stringify({ bot: true }));
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await usuario.click(await screen.findByRole("button", { name: /TOCAR/ }));
    await usuario.click(await screen.findByRole("button", { name: "terminar" }));
    await screen.findByLabelText("777 pontos");
    expect(carregarRecordes()).toEqual({});
  });

  it("as configurações ficam salvas", async () => {
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Configurações" }));
    await usuario.click(await screen.findByRole("tab", { name: /Gameplay/ }));
    await usuario.click(screen.getByRole("switch", { name: "Modo sem falha" }));
    expect(JSON.parse(localStorage.getItem("riffrush.configuracoes")!).semFalha).toBe(true);
  });

  it("o personagem salvo volta para o menu e fica guardado", async () => {
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Personagem" }));
    await usuario.clear(await screen.findByLabelText("Nome"));
    await usuario.type(screen.getByLabelText("Nome"), "Lucas");
    await usuario.click(screen.getByRole("button", { name: /Salvar/ }));
    expect(await screen.findByRole("heading", { name: "Riff Rush" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("riffrush.personagem")!).nome).toBe("Lucas");
  });

  it("importa uma música e já deixa ela selecionada", async () => {
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await usuario.upload(await screen.findByLabelText(/Importar/), new File(["x"], "Banda X - Hit.wav", { type: "audio/wav" }));
    expect(await screen.findByRole("heading", { name: "Hit" })).toBeInTheDocument();
    expect(await screen.findByText(/1 música importada/)).toBeInTheDocument();
  });

  it("arrastar uma música para o menu importa e abre a seleção com ela", async () => {
    abrir();
    const arquivo = new File(["x"], "Banda X - Arrastada.wav", { type: "audio/wav" });
    fireEvent.dragEnter(window, { dataTransfer: { types: ["Files"], files: [arquivo] } });
    fireEvent.drop(window, { dataTransfer: { types: ["Files"], files: [arquivo] } });
    expect(await screen.findByRole("heading", { name: "Arrastada" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Selecione a música" })).toBeInTheDocument();
  });

  it("avisa quando o arquivo arrastado não é música", async () => {
    abrir();
    const foto = new File(["x"], "foto.png", { type: "image/png" });
    fireEvent.drop(window, { dataTransfer: { types: ["Files"], files: [foto] } });
    expect(await screen.findByText(/foto.png não é música/)).toBeInTheDocument();
  });

  it("o controle usa os trastes na partida e navega nos menus", async () => {
    const usuario = abrir();
    const { modo, mapa } = vi.mocked(iniciarControle).mock.lastCall![0];
    expect(modo()).toBe("menu");
    expect(mapa().teclas).toEqual(["KeyA", "KeyS", "KeyJ", "KeyK", "KeyL"]);
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await usuario.click(await screen.findByRole("button", { name: /TOCAR/ }));
    await screen.findByRole("button", { name: "terminar" });
    expect(modo()).toBe("jogo");
  });

  it("F11 alterna a tela cheia", async () => {
    const usuario = abrir();
    await usuario.keyboard("[F11]");
    await waitFor(() => expect(definirTelaCheia).toHaveBeenCalledWith(true));
  });

  it("sair da música volta para a seleção", async () => {
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await usuario.click(await screen.findByRole("button", { name: /TOCAR/ }));
    await usuario.click(await screen.findByRole("button", { name: "sair" }));
    expect(await screen.findByRole("heading", { name: "Selecione a música" })).toBeInTheDocument();
    expect(within(document.body).queryByText(/Jogando/)).toBeNull();
  });
});

describe("App em rede", () => {
  const vitor = { ...PERSONAGEM_PADRAO, nome: "Vitor" };
  const salaJogando = {
    status: "jogando" as const,
    souHost: false,
    meuId: 2,
    hostId: 1,
    personagem: vitor,
    jogadores: [{ id: 1, personagem: PERSONAGEM_PADRAO }, { id: 2, personagem: vitor }],
    musica: { tipo: "embutida" as const, id: "overdrive" },
    dificuldade: "expert" as const,
    adversarios: {},
    partidas: 1,
    inicio: performance.now() + 5000,
  };

  it("Multijogador abre a tela da sala", async () => {
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Multijogador" }));
    expect(await screen.findByRole("heading", { name: "Multijogador" })).toBeInTheDocument();
  });

  it("quando o host dá a largada, abre a partida em rede com os adversários", async () => {
    vi.mocked(useConexao).mockReturnValue({ sala: salaJogando, endereco: "http://h:7777" });
    abrir();
    expect(await screen.findByRole("heading", { name: "Jogando Overdrive em rede" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Personagem Rockstar" })).toBeInTheDocument();
  });

  it("no fim, mostra o placar da sala e volta para ela", async () => {
    vi.mocked(useConexao).mockReturnValue({ sala: salaJogando, endereco: "http://h:7777" });
    const usuario = abrir();
    await usuario.click(await screen.findByRole("button", { name: "terminar" }));
    expect(await screen.findByText("Vitor")).toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: /Voltar para a sala/ }));
    expect(voltarParaASala).toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Multijogador" })).toBeInTheDocument();
  });
});
