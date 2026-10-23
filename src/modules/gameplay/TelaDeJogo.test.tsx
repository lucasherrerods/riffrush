import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { obterContextoDeAudio } from "@/modules/audio";
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

function abrir(opcoes: Partial<OpcoesDaPartida> = {}, recorde?: number) {
  const aoSair = vi.fn();
  const aoTerminar = vi.fn();
  render(
    <TelaDeJogo
      musica={MUSICAS_EMBUTIDAS[0]}
      dificuldade="medio"
      opcoes={{ ...OPCOES_PADRAO_DA_PARTIDA, ...opcoes }}
      personagem={PERSONAGEM_PADRAO}
      recorde={recorde}
      aoSair={aoSair}
      aoTerminar={aoTerminar}
    />,
  );
  return { aoSair, aoTerminar, usuario: userEvent.setup() };
}

const audio = () => obterContextoDeAudio() as unknown as AudioContextFalso;
/** Faz o relógio do áudio chegar no segundo `tempo` da música. */
const irPara = (tempo: number) => act(() => void (audio().currentTime = ENTRADA + tempo));

vi.stubGlobal("AudioContext", AudioContextFalso);

let fontesAntes = 0;

/**
 * O título aparece um instante antes de o efeito ligar o teclado, o toque e o loop.
 * Interagir antes disso faz o toque cair no vazio: espera a fonte da música desta partida existir.
 */
async function partidaPronta() {
  await screen.findByRole("heading", { name: "Neon Highway" });
  await waitFor(() => expect(audio().fontes.length).toBeGreaterThan(fontesAntes));
}

