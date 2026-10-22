import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { definirTelaCheia } from "@/modules/platform";
import { carregarRecordes } from "@/modules/results";
import { AudioContextFalso } from "@/test/audioFalso";
import { App } from "./App";

vi.mock("@/modules/platform", () => ({
  estaEmTelaCheia: vi.fn(async () => false),
  definirTelaCheia: vi.fn(async () => {}),
  fecharJanela: vi.fn(),
}));

// A partida de verdade é testada no módulo de gameplay; aqui só importa a ligação entre as telas.
vi.mock("@/modules/gameplay", async (original) => ({
  ...(await original<typeof import("@/modules/gameplay")>()),
  TelaDeJogo: ({ musica, dificuldade, aoTerminar, aoSair }: { musica: { id: string; titulo: string }; dificuldade: string; aoTerminar: (r: unknown) => void; aoSair: () => void }) => (
    <div>
      <h1>Jogando {musica.titulo}</h1>
      <button onClick={() => aoTerminar({ musicaId: musica.id, dificuldade, pontos: 777, acertos: 9, total: 10, maiorSequencia: 9, derrota: false })}>terminar</button>
      <button onClick={aoSair}>sair</button>
    </div>
  ),
}));

vi.stubGlobal("AudioContext", AudioContextFalso);

function abrir() {
  render(<App />);
  return userEvent.setup();
}

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

describe("App", () => {
  it("começa no menu principal", () => {
    abrir();
    expect(screen.getByRole("heading", { name: "Riff Rush" })).toBeInTheDocument();
  });

  it("Jogar abre a seleção e Esc volta ao menu", async () => {
    const usuario = abrir();
    await usuario.click(screen.getByRole("button", { name: "Jogar" }));
    expect(await screen.findByRole("heading", { name: "Escolha a música" })).toBeInTheDocument();
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
    expect(await screen.findByRole("heading", { name: "Escolha a música" })).toBeInTheDocument();
    expect(within(document.body).queryByText(/Jogando/)).toBeNull();
  });
});
