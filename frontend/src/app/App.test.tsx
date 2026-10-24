import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { definirTelaCheia } from "@/modules/platform";
import { carregarRecordes, salvarRecorde } from "@/modules/results";
import { useConexao, voltarParaASala } from "@/modules/multiplayer";
import { PERSONAGEM_PADRAO } from "@/modules/character";
import { AudioContextFalso } from "@/test/audioFalso";
import { iniciarControle } from "@/modules/gamepad";
import { MUSICAS_EMBUTIDAS } from "@/modules/songs";
import { useSeguirMusica } from "@/modules/player";
import { sessaoDaConta } from "@/modules/conta";
import { avisar } from "@/shared/ui/avisos";
import { App } from "./App";

const biblioteca = vi.hoisted(() => ({
  salvas: [] as unknown[],
  guardar: vi.fn(async () => {}),
  usar: vi.fn(async () => {}),
  remover: vi.fn(async () => {}),
  prepararParaTocar: vi.fn(async (musica: object) => musica),
}));
vi.mock("@/modules/library", async (original) => ({
  ...(await original<typeof import("@/modules/library")>()),
  useBiblioteca: () => biblioteca,
}));

// O download de verdade é testado no módulo search; aqui chega um arquivo de áudio comum.
vi.mock("@/modules/search", async (original) => ({
  ...(await original<typeof import("@/modules/search")>()),
  baixarDoEncore: vi.fn(async () => new File(["x"], "Banda - Do Encore.wav", { type: "audio/wav" })),
}));

vi.mock("@/modules/platform", () => ({
  estaEmTelaCheia: vi.fn(async () => false),
  definirTelaCheia: vi.fn(async () => {}),
  fecharJanela: vi.fn(),
}));