// O contexto de áudio é um só para o jogo inteiro: zera o relógio entre os testes.
beforeEach(() => {
  fontesAntes = audio().fontes.length;
  audio().currentTime = 0;
  audio().state = "running";
  vi.clearAllMocks();
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
    await partidaPronta();
    irPara(0.5);
    await usuario.keyboard("a");
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
    expect(screen.getByLabelText("Sequência")).toHaveTextContent("1");
  });

  it("Esc pausa a música e Continuar retoma", async () => {
    carregarCom([nota(5)]);
    const { usuario } = abrir();
    await partidaPronta();
    await usuario.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { name: "Pausado" })).toBeInTheDocument();
    expect(audio().suspend).toHaveBeenCalled();
    await usuario.click(screen.getByRole("button", { name: /Continuar/ }));
    expect(audio().resume).toHaveBeenCalled();
  });

  it("perder o foco da janela pausa", async () => {
    carregarCom([nota(5)]);
    abrir();
    await partidaPronta();
    act(() => void window.dispatchEvent(new Event("blur")));
    expect(await screen.findByRole("heading", { name: "Pausado" })).toBeInTheDocument();
  });

  it("Sair da música avisa a tela de cima", async () => {
    carregarCom([nota(5)]);
    const { aoSair, usuario } = abrir();
    await partidaPronta();
    await usuario.keyboard("{Escape}");
    await usuario.click(await screen.findByRole("button", { name: /Sair da música/ }));
    expect(aoSair).toHaveBeenCalled();
  });

  it("entrega o resultado quando a música termina", async () => {
    carregarCom([nota(0.5)], 1);
    const { aoTerminar } = abrir();
    await partidaPronta();
    irPara(1.2);
    await waitFor(() => expect(aoTerminar).toHaveBeenCalled());
    expect(aoTerminar.mock.calls[0][0]).toMatchObject({ musicaId: "neon-highway", dificuldade: "medio", total: 1, acertos: 0, derrota: false });
  });

  it("mostra a vaia quando a vida acaba", async () => {
    carregarCom(Array.from({ length: 30 }, (_, i) => nota(i * 0.1)), 20);
    abrir();
    await partidaPronta();
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

describe("TelaDeJogo em rede", () => {
  function abrirEmRede(inicio: number) {
    const aoAtualizar = vi.fn();
    const aoTerminar = vi.fn();
    render(
      <TelaDeJogo
        musica={MUSICAS_EMBUTIDAS[0]}
        dificuldade="medio"
        opcoes={OPCOES_PADRAO_DA_PARTIDA}
        personagem={PERSONAGEM_PADRAO}
        rede={{ inicio, aoAtualizar, adversarios: <p>painel dos adversários</p> }}
        aoSair={vi.fn()}
        aoTerminar={aoTerminar}
      />,
    );
    return { aoAtualizar, aoTerminar, usuario: userEvent.setup() };
  }
  /** Espera a tela criar a fonte da música desta partida (a lista guarda as de testes anteriores). */
  async function fonteNova(antes: number) {
    await waitFor(() => expect(audio().fontes.length).toBeGreaterThan(antes));
    return audio().fontes.at(-1)!;
  }

  it("começa a música no instante combinado com a sala", async () => {
    carregarCom([nota(5)]);
    const antes = audio().fontes.length;
    abrirEmRede(performance.now() + 5000);
    const inicio = (await fonteNova(antes)).inicio!;
    // Alguns décimos de segundo passam até a música carregar; a largada continua sendo a combinada.
    expect(inicio).toBeGreaterThan(3.5);
    expect(inicio).toBeLessThanOrEqual(5);
  });

  it("quem carregou atrasado entra no meio da música", async () => {
    carregarCom([nota(5)]);
    const antes = audio().fontes.length;
    abrirEmRede(performance.now() - 2000);
    expect((await fonteNova(antes)).deslocamento).toBeGreaterThan(1.9);
  });

  it("manda o estado do jogador para a sala", async () => {
    carregarCom([nota(5)]);
    const { aoAtualizar } = abrirEmRede(performance.now() + 5000);
    await waitFor(() => expect(aoAtualizar).toHaveBeenCalledWith(expect.objectContaining({ pontos: 0, vida: 0.5, terminou: false })));
  });

  it("a pausa só abre o menu: a música dos outros não para", async () => {
    carregarCom([nota(5)]);
    const { usuario } = abrirEmRede(performance.now() + 5000);
    await partidaPronta();
    await usuario.keyboard("{Escape}");
    expect(await screen.findByRole("heading", { name: "Menu" })).toBeInTheDocument();
    expect(audio().suspend).not.toHaveBeenCalled();
  });

  it("desistir entrega o resultado como derrota", async () => {
    carregarCom([nota(5)]);
    const { aoTerminar, usuario } = abrirEmRede(performance.now() + 5000);
    await partidaPronta();
    await usuario.keyboard("{Escape}");
    await usuario.click(await screen.findByRole("button", { name: /Desistir e ver placar/ }));
    expect(aoTerminar).toHaveBeenCalledWith(expect.objectContaining({ derrota: true }));
  });

  it("mostra o painel dos adversários", async () => {
    carregarCom([nota(5)]);
    abrirEmRede(performance.now() + 5000);
    expect(await screen.findByText("painel dos adversários")).toBeInTheDocument();
  });
});

describe("TelaDeJogo com toque", () => {
  it("tem uma área de toque embaixo de cada traste, na ordem", async () => {
    carregarCom([nota(5)]);
    abrir();
    await partidaPronta();
    const areas = screen.getAllByRole("button", { name: /^Traste / });
    expect(areas.map((a) => a.getAttribute("aria-label"))).toEqual(["Traste Verde", "Traste Vermelho", "Traste Amarelo", "Traste Azul", "Traste Laranja"]);
  });

  it("tocar na área do traste acerta a nota", async () => {
    carregarCom([nota(0.5, 2)]);
    abrir();
    await partidaPronta();
    irPara(0.55);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Traste Amarelo" }));
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
  });

  it("tirar o dedo larga o sustain e para de somar pontos", async () => {
    carregarCom([{ ...nota(0.5), duracao: 2 }]);
    abrir();
    await partidaPronta();
    irPara(0.55);
    const verde = screen.getByRole("button", { name: "Traste Verde" });
    fireEvent.pointerDown(verde);
    irPara(1);
    await waitFor(() => expect(Number(screen.getByLabelText("Pontos").textContent!.replace(/\D/g, ""))).toBeGreaterThan(50));
    fireEvent.pointerUp(verde);
    const aoSoltar = screen.getByLabelText("Pontos").textContent;
    irPara(2);
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.getByLabelText("Pontos").textContent).toBe(aoSoltar);
  });
});

describe("TelaDeJogo no celular", () => {
  beforeEach(() => Object.defineProperty(window, "innerWidth", { value: 375, configurable: true }));
  afterEach(() => Object.defineProperty(window, "innerWidth", { value: 1024, configurable: true }));

  it("troca o painel lateral por um painel compacto no topo", async () => {
    carregarCom([nota(5)]);
    abrir();
    await partidaPronta();
    expect(document.querySelector('[data-parte="hud-compacto"]')).not.toBeNull();
    expect(document.querySelector('[data-parte="hud-lateral"]')).toBeNull();
  });

  it("o star power vira um botão para tocar com o dedo", async () => {
    carregarCom([nota(5)]);
    abrir();
    expect(await screen.findByRole("button", { name: /Ativar star power/ })).toHaveTextContent("0%");
  });

  it("o personagem continua aparecendo", async () => {
    carregarCom([nota(5)]);
    abrir();
    expect(await screen.findByRole("img", { name: "Personagem Rockstar" })).toBeInTheDocument();
  });
});

describe("TelaDeJogo e as estrelas", () => {
  it("mostra a barra de estrelas, que começa vazia", async () => {
    carregarCom([nota(1), nota(2)]);
    abrir();
    await partidaPronta();
    expect(screen.getByRole("meter", { name: "Estrelas" })).toHaveAttribute("aria-valuenow", "0");
  });

  it("marca o recorde da música na barra", async () => {
    // 2 notas valem 100 pontos de base; 280 pontos são as 5 estrelas.
    carregarCom([nota(1), nota(2)]);
    abrir({}, 280);
    await partidaPronta();
    expect(await screen.findByLabelText("Recorde: 5 estrelas")).toBeInTheDocument();
  });

  it("avisa na tela quando o jogador passa o recorde", async () => {
    carregarCom([nota(0.5)]);
    const { usuario } = abrir({}, 40);
    await partidaPronta();
    irPara(0.5);
    await usuario.keyboard("a");
    expect(await screen.findByText("RECORDE BATIDO!")).toBeInTheDocument();
  });

  it("com o bot tocando, o recorde não vale e não tem aviso", async () => {
    carregarCom([nota(0.5)]);
    abrir({ bot: true }, 40);
    await partidaPronta();
    irPara(0.6);
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
    expect(screen.queryByText("RECORDE BATIDO!")).not.toBeInTheDocument();
  });

  it("sem recorde, não avisa", async () => {
    carregarCom([nota(0.5)]);
    const { usuario } = abrir();
    await partidaPronta();
    irPara(0.5);
    await usuario.keyboard("a");
    await waitFor(() => expect(screen.getByLabelText("Pontos")).toHaveTextContent("50"));
    expect(screen.queryByText("RECORDE BATIDO!")).not.toBeInTheDocument();
  });
});
