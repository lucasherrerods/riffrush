import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PERSONAGEM_PADRAO } from "@/modules/character";
import { MUSICAS_EMBUTIDAS, carregarMusica, type Nota } from "@/modules/songs";
import { AudioContextFalso } from "@/test/audioFalso";
import { OPCOES_PADRAO_DA_PARTIDA, TelaDeJogo, type OpcoesDaPartida } from "./TelaDeJogo";

vi.mock("@/modules/songs", async (original) => ({
  ...(await original<typeof import("@/modules/songs")>()),
  carregarMusica: vi.fn(),
}));

const ENTRADA = 2.5;
const nota = (tempo: number, pista = 0): Nota => ({ tempo, pista, frase: -1, duracao: 0 });

function carregarCom(notas: Nota[], duracao = 10) {
  vi.mocked(carregarMusica).mockResolvedValue({ audio: {} as AudioBuffer, notas, batidas: [], duracao });
}

function abrir(opcoes: Partial<OpcoesDaPartida> = {}) {
  const aoSair = vi.fn();
  const aoTerminar = vi.fn();
  render(
    <TelaDeJogo
      musica={MUSICAS_EMBUTIDAS[0]}
      dificuldade="medio"
      opcoes={{ ...OPCOES_PADRAO_DA_PARTIDA, ...opcoes }}
      personagem={PERSONAGEM_PADRAO}
      aoSair={aoSair}
      aoTerminar={aoTerminar}
    />,
  );
  return { aoSair, aoTerminar, usuario: userEvent.setup() };
}

const audio = () => AudioContextFalso.instancias[0];
/** Faz o relógio do áudio chegar no segundo `tempo` da música. */
const irPara = (tempo: number) => act(() => void (audio().currentTime = ENTRADA + tempo));

beforeEach(() => {
  AudioContextFalso.instancias = [];
  vi.stubGlobal("AudioContext", AudioContextFalso);
});

describe("TelaDeJogo", () => {
  it("mostra o carregamento e depois a música", async () => {
    carregarCom([nota(1)]);
    abrir();
    expect(screen.getByText(/Gravando a banda/)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Neon Highway" })).toBeInTheDocument();
  });

  it("faz a contagem regressiva antes da música", async () => {
    carregarCom([nota(1)]);
    abrir();
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("acertar uma nota soma pontos e sequência", async () => {
    carregarCom([nota(0.5)]);
    const { usuario } = abrir();
    await screen.findByRole("heading", { name: "Neon Highway" });
    irPara(0.5);
    await usuario.keyboard("a");
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
    expect(screen.getByLabelText("Sequência")).toHaveTextContent("1");
  });

  it("Esc pausa a música e Continuar retoma", async () => {
    carregarCom([nota(5)]);
    const { usuario } = abrir();
    await screen.findByRole("heading", { name: "Neon Highway" });
    await usuario.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { name: "Pausado" })).toBeInTheDocument();
    expect(audio().suspend).toHaveBeenCalled();
    await usuario.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(audio().resume).toHaveBeenCalled();
  });

  it("perder o foco da janela pausa", async () => {
    carregarCom([nota(5)]);
    abrir();
    await screen.findByRole("heading", { name: "Neon Highway" });
    act(() => void window.dispatchEvent(new Event("blur")));
    expect(await screen.findByRole("heading", { name: "Pausado" })).toBeInTheDocument();
  });

  it("Sair da música avisa a tela de cima", async () => {
    carregarCom([nota(5)]);
    const { aoSair, usuario } = abrir();
    await screen.findByRole("heading", { name: "Neon Highway" });
    await usuario.keyboard("{Escape}");
    await usuario.click(await screen.findByRole("button", { name: /Sair da música/ }));
    expect(aoSair).toHaveBeenCalled();
  });

  it("entrega o resultado quando a música termina", async () => {
    carregarCom([nota(0.5)], 1);
    const { aoTerminar } = abrir();
    await screen.findByRole("heading", { name: "Neon Highway" });
    irPara(1.2);
    await waitFor(() => expect(aoTerminar).toHaveBeenCalled());
    expect(aoTerminar.mock.calls[0][0]).toMatchObject({ musicaId: "neon-highway", dificuldade: "medio", total: 1, acertos: 0, derrota: false });
  });

  it("mostra a vaia quando a vida acaba", async () => {
    carregarCom(Array.from({ length: 30 }, (_, i) => nota(i * 0.1)), 20);
    abrir();
    await screen.findByRole("heading", { name: "Neon Highway" });
    irPara(5);
    expect(await screen.findByRole("heading", { name: /A galera vaiou/ })).toBeInTheDocument();
  });

  it("mostra o selo BOT quando o bot está ligado", async () => {
    carregarCom([nota(1)]);
    abrir({ bot: true });
    expect(await screen.findByText("BOT")).toBeInTheDocument();
  });

  it("mostra o personagem ao lado da pista", async () => {
    carregarCom([nota(1)]);
    abrir();
    expect(await screen.findByRole("img", { name: "Personagem Rockstar" })).toBeInTheDocument();
  });
});