// A partida de verdade é testada no módulo de gameplay; aqui só importa a ligação entre as telas.
vi.mock("@/modules/gameplay", async (original) => ({
  ...(await original<typeof import("@/modules/gameplay")>()),
  TelaDeJogo: ({ musica, dificuldade, recorde, rede, aoTerminar, aoSair }: { musica: { id: string; titulo: string }; dificuldade: string; recorde?: number; rede?: { adversarios?: React.ReactNode }; aoTerminar: (r: unknown) => void; aoSair: () => void }) => (
    <div>
      <h1>Jogando {musica.titulo}{rede ? " em rede" : ""}</h1>
      {recorde !== undefined && <p>Recorde da partida: {recorde}</p>}
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

vi.mock("@/modules/conta", async (original) => ({
  ...(await original<typeof import("@/modules/conta")>()),
  sessaoDaConta: { iniciar: vi.fn(async () => {}), registrarPartida: vi.fn(async () => null) },
}));

// Sem isso o player sintetizaria a primeira música a cada teste.
vi.mock("@/modules/player", () => ({
  CabecalhoDoPlayerDeMusica: () => null,
  indiceVizinho: vi.fn(),
  useSeguirMusica: vi.fn(),
  playerDeMusica: { definirFila: vi.fn(), definirNavegacao: vi.fn(), seguir: vi.fn(), definirVolume: vi.fn(), suspender: vi.fn(), estado: () => ({ musica: null }) },
}));

vi.stubGlobal("AudioContext", AudioContextFalso);

function abrir() {
  render(<App />);
  return userEvent.setup();
}

beforeEach(() => {
  localStorage.clear();
  biblioteca.salvas = [];
  biblioteca.guardar.mockClear();
  // Os avisos do sonner ficam num estado global e passariam de um teste para o outro.
  avisar.dismiss();
  biblioteca.usar.mockClear();
  biblioteca.prepararParaTocar.mockClear();
});

describe("App", () => {
  it("começa no menu principal", () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Riff Rush" })).toBeInTheDocument();
  });

  it("na seleção o player segue a música escolhida, e fora dela não", async () => {
    const usuario = abrir();
    expect(vi.mocked(useSeguirMusica)).toHaveBeenLastCalledWith(null);
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await screen.findByRole("heading", { name: "Selecione a música" });
    expect(vi.mocked(useSeguirMusica)).toHaveBeenLastCalledWith(MUSICAS_EMBUTIDAS[0]);
  });

  it("Jogar abre a seleção e Esc volta ao menu", async () => {
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    expect(await screen.findByRole("heading", { name: "Selecione a música" })).toBeInTheDocument();
    await usuario.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { name: "Riff Rush" })).toBeInTheDocument();
  });

  it("Busca músicas abre a tela de busca e Esc volta ao menu", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ found: 0, data: [] }))));
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Busca músicas" }));
    expect(await screen.findByRole("heading", { name: "Busca músicas" })).toBeInTheDocument();
    await usuario.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { name: "Riff Rush" })).toBeInTheDocument();
  });

  it("baixar na Busca músicas importa, salva e deixa jogar a música", async () => {
    const md5 = "8d633d2940da9b3acda9074c2385e672";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ found: 1, data: [{ md5, name: "Do Encore", artist: "Banda" }] }))));
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Busca músicas" }));
    await usuario.click(await screen.findByRole("button", { name: "Baixar Do Encore" }));
    await usuario.click(await screen.findByRole("button", { name: "Jogar Do Encore" }));
    expect(await screen.findByRole("heading", { name: "Selecione a música" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Do Encore" })).toBeInTheDocument();
    expect(biblioteca.guardar).toHaveBeenCalledWith([expect.objectContaining({ titulo: "Do Encore", md5DoEncore: md5, urlDoEncore: `https://files.enchor.us/${md5}.sng` })]);
  });

  it("toca a música escolhida e mostra o resultado, salvando o recorde", async () => {
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await usuario.click(await screen.findByRole("button", { name: /TOCAR/ }));
    await usuario.click(await screen.findByRole("button", { name: "terminar" }));
    expect(await screen.findByLabelText("777 pontos")).toBeInTheDocument();
    expect(carregarRecordes()["spektrem-shine:medio"].pontos).toBe(777);
  });

  it("a partida recebe o recorde da música para marcar na barra de estrelas", async () => {
    salvarRecorde({ musicaId: MUSICAS_EMBUTIDAS[0].id, dificuldade: "medio", pontos: 4321, acertos: 10, total: 10, maiorSequencia: 10, derrota: false });
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await usuario.click(await screen.findByRole("button", { name: /TOCAR/ }));
    expect(await screen.findByText("Recorde da partida: 4321")).toBeInTheDocument();
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

  it("com conta, mostra o XP que a partida deu; com o bot, nem manda", async () => {
    const nivel = { nivel: 2, xp_no_nivel: 50, xp_para_o_proximo: 283 };
    vi.mocked(sessaoDaConta.registrarPartida).mockResolvedValueOnce({ xp_ganho: 150, antes: { ...nivel, nivel: 1 }, depois: nivel });
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await usuario.click(await screen.findByRole("button", { name: /TOCAR/ }));
    await usuario.click(await screen.findByRole("button", { name: "terminar" }));
    expect(await screen.findByText("+150 XP")).toBeInTheDocument();
    expect(sessaoDaConta.registrarPartida).toHaveBeenCalledWith(expect.objectContaining({ pontos: 777, acertos: 9, total: 10 }));
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

  it("as músicas salvas em outras sessões aparecem na seleção", async () => {
    biblioteca.salvas = [{ ...MUSICAS_EMBUTIDAS[0], id: "arquivo:salva", titulo: "Salva de Ontem" }];
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    expect(await screen.findByRole("button", { name: /Salva de Ontem/ })).toBeInTheDocument();
  });

  it("a música importada fica salva na biblioteca", async () => {
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await usuario.upload(await screen.findByLabelText(/Importar música/), new File(["x"], "Banda X - Hit.wav", { type: "audio/wav" }));
    await waitFor(() => expect(biblioteca.guardar).toHaveBeenCalledWith([expect.objectContaining({ titulo: "Hit" })]));
  });

  it("remover uma música apaga do armazenamento e tira da lista", async () => {
    biblioteca.salvas = [{ ...MUSICAS_EMBUTIDAS[0], id: "arquivo:salva", titulo: "Para Apagar", noAparelho: true }];
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await screen.findByRole("heading", { name: "Selecione a música" });
    await usuario.keyboard("{ArrowUp}");
    await usuario.click(await screen.findByRole("button", { name: /Remover Para Apagar/ }));
    await usuario.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remover" }));
    expect(biblioteca.remover).toHaveBeenCalledWith(expect.objectContaining({ id: "arquivo:salva" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Para Apagar/ })).not.toBeInTheDocument());
  });

  it("tocar uma música avisa a biblioteca, para ela ir ao começo da lista", async () => {
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await usuario.click(await screen.findByRole("button", { name: /TOCAR/ }));
    expect(biblioteca.usar).toHaveBeenCalledWith(MUSICAS_EMBUTIDAS[0].id);
  });

  it("a música guardada no PC é lida do disco antes da partida", async () => {
    biblioteca.salvas = [{ ...MUSICAS_EMBUTIDAS[0], id: "arquivo:salva", titulo: "No Disco", noAparelho: true }];
    biblioteca.prepararParaTocar.mockImplementationOnce(async (musica) => ({ ...musica, titulo: "No Disco Carregada" }));
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    await usuario.keyboard("{ArrowUp}");
    await usuario.click(await screen.findByRole("button", { name: /TOCAR/ }));
    expect(await screen.findByRole("heading", { name: "Jogando No Disco Carregada" })).toBeInTheDocument();
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
    musica: { tipo: "embutida" as const, id: "spektrem-shine" },
    dificuldade: "expert" as const,
    prontos: [],
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
    expect(await screen.findByRole("heading", { name: "Jogando Shine em rede" })).toBeInTheDocument();
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
